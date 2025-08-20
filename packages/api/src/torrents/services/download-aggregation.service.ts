import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Aria2Service } from '../../download/aria2.service';
import { RequestStatus, RequestedTorrent } from '../../../generated/prisma';

export interface AggregatedDownloadStatus {
  requestId: string;
  status: RequestStatus;
  progress: number;
  downloadSpeed: string;
  eta: string;
  totalSize: number;
  completedSize: number;
  files: Array<{
    path: string;
    size: number;
    completedSize: number;
    progress: number;
  }>;
  torrentDownloads: Array<{
    id: string;
    title: string;
    status: string;
    progress: number;
    speed: string;
    eta: string;
  }>;
}

export interface RequestDownloadSummary {
  totalRequests: number;
  downloading: number;
  completed: number;
  failed: number;
  totalProgress: number;
  totalSpeed: string;
}

@Injectable()
export class DownloadAggregationService {
  private readonly logger = new Logger(DownloadAggregationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aria2Service: Aria2Service,
  ) {}

  /**
   * Get aggregated download status for a specific request
   * This fetches live data from aria2 instead of storing it in the database
   */
  async getRequestDownloadStatus(requestId: string): Promise<AggregatedDownloadStatus | null> {
    const request = await this.prisma.requestedTorrent.findUnique({
      where: { id: requestId },
      include: {
        torrentDownloads: true,
      },
    });

    if (!request) {
      return null;
    }

    // If request is not downloading, return basic status
    if (request.status !== RequestStatus.DOWNLOADING) {
      return {
        requestId,
        status: request.status,
        progress: request.status === RequestStatus.COMPLETED ? 100 : 0,
        downloadSpeed: '0',
        eta: '0',
        totalSize: 0,
        completedSize: 0,
        files: [],
        torrentDownloads: [],
      };
    }

    // Aggregate status from all torrent downloads for this request
    const torrentDownloadStatuses = await Promise.all(
      request.torrentDownloads.map(async (torrentDownload) => {
        if (!torrentDownload.aria2Gid) {
          return {
            id: torrentDownload.id,
            title: torrentDownload.torrentTitle,
            status: torrentDownload.status,
            progress: 0,
            speed: '0',
            eta: '0',
          };
        }

        try {
          const aria2Status = await this.aria2Service.getStatus(torrentDownload.aria2Gid);

          // Use the proper progress calculation that handles torrents with child downloads
          const progressInfo = await this.getDownloadProgress(torrentDownload.aria2Gid);

          return {
            id: torrentDownload.id,
            title: torrentDownload.torrentTitle,
            status: aria2Status.status,
            progress: progressInfo.progress,
            speed: aria2Status.downloadSpeed || '0',
            eta: progressInfo.eta,
          };
        } catch (error) {
          this.logger.debug(`Error getting aria2 status for ${torrentDownload.aria2Gid}:`, error);
          return {
            id: torrentDownload.id,
            title: torrentDownload.torrentTitle,
            status: 'error',
            progress: 0,
            speed: '0',
            eta: '0',
          };
        }
      })
    );

    // Calculate aggregate progress and speed
    let totalSize = 0;
    let completedSize = 0;
    let totalSpeedBytes = 0;
    const files: Array<{ path: string; size: number; completedSize: number; progress: number }> = [];

    // Get detailed file information from aria2
    for (const torrentDownload of request.torrentDownloads) {
      if (torrentDownload.aria2Gid) {
        try {
          const aria2Status = await this.aria2Service.getStatus(torrentDownload.aria2Gid);

          // For torrents, check child downloads for actual file information
          if (aria2Status.followedBy && aria2Status.followedBy.length > 0) {
            for (const childGid of aria2Status.followedBy) {
              try {
                const childStatus = await this.aria2Service.getStatus(childGid);

                if (childStatus.files) {
                  for (const file of childStatus.files) {
                    const fileSize = parseInt(file.length) || 0;
                    const fileCompleted = parseInt(file.completedLength) || 0;
                    const fileProgress = fileSize > 0 ? Math.round((fileCompleted / fileSize) * 100) : 0;

                    files.push({
                      path: file.path || 'Unknown',
                      size: fileSize,
                      completedSize: fileCompleted,
                      progress: fileProgress,
                    });

                    totalSize += fileSize;
                    completedSize += fileCompleted;
                  }
                }

                totalSpeedBytes += parseInt(childStatus.downloadSpeed) || 0;
              } catch (childError) {
                this.logger.debug(`Error getting child file details for ${childGid}:`, childError);
              }
            }
          } else {
            // For non-torrent downloads, use main download files
            if (aria2Status.files) {
              for (const file of aria2Status.files) {
                const fileSize = parseInt(file.length) || 0;
                const fileCompleted = parseInt(file.completedLength) || 0;
                const fileProgress = fileSize > 0 ? Math.round((fileCompleted / fileSize) * 100) : 0;

                files.push({
                  path: file.path || 'Unknown',
                  size: fileSize,
                  completedSize: fileCompleted,
                  progress: fileProgress,
                });

                totalSize += fileSize;
                completedSize += fileCompleted;
              }
            }

            totalSpeedBytes += parseInt(aria2Status.downloadSpeed) || 0;
          }
        } catch (error) {
          this.logger.debug(`Error getting file details for ${torrentDownload.aria2Gid}:`, error);
        }
      }
    }

    const overallProgress = totalSize > 0 ? Math.round((completedSize / totalSize) * 100) : 0;
    const overallSpeed = this.formatSpeed(totalSpeedBytes);
    const eta = this.calculateETA(totalSize, completedSize, totalSpeedBytes);

    return {
      requestId,
      status: request.status,
      progress: overallProgress,
      downloadSpeed: overallSpeed,
      eta,
      totalSize,
      completedSize,
      files,
      torrentDownloads: torrentDownloadStatuses,
    };
  }

  /**
   * Get download summary for all requests
   */
  async getRequestDownloadSummary(): Promise<RequestDownloadSummary> {
    const downloadingRequests = await this.prisma.requestedTorrent.findMany({
      where: {
        status: RequestStatus.DOWNLOADING,
      },
      include: {
        torrentDownloads: true,
      },
    });

    let totalProgress = 0;
    let totalSpeedBytes = 0;
    let validProgressCount = 0;

    for (const request of downloadingRequests) {
      const status = await this.getRequestDownloadStatus(request.id);
      if (status) {
        totalProgress += status.progress;
        totalSpeedBytes += parseInt(status.downloadSpeed.replace(/[^0-9]/g, '')) || 0;
        validProgressCount++;
      }
    }

    const avgProgress = validProgressCount > 0 ? Math.round(totalProgress / validProgressCount) : 0;
    const totalSpeed = this.formatSpeed(totalSpeedBytes);

    // Get counts for all request statuses
    const statusCounts = await this.prisma.requestedTorrent.groupBy({
      by: ['status'],
      _count: {
        status: true,
      },
    });

    const counts = {
      downloading: 0,
      completed: 0,
      failed: 0,
      total: 0,
    };

    for (const statusCount of statusCounts) {
      counts.total += statusCount._count.status;
      
      switch (statusCount.status) {
        case RequestStatus.DOWNLOADING:
          counts.downloading = statusCount._count.status;
          break;
        case RequestStatus.COMPLETED:
          counts.completed = statusCount._count.status;
          break;
        case RequestStatus.FAILED:
          counts.failed = statusCount._count.status;
          break;
      }
    }

    return {
      totalRequests: counts.total,
      downloading: counts.downloading,
      completed: counts.completed,
      failed: counts.failed,
      totalProgress: avgProgress,
      totalSpeed,
    };
  }

  /**
   * Check if a download is actually complete by verifying with aria2
   * For torrents, this checks both metadata and all child files
   */
  async isDownloadComplete(aria2Gid: string): Promise<boolean> {
    try {
      const status = await this.aria2Service.getStatus(aria2Gid);

      // If main download is not complete, definitely not done
      if (status.status !== 'complete') {
        return false;
      }

      // For torrents, we need to check if there are child downloads (actual content files)
      // and ensure they are all complete too
      if (status.followedBy && status.followedBy.length > 0) {
        this.logger.debug(`Checking ${status.followedBy.length} child downloads for torrent ${aria2Gid}`);

        for (const childGid of status.followedBy) {
          try {
            const childStatus = await this.aria2Service.getStatus(childGid);
            if (childStatus.status !== 'complete') {
              this.logger.debug(`Child download ${childGid} is ${childStatus.status}, torrent not complete yet`);
              return false;
            }
          } catch (childError) {
            this.logger.debug(`Error checking child download ${childGid}:`, childError);
            // If we can't get child status, assume it's not complete
            return false;
          }
        }

        this.logger.debug(`All child downloads complete for torrent ${aria2Gid}`);
        return true;
      }

      // If no child downloads, the main download completion is sufficient
      return true;
    } catch (error) {
      this.logger.debug(`Error checking completion status for ${aria2Gid}:`, error);
      return false;
    }
  }

  /**
   * Check if a download has failed by verifying with aria2
   */
  async isDownloadFailed(aria2Gid: string): Promise<{ failed: boolean; reason?: string }> {
    try {
      const status = await this.aria2Service.getStatus(aria2Gid);
      return {
        failed: status.status === 'error',
        reason: status.errorMessage,
      };
    } catch (error) {
      this.logger.debug(`Error checking failure status for ${aria2Gid}:`, error);
      return { failed: true, reason: 'Unable to get download status' };
    }
  }

  /**
   * Get live progress for a specific aria2 download
   * For torrents, this aggregates progress from all child downloads
   */
  async getDownloadProgress(aria2Gid: string): Promise<{
    progress: number;
    speed: string;
    eta: string;
    totalSize: number;
    completedSize: number;
  }> {
    try {
      const status = await this.aria2Service.getStatus(aria2Gid);

      // For torrents with child downloads, aggregate from children
      if (status.followedBy && status.followedBy.length > 0) {
        let totalSize = 0;
        let completedSize = 0;
        let totalSpeed = 0;

        for (const childGid of status.followedBy) {
          try {
            const childStatus = await this.aria2Service.getStatus(childGid);
            totalSize += parseInt(childStatus.totalLength) || 0;
            completedSize += parseInt(childStatus.completedLength) || 0;
            totalSpeed += parseInt(childStatus.downloadSpeed) || 0;
          } catch (childError) {
            this.logger.debug(`Error getting child download progress for ${childGid}:`, childError);
          }
        }

        const progress = totalSize > 0 ? Math.round((completedSize / totalSize) * 100) : 0;
        const speed = this.formatSpeed(totalSpeed);
        const eta = this.calculateETA(totalSize, completedSize, totalSpeed);

        return {
          progress,
          speed,
          eta,
          totalSize,
          completedSize,
        };
      }

      // For non-torrent downloads, use main download stats
      const totalLength = parseInt(status.totalLength) || 0;
      const completedLength = parseInt(status.completedLength) || 0;
      const progress = totalLength > 0 ? Math.round((completedLength / totalLength) * 100) : 0;
      const speed = this.formatSpeed(parseInt(status.downloadSpeed) || 0);
      const eta = this.calculateETA(totalLength, completedLength, parseInt(status.downloadSpeed) || 0);

      return {
        progress,
        speed,
        eta,
        totalSize: totalLength,
        completedSize: completedLength,
      };
    } catch (error) {
      this.logger.debug(`Error getting progress for ${aria2Gid}:`, error);
      return {
        progress: 0,
        speed: '0 B/s',
        eta: '∞',
        totalSize: 0,
        completedSize: 0,
      };
    }
  }

  private formatSpeed(bytesPerSecond: number): string {
    if (bytesPerSecond === 0) return '0 B/s';
    
    const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    let size = bytesPerSecond;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  private calculateETA(totalSize: number, completedSize: number, speedBytesPerSecond: number): string {
    if (speedBytesPerSecond === 0 || totalSize === 0 || completedSize >= totalSize) {
      return '∞';
    }

    const remainingBytes = totalSize - completedSize;
    const etaSeconds = Math.round(remainingBytes / speedBytesPerSecond);

    if (etaSeconds < 60) {
      return `${etaSeconds}s`;
    } else if (etaSeconds < 3600) {
      return `${Math.round(etaSeconds / 60)}m`;
    } else {
      const hours = Math.floor(etaSeconds / 3600);
      const minutes = Math.round((etaSeconds % 3600) / 60);
      return `${hours}h ${minutes}m`;
    }
  }
}
