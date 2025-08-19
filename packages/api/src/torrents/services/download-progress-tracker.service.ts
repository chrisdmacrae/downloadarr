import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RequestedTorrentsService } from './requested-torrents.service';
import { Aria2Service } from '../../download/aria2.service';
import { PrismaService } from '../../database/prisma.service';
import { RequestStatus } from '../../../generated/prisma';

@Injectable()
export class DownloadProgressTrackerService {
  private readonly logger = new Logger(DownloadProgressTrackerService.name);

  constructor(
    private readonly requestedTorrentsService: RequestedTorrentsService,
    private readonly aria2Service: Aria2Service,
    private readonly prisma: PrismaService,
  ) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  async trackDownloadStatus(): Promise<void> {
    try {
      // Get all downloading requests
      const downloadingRequests = await this.requestedTorrentsService.getRequestsByStatus(RequestStatus.DOWNLOADING);

      if (downloadingRequests.length === 0) {
        return;
      }

      this.logger.debug(`Tracking status for ${downloadingRequests.length} downloads`);

      for (const request of downloadingRequests) {
        if (request.aria2Gid) {
          await this.checkDownloadStatus(request.id, request.aria2Gid);
        }
      }
    } catch (error) {
      this.logger.error('Error tracking download status:', error);
    }
  }

  private async checkDownloadStatus(requestId: string, aria2Gid: string): Promise<void> {
    try {
      const status = await this.aria2Service.getStatus(aria2Gid);

      if (!status) {
        this.logger.warn(`No status found for download ${aria2Gid}`);
        return;
      }

      // Check if download is complete or failed
      if (status.status === 'complete') {
        await this.handleDownloadCompletion(requestId, aria2Gid);
      } else if (status.status === 'error') {
        await this.handleDownloadFailure(requestId, aria2Gid, status.errorMessage);
      }

    } catch (error) {
      this.logger.error(`Error checking status for request ${requestId}:`, error);
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

      await this.checkDownloadStatus(requestId, request.aria2Gid);
    } catch (error) {
      this.logger.error(`Error syncing download status for ${requestId}:`, error);
      throw error;
    }
  }

  private async handleDownloadCompletion(requestId: string, aria2Gid: string): Promise<void> {
    try {
      // Find any TorrentDownload records associated with this aria2Gid
      const torrentDownloads = await this.prisma.torrentDownload.findMany({
        where: {
          aria2Gid: aria2Gid,
          status: 'DOWNLOADING',
        },
        include: {
          tvShowSeason: true,
          tvShowEpisode: {
            include: {
              tvShowSeason: true,
            },
          },
        },
      });

      if (torrentDownloads.length > 0) {
        // Handle TorrentDownload completion (TV shows with detailed tracking)
        for (const torrentDownload of torrentDownloads) {
          await this.completeTorrentDownload(torrentDownload);
        }
      } else {
        // Handle simple request completion (movies, games, or legacy downloads)
        await this.requestedTorrentsService.updateRequestStatus(requestId, RequestStatus.COMPLETED);
        this.logger.log(`Download completed for request ${requestId}`);
      }
    } catch (error) {
      this.logger.error(`Error handling download completion for request ${requestId}:`, error);
    }
  }

  private async handleDownloadFailure(requestId: string, aria2Gid: string, errorMessage?: string): Promise<void> {
    try {
      // Find any TorrentDownload records associated with this aria2Gid
      const torrentDownloads = await this.prisma.torrentDownload.findMany({
        where: {
          aria2Gid: aria2Gid,
          status: 'DOWNLOADING',
        },
        include: {
          tvShowSeason: true,
          tvShowEpisode: true,
        },
      });

      if (torrentDownloads.length > 0) {
        // Handle TorrentDownload failure (TV shows with detailed tracking)
        for (const torrentDownload of torrentDownloads) {
          await this.failTorrentDownload(torrentDownload);
        }
      } else {
        // Handle simple request failure (movies, games, or legacy downloads)
        await this.requestedTorrentsService.updateRequestStatus(requestId, RequestStatus.FAILED);
        this.logger.warn(`Download failed for request ${requestId}: ${errorMessage || 'Unknown error'}`);
      }
    } catch (error) {
      this.logger.error(`Error handling download failure for request ${requestId}:`, error);
    }
  }

  private async completeTorrentDownload(torrentDownload: any): Promise<void> {
    try {
      // Mark TorrentDownload as complete
      await this.prisma.torrentDownload.update({
        where: { id: torrentDownload.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          updatedAt: new Date(),
        },
      });

      this.logger.log(`TorrentDownload completed: ${torrentDownload.torrentTitle}`);

      // Update associated TV show status
      if (torrentDownload.tvShowSeasonId && !torrentDownload.tvShowEpisodeId) {
        // Season pack download
        await this.updateSeasonStatus(torrentDownload.tvShowSeasonId);
      } else if (torrentDownload.tvShowEpisodeId) {
        // Individual episode download
        await this.updateEpisodeStatus(torrentDownload.tvShowEpisodeId);
      } else {
        // Movie or game download
        await this.updateMainRequestStatus(torrentDownload.requestedTorrentId);
      }
    } catch (error) {
      this.logger.error(`Error completing TorrentDownload ${torrentDownload.id}:`, error);
    }
  }

  private async failTorrentDownload(torrentDownload: any): Promise<void> {
    try {
      // Mark TorrentDownload as failed
      await this.prisma.torrentDownload.update({
        where: { id: torrentDownload.id },
        data: {
          status: 'FAILED',
          updatedAt: new Date(),
        },
      });

      this.logger.warn(`TorrentDownload failed: ${torrentDownload.torrentTitle}`);

      // Update associated TV show status
      if (torrentDownload.tvShowSeasonId && !torrentDownload.tvShowEpisodeId) {
        // Season pack download
        await this.updateSeasonStatus(torrentDownload.tvShowSeasonId);
      } else if (torrentDownload.tvShowEpisodeId) {
        // Individual episode download
        await this.updateEpisodeStatus(torrentDownload.tvShowEpisodeId);
      } else {
        // Movie or game download
        await this.updateMainRequestStatus(torrentDownload.requestedTorrentId);
      }
    } catch (error) {
      this.logger.error(`Error failing TorrentDownload ${torrentDownload.id}:`, error);
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

              // Calculate progress from aria2 status
              const totalLength = parseInt(status.totalLength) || 0;
              const completedLength = parseInt(status.completedLength) || 0;
              const progress = totalLength > 0 ? Math.round((completedLength / totalLength) * 100) : 0;

              totalProgress += progress;
              validProgressCount++;
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

  private async updateSeasonStatus(seasonId: string): Promise<void> {
    try {
      // Check if all torrent downloads for this season are complete
      const seasonDownloads = await this.prisma.torrentDownload.findMany({
        where: {
          tvShowSeasonId: seasonId,
        },
      });

      const allComplete = seasonDownloads.every(download => download.status === 'COMPLETED');
      const anyFailed = seasonDownloads.some(download => download.status === 'FAILED');

      let newStatus: string;
      if (anyFailed) {
        newStatus = 'FAILED';
      } else if (allComplete) {
        newStatus = 'COMPLETED';
      } else {
        // Still downloading
        return;
      }

      await this.prisma.tvShowSeason.update({
        where: { id: seasonId },
        data: {
          status: newStatus as any,
          updatedAt: new Date(),
        },
      });

      this.logger.log(`Updated season ${seasonId} status to ${newStatus}`);

      // If this was a season pack, also update all episodes in the season
      if (newStatus === 'COMPLETED') {
        await this.prisma.tvShowEpisode.updateMany({
          where: { tvShowSeasonId: seasonId },
          data: {
            status: 'COMPLETED',
            updatedAt: new Date(),
          },
        });
        this.logger.log(`Updated all episodes in season ${seasonId} to COMPLETED`);
      }

    } catch (error) {
      this.logger.error(`Error updating season status for ${seasonId}:`, error);
    }
  }

  private async updateEpisodeStatus(episodeId: string): Promise<void> {
    try {
      // Check if all torrent downloads for this episode are complete
      const episodeDownloads = await this.prisma.torrentDownload.findMany({
        where: {
          tvShowEpisodeId: episodeId,
        },
      });

      const allComplete = episodeDownloads.every(download => download.status === 'COMPLETED');
      const anyFailed = episodeDownloads.some(download => download.status === 'FAILED');

      let newStatus: string;
      if (anyFailed) {
        newStatus = 'FAILED';
      } else if (allComplete) {
        newStatus = 'COMPLETED';
      } else {
        // Still downloading
        return;
      }

      await this.prisma.tvShowEpisode.update({
        where: { id: episodeId },
        data: {
          status: newStatus as any,
          updatedAt: new Date(),
        },
      });

      this.logger.log(`Updated episode ${episodeId} status to ${newStatus}`);

    } catch (error) {
      this.logger.error(`Error updating episode status for ${episodeId}:`, error);
    }
  }

  private async updateMainRequestStatus(requestId: string): Promise<void> {
    try {
      // Check if all torrent downloads for this request are complete
      const requestDownloads = await this.prisma.torrentDownload.findMany({
        where: {
          requestedTorrentId: requestId,
        },
      });

      const allComplete = requestDownloads.every(download => download.status === 'COMPLETED');
      const anyFailed = requestDownloads.some(download => download.status === 'FAILED');

      let newStatus: string;
      if (anyFailed) {
        newStatus = 'FAILED';
      } else if (allComplete) {
        newStatus = 'COMPLETED';
      } else {
        // Still downloading
        return;
      }

      await this.prisma.requestedTorrent.update({
        where: { id: requestId },
        data: {
          status: newStatus as any,
          completedAt: newStatus === 'COMPLETED' ? new Date() : null,
          updatedAt: new Date(),
        },
      });

      this.logger.log(`Updated main request ${requestId} status to ${newStatus}`);

    } catch (error) {
      this.logger.error(`Error updating main request status for ${requestId}:`, error);
    }
  }
}
