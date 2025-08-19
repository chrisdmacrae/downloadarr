import { Injectable } from '@nestjs/common';
import { CreateDownloadDto } from './dto/create-download.dto';
import { Aria2Service } from './aria2.service';
import { DownloadMetadataService } from './download-metadata.service';

@Injectable()
export class DownloadService {
  constructor(
    private aria2Service: Aria2Service,
    private downloadMetadataService: DownloadMetadataService,
  ) {}

  async createDownload(createDownloadDto: CreateDownloadDto) {
    const { url, type, destination, name } = createDownloadDto;

    const options = {
      dir: destination || '/downloads',
      out: name,
    };

    let gid: string;

    // Start download directly with Aria2 based on type
    switch (type) {
      case 'magnet':
        gid = await this.aria2Service.addMagnet(url, options);
        break;
      case 'torrent':
        gid = await this.aria2Service.addUri([url], options);
        break;
      case 'http':
      case 'https':
        gid = await this.aria2Service.addUri([url], options);
        break;
      default:
        throw new Error(`Unsupported download type: ${type}`);
    }

    // Create metadata entry
    const metadata = await this.downloadMetadataService.createDownloadMetadata({
      name: name || 'Unknown',
      originalUrl: url,
      type,
      aria2Gid: gid,
      destination,
    });

    // TODO: In a real implementation, you might want to:
    // 1. Extract media info from the name/URL
    // 2. Look up movie/TV show details from TMDB
    // 3. Monitor for child downloads and update metadata

    return {
      id: metadata.id,
      status: 'active',
      aria2Gid: gid,
      ...createDownloadDto,
    };
  }

  async getDownloads() {
    // Return grouped downloads with metadata
    return this.downloadMetadataService.getGroupedDownloads();
  }

  // Legacy method for raw Aria2 downloads (kept for compatibility)
  async getRawDownloads() {
    // Get all downloads from Aria2
    const [active, waiting, stopped] = await Promise.all([
      this.aria2Service.getActiveDownloads(),
      this.aria2Service.getWaitingDownloads(),
      this.aria2Service.getStoppedDownloads(),
    ]);

    const allDownloads = [...active, ...waiting, ...stopped];

    return allDownloads.map(download => ({
      id: download.gid,
      status: download.status,
      data: {
        url: download.files?.[0]?.uris?.[0]?.uri || 'Unknown',
        name: download.files?.[0]?.path || 'Unknown',
        totalLength: download.totalLength,
        completedLength: download.completedLength,
      },
      progress: parseInt(download.totalLength) > 0 ?
        Math.round((parseInt(download.completedLength) / parseInt(download.totalLength)) * 100) : 0,
      createdAt: Date.now(), // Aria2 doesn't provide creation time
      processedAt: download.status === 'active' ? Date.now() : null,
      finishedAt: download.status === 'complete' ? Date.now() : null,
    }));
  }

  async getDownload(id: string) {
    try {
      const download = await this.aria2Service.getStatus(id);

      return {
        id: download.gid,
        status: download.status,
        data: {
          url: download.files?.[0]?.uris?.[0]?.uri || 'Unknown',
          name: download.files?.[0]?.path || 'Unknown',
          totalLength: download.totalLength,
          completedLength: download.completedLength,
        },
        progress: parseInt(download.totalLength) > 0 ?
          Math.round((parseInt(download.completedLength) / parseInt(download.totalLength)) * 100) : 0,
        createdAt: Date.now(), // Aria2 doesn't provide creation time
        processedAt: download.status === 'active' ? Date.now() : null,
        finishedAt: download.status === 'complete' ? Date.now() : null,
      };
    } catch (error) {
      throw new Error('Download not found');
    }
  }

  async getDownloadStatus(id: string) {
    try {
      const download = await this.aria2Service.getStatus(id);

      return {
        id: download.gid,
        status: download.status,
        progress: parseInt(download.totalLength) > 0 ?
          Math.round((parseInt(download.completedLength) / parseInt(download.totalLength)) * 100) : 0,
      };
    } catch (error) {
      throw new Error('Download not found');
    }
  }

  async pauseDownload(id: string) {
    try {
      // Try to pause using metadata service first (for grouped downloads)
      await this.downloadMetadataService.pauseDownload(id);

      return {
        success: true,
        message: 'Download paused',
      };
    } catch (metadataError) {
      // Fallback to direct Aria2 pause (for legacy compatibility)
      try {
        await this.aria2Service.pause(id);

        return {
          success: true,
          message: 'Download paused',
        };
      } catch (aria2Error) {
        throw new Error('Failed to pause download');
      }
    }
  }

  async resumeDownload(id: string) {
    try {
      // Try to resume using metadata service first (for grouped downloads)
      await this.downloadMetadataService.resumeDownload(id);

      return {
        success: true,
        message: 'Download resumed',
      };
    } catch (metadataError) {
      // Fallback to direct Aria2 resume (for legacy compatibility)
      try {
        await this.aria2Service.unpause(id);

        return {
          success: true,
          message: 'Download resumed',
        };
      } catch (aria2Error) {
        throw new Error('Failed to resume download');
      }
    }
  }

  async cancelDownload(id: string) {
    try {
      // Try to cancel using metadata service first (for grouped downloads)
      await this.downloadMetadataService.deleteDownloadMetadata(id);

      return {
        success: true,
        message: 'Download cancelled',
      };
    } catch (metadataError) {
      // Fallback to direct Aria2 removal (for legacy compatibility)
      try {
        await this.aria2Service.remove(id);

        return {
          success: true,
          message: 'Download cancelled',
        };
      } catch (aria2Error) {
        throw new Error('Failed to cancel download');
      }
    }
  }

  async getQueueStats() {
    // Get grouped downloads from metadata service
    const groupedDownloads = await this.downloadMetadataService.getGroupedDownloads();

    // Count downloads by status
    const active = groupedDownloads.filter(d => d.status === 'active').length;
    const waiting = groupedDownloads.filter(d => d.status === 'waiting').length;
    const completed = groupedDownloads.filter(d => d.status === 'complete').length;
    const failed = groupedDownloads.filter(d => d.status === 'error').length;

    return {
      waiting,
      active,
      completed,
      failed,
      total: groupedDownloads.length,
    };
  }

  async getAria2Stats() {
    try {
      return await this.aria2Service.getGlobalStat();
    } catch (error) {
      throw new Error('Failed to get Aria2 statistics');
    }
  }
}
