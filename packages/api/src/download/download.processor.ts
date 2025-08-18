import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { Aria2Service } from './aria2.service';
import { DownloadGateway } from './download.gateway';

@Processor('download')
export class DownloadProcessor {
  private readonly logger = new Logger(DownloadProcessor.name);

  constructor(
    private aria2Service: Aria2Service,
    private downloadGateway: DownloadGateway,
  ) {}

  @Process('process-download')
  async handleDownload(job: Job) {
    this.logger.log(`Processing download job ${job.id}`);

    const { url, type, destination, name } = job.data;

    try {
      // Update progress
      await job.progress(5);

      let gid: string;
      const options = {
        dir: destination || '/downloads',
        out: name,
      };

      // Start download based on type
      switch (type) {
        case 'magnet':
          gid = await this.processMagnetLink(job, url, options);
          break;
        case 'torrent':
          gid = await this.processTorrentFile(job, url, options);
          break;
        case 'http':
        case 'https':
          gid = await this.processHttpDownload(job, url, options);
          break;
        default:
          throw new Error(`Unsupported download type: ${type}`);
      }

      // Store the aria2 GID in job data for tracking
      await job.update({ ...job.data, aria2Gid: gid });
      await job.progress(10);

      // Monitor download progress
      await this.monitorDownloadProgress(job, gid);

      // Broadcast completion
      this.downloadGateway.broadcastDownloadComplete(job.id.toString(), {
        success: true,
        message: 'Download completed',
        gid,
      });

      this.logger.log(`Download job ${job.id} completed successfully`);

      return { success: true, message: 'Download completed', gid };
    } catch (error) {
      // Broadcast error
      this.downloadGateway.broadcastDownloadError(job.id.toString(), error.message);

      this.logger.error(`Download job ${job.id} failed:`, error);
      throw error;
    }
  }

  private async processMagnetLink(job: Job, magnetUri: string, options: any): Promise<string> {
    this.logger.log(`Processing magnet link for job ${job.id}`);

    if (!this.aria2Service.isAria2Connected()) {
      throw new Error('Aria2 service is not connected');
    }

    const gid = await this.aria2Service.addMagnet(magnetUri, options);
    this.logger.log(`Started magnet download with GID: ${gid}`);
    return gid;
  }

  private async processTorrentFile(job: Job, torrentUrl: string, options: any): Promise<string> {
    this.logger.log(`Processing torrent file for job ${job.id}`);

    if (!this.aria2Service.isAria2Connected()) {
      throw new Error('Aria2 service is not connected');
    }

    // For torrent files, we need to download the .torrent file first
    // For now, we'll treat it as a URI download - in a real implementation,
    // you might want to fetch the torrent file and use addTorrent instead
    const gid = await this.aria2Service.addUri([torrentUrl], options);
    this.logger.log(`Started torrent download with GID: ${gid}`);
    return gid;
  }

  private async processHttpDownload(job: Job, url: string, options: any): Promise<string> {
    this.logger.log(`Processing HTTP download for job ${job.id}`);

    if (!this.aria2Service.isAria2Connected()) {
      throw new Error('Aria2 service is not connected');
    }

    const gid = await this.aria2Service.addUri([url], options);
    this.logger.log(`Started HTTP download with GID: ${gid}`);
    return gid;
  }

  private async monitorDownloadProgress(job: Job, gid: string) {
    const maxAttempts = 1800; // 30 minutes with 1-second intervals
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const status = await this.aria2Service.getStatus(gid);

        // Calculate progress percentage
        const totalLength = parseInt(status.totalLength);
        const completedLength = parseInt(status.completedLength);
        const progress = totalLength > 0 ? Math.round((completedLength / totalLength) * 90) + 10 : 10;

        await job.progress(progress);

        // Broadcast progress update
        this.downloadGateway.broadcastDownloadProgress(job.id.toString(), progress, status.status, {
          downloadSpeed: status.downloadSpeed,
          uploadSpeed: status.uploadSpeed,
          totalLength: status.totalLength,
          completedLength: status.completedLength,
          connections: status.connections,
        });

        // Log progress periodically
        if (attempts % 30 === 0) { // Every 30 seconds
          this.logger.log(`Download ${gid} progress: ${progress}% (${status.status})`);
        }

        // Check if download is complete
        if (status.status === 'complete') {
          await job.progress(100);
          this.downloadGateway.broadcastDownloadStatusChange(job.id.toString(), 'complete', {
            totalLength: status.totalLength,
            completedLength: status.completedLength,
          });
          this.logger.log(`Download ${gid} completed successfully`);
          return;
        }

        // Check for errors
        if (status.status === 'error') {
          this.downloadGateway.broadcastDownloadStatusChange(job.id.toString(), 'error', {
            errorMessage: status.errorMessage,
            errorCode: status.errorCode,
          });
          throw new Error(`Download failed: ${status.errorMessage || 'Unknown error'}`);
        }

        // Check if download was removed
        if (status.status === 'removed') {
          this.downloadGateway.broadcastDownloadStatusChange(job.id.toString(), 'cancelled');
          throw new Error('Download was cancelled or removed');
        }

        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        attempts++;
      } catch (error) {
        if (error.message.includes('not found')) {
          // Download might have completed and been removed from active list
          this.logger.log(`Download ${gid} not found in active list, assuming completed`);
          await job.progress(100);
          return;
        }
        throw error;
      }
    }

    throw new Error('Download timeout: exceeded maximum monitoring time');
  }
}
