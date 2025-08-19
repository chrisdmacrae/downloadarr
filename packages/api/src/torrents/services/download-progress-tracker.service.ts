import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RequestedTorrentsService } from './requested-torrents.service';
import { Aria2Service } from '../../download/aria2.service';
import { RequestStatus } from '../../../generated/prisma';

@Injectable()
export class DownloadProgressTrackerService {
  private readonly logger = new Logger(DownloadProgressTrackerService.name);

  constructor(
    private readonly requestedTorrentsService: RequestedTorrentsService,
    private readonly aria2Service: Aria2Service,
  ) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  async trackDownloadProgress(): Promise<void> {
    try {
      // Get all downloading requests
      const downloadingRequests = await this.requestedTorrentsService.getRequestsByStatus(RequestStatus.DOWNLOADING);
      
      if (downloadingRequests.length === 0) {
        return;
      }

      this.logger.debug(`Tracking progress for ${downloadingRequests.length} downloads`);

      for (const request of downloadingRequests) {
        if (request.aria2Gid) {
          await this.updateDownloadProgress(request.id, request.aria2Gid);
        }
      }
    } catch (error) {
      this.logger.error('Error tracking download progress:', error);
    }
  }

  private async updateDownloadProgress(requestId: string, aria2Gid: string): Promise<void> {
    try {
      const status = await this.aria2Service.getStatus(aria2Gid);
      
      if (!status) {
        this.logger.warn(`No status found for download ${aria2Gid}`);
        return;
      }

      // Calculate progress percentage
      const totalLength = parseInt(status.totalLength) || 0;
      const completedLength = parseInt(status.completedLength) || 0;
      const progress = totalLength > 0
        ? Math.round((completedLength / totalLength) * 100)
        : 0;

      // Format download speed
      const downloadSpeed = parseInt(status.downloadSpeed) || 0;
      const speed = this.formatSpeed(downloadSpeed);
      
      // Calculate ETA
      const eta = this.calculateEta(totalLength, completedLength, downloadSpeed);

      // Update progress in database
      await this.requestedTorrentsService.updateDownloadProgress(requestId, progress, speed, eta);

      // Check if download is complete
      if (status.status === 'complete') {
        await this.requestedTorrentsService.updateRequestStatus(requestId, RequestStatus.COMPLETED);
        this.logger.log(`Download completed for request ${requestId}`);
      } else if (status.status === 'error') {
        await this.requestedTorrentsService.updateRequestStatus(requestId, RequestStatus.FAILED);
        this.logger.warn(`Download failed for request ${requestId}: ${status.errorMessage}`);
      }

    } catch (error) {
      this.logger.error(`Error updating progress for request ${requestId}:`, error);
    }
  }

  private formatSpeed(bytesPerSecond: number): string {
    if (bytesPerSecond === 0) return '0 B/s';
    
    const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    let speed = bytesPerSecond;
    let unitIndex = 0;

    while (speed >= 1024 && unitIndex < units.length - 1) {
      speed /= 1024;
      unitIndex++;
    }

    return `${speed.toFixed(1)} ${units[unitIndex]}`;
  }

  private calculateEta(totalLength: number, completedLength: number, downloadSpeed: number): string {
    if (downloadSpeed === 0 || totalLength === 0) return 'Unknown';
    
    const remainingBytes = totalLength - completedLength;
    const remainingSeconds = remainingBytes / downloadSpeed;

    if (remainingSeconds < 60) {
      return `${Math.round(remainingSeconds)}s`;
    } else if (remainingSeconds < 3600) {
      return `${Math.round(remainingSeconds / 60)}m`;
    } else {
      const hours = Math.floor(remainingSeconds / 3600);
      const minutes = Math.round((remainingSeconds % 3600) / 60);
      return `${hours}h ${minutes}m`;
    }
  }

  // Manual method to sync a specific download
  async syncDownloadStatus(requestId: string): Promise<void> {
    try {
      const request = await this.requestedTorrentsService.getRequestById(requestId);
      
      if (request.status !== RequestStatus.DOWNLOADING || !request.aria2Gid) {
        this.logger.warn(`Request ${requestId} is not in downloading state or missing aria2Gid`);
        return;
      }

      await this.updateDownloadProgress(requestId, request.aria2Gid);
    } catch (error) {
      this.logger.error(`Error syncing download status for ${requestId}:`, error);
      throw error;
    }
  }

  // Get download statistics
  async getDownloadStats(): Promise<{
    activeDownloads: number;
    totalSpeed: string;
    averageProgress: number;
  }> {
    try {
      const downloadingRequests = await this.requestedTorrentsService.getRequestsByStatus(RequestStatus.DOWNLOADING);
      
      if (downloadingRequests.length === 0) {
        return {
          activeDownloads: 0,
          totalSpeed: '0 B/s',
          averageProgress: 0,
        };
      }

      let totalSpeedBytes = 0;
      let totalProgress = 0;
      let validProgressCount = 0;

      for (const request of downloadingRequests) {
        if (request.aria2Gid) {
          try {
            const status = await this.aria2Service.getStatus(request.aria2Gid);
            if (status) {
              totalSpeedBytes += parseInt(status.downloadSpeed) || 0;
              
              if (request.downloadProgress !== null) {
                totalProgress += request.downloadProgress;
                validProgressCount++;
              }
            }
          } catch (error) {
            this.logger.debug(`Error getting status for ${request.aria2Gid}:`, error);
          }
        }
      }

      return {
        activeDownloads: downloadingRequests.length,
        totalSpeed: this.formatSpeed(totalSpeedBytes),
        averageProgress: validProgressCount > 0 ? Math.round(totalProgress / validProgressCount) : 0,
      };
    } catch (error) {
      this.logger.error('Error getting download stats:', error);
      return {
        activeDownloads: 0,
        totalSpeed: '0 B/s',
        averageProgress: 0,
      };
    }
  }
}
