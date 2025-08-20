import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../database/prisma.service';
import { Aria2Service } from './aria2.service';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface GroupedDownload {
  id: string;
  name: string;
  originalUrl: string;
  type: string;
  mediaType?: string;
  mediaTitle?: string;
  mediaYear?: number;
  mediaPoster?: string;
  mediaOverview?: string;
  status: string;
  totalSize: number;
  completedSize: number;
  progress: number;
  downloadSpeed: number;
  files: Array<{
    name: string;
    size: number;
    completed: number;
    progress: number;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class DownloadMetadataService {
  private readonly logger = new Logger(DownloadMetadataService.name);

  // Lazy injection to avoid circular dependency
  private orchestrator: any;

  constructor(
    private prisma: PrismaService,
    private aria2Service: Aria2Service,
  ) {}

  // Method to set orchestrator (called from TorrentsModule)
  setOrchestrator(orchestrator: any) {
    this.orchestrator = orchestrator;
  }

  async createDownloadMetadata(data: {
    name: string;
    originalUrl: string;
    type: 'magnet' | 'torrent' | 'http' | 'https';
    aria2Gid: string;
    destination?: string;
    mediaType?: 'movie' | 'tv' | 'game';
    mediaTitle?: string;
    mediaYear?: number;
    mediaPoster?: string;
    mediaOverview?: string;
  }) {
    const typeMap: Record<string, string> = {
      'magnet': 'MAGNET',
      'torrent': 'TORRENT',
      'http': 'HTTP',
      'https': 'HTTPS',
    };

    const mediaTypeMap: Record<string, string> = {
      'movie': 'MOVIE',
      'tv': 'TV',
      'game': 'GAME',
    };

    return this.prisma.downloadMetadata.create({
      data: {
        name: data.name,
        originalUrl: data.originalUrl,
        type: typeMap[data.type] as any,
        aria2Gid: data.aria2Gid,
        destination: data.destination,
        mediaType: data.mediaType ? (mediaTypeMap[data.mediaType] as any) : null,
        mediaTitle: data.mediaTitle,
        mediaYear: data.mediaYear,
        mediaPoster: data.mediaPoster,
        mediaOverview: data.mediaOverview,
        aria2ChildGids: [],
        status: 'ACTIVE' as any,
      },
    });
  }

  async updateChildGids(id: string, childGids: string[]): Promise<void> {
    await this.prisma.downloadMetadata.update({
      where: { id },
      data: { aria2ChildGids: childGids },
    });
  }

  @Cron('* * * * * *') // Every second
  async syncChildGids(): Promise<void> {
    try {
      // Get all downloads that might need child GID updates
      // Include both ACTIVE and COMPLETE downloads since metadata might complete before child files
      const activeDownloads = await this.prisma.downloadMetadata.findMany({
        where: {
          OR: [
            { status: 'ACTIVE' },
            { status: 'COMPLETE' },
            { status: 'WAITING' }
          ],
          // Only check downloads that don't have child GIDs yet
          aria2ChildGids: { equals: [] }
        }
      });

      if (activeDownloads.length > 0) {
        this.logger.debug(`Checking ${activeDownloads.length} downloads for child GIDs`);
      }

      for (const download of activeDownloads) {
        try {
          this.logger.debug(`Checking download ${download.name} (GID: ${download.aria2Gid}) for child GIDs`);

          // Get the main status to check if it has child GIDs (followedBy or following)
          const mainStatus = await this.aria2Service.getStatus(download.aria2Gid);

          this.logger.debug(`Aria2 status for ${download.name}: status=${mainStatus?.status}, followedBy=${mainStatus?.followedBy}, following=${mainStatus?.following}`);

          // Check for both followedBy (completed torrents) and following (active torrents)
          const childGids = mainStatus?.followedBy || (mainStatus?.following ? [mainStatus.following] : []);

          if (childGids.length > 0) {
            // Update the child GIDs in the database
            await this.updateChildGids(download.id, childGids);
            this.logger.log(`Updated child GIDs for download ${download.name}: ${childGids.join(', ')}`);
          } else {
            this.logger.debug(`No child GIDs found for download ${download.name}`);
          }
        } catch (error) {
          // Don't log errors for individual downloads as they might be completed/removed
          this.logger.debug(`Could not sync child GIDs for download ${download.id}: ${error.message}`);
        }
      }
    } catch (error) {
      this.logger.error('Error syncing child GIDs:', error);
    }
  }

  async getGroupedDownloads(): Promise<GroupedDownload[]> {
    const metadataList = await this.prisma.downloadMetadata.findMany({
      orderBy: { createdAt: 'desc' },
    });

    const groupedDownloads: GroupedDownload[] = [];

    for (const metadata of metadataList) {
      try {
        // Get status of main torrent
        const mainStatus = await this.aria2Service.getStatus(metadata.aria2Gid);
        
        // Get status of all child files
        const childStatuses = await Promise.all(
          metadata.aria2ChildGids.map(async (gid) => {
            try {
              return await this.aria2Service.getStatus(gid);
            } catch {
              return null; // Child might be removed or not exist
            }
          })
        );

        const validChildStatuses = childStatuses.filter(Boolean);

        // Calculate aggregated stats
        // For torrents, we should only consider child files (actual content), not the metadata
        let totalSize, completedSize, progress;

        if (validChildStatuses.length > 0) {
          // Use only child files for progress calculation (actual content)
          totalSize = validChildStatuses.reduce(
            (sum, child) => sum + parseInt(child.totalLength || '0'),
            0
          );

          completedSize = validChildStatuses.reduce(
            (sum, child) => sum + parseInt(child.completedLength || '0'),
            0
          );

          progress = totalSize > 0 ? Math.round((completedSize / totalSize) * 100) : 0;
        } else {
          // Check if this is a torrent that has completed metadata but no child files yet
          const isMetadataOnly = mainStatus.bittorrent &&
                                 mainStatus.status === 'complete' &&
                                 parseInt(mainStatus.totalLength || '0') < 100000; // Less than 100KB indicates metadata only

          if (isMetadataOnly) {
            // Torrent metadata is complete but actual files haven't started downloading yet
            totalSize = 0;
            completedSize = 0;
            progress = 0; // Show 0% until child files are detected
          } else {
            // Fallback to main status for non-torrent downloads or actual small files
            totalSize = parseInt(mainStatus.totalLength || '0');
            completedSize = parseInt(mainStatus.completedLength || '0');
            progress = totalSize > 0 ? Math.round((completedSize / totalSize) * 100) : 0;
          }
        }

        // Calculate download speed (sum of all active downloads)
        // Only consider child files for download speed, not metadata
        let downloadSpeed;
        if (validChildStatuses.length > 0) {
          downloadSpeed = validChildStatuses
            .filter(child => child.status === 'active')
            .reduce((sum, child) => sum + parseInt(child.downloadSpeed || '0'), 0);
        } else {
          // Fallback to main status for non-torrent downloads
          downloadSpeed = mainStatus.status === 'active' ? parseInt(mainStatus.downloadSpeed || '0') : 0;
        }

        // Determine overall status
        let overallStatus = mainStatus.status;
        if (validChildStatuses.length > 0) {
          const hasActive = validChildStatuses.some(child => child.status === 'active');
          const hasError = validChildStatuses.some(child => child.status === 'error');
          const allComplete = validChildStatuses.every(child => child.status === 'complete');

          if (hasError) overallStatus = 'error';
          else if (hasActive) overallStatus = 'active';
          else if (allComplete && mainStatus.status === 'complete') overallStatus = 'complete';
        } else {
          // Check if this is a torrent that has completed metadata but no child files yet
          const isMetadataOnly = mainStatus.bittorrent &&
                                 mainStatus.status === 'complete' &&
                                 parseInt(mainStatus.totalLength || '0') < 100000; // Less than 100KB indicates metadata only

          if (isMetadataOnly) {
            overallStatus = 'waiting'; // Show as waiting until child files are detected
          }
        }

        // Create file list
        const files = validChildStatuses.map(child => ({
          name: child.files?.[0]?.path?.split('/').pop() || 'Unknown',
          size: parseInt(child.totalLength || '0'),
          completed: parseInt(child.completedLength || '0'),
          progress: parseInt(child.totalLength || '0') > 0 ? 
            Math.round((parseInt(child.completedLength || '0') / parseInt(child.totalLength || '0')) * 100) : 0,
        }));

        groupedDownloads.push({
          id: metadata.id,
          name: metadata.name,
          originalUrl: metadata.originalUrl,
          type: metadata.type,
          mediaType: metadata.mediaType,
          mediaTitle: metadata.mediaTitle,
          mediaYear: metadata.mediaYear,
          mediaPoster: metadata.mediaPoster,
          mediaOverview: metadata.mediaOverview,
          status: overallStatus,
          totalSize,
          completedSize,
          progress,
          downloadSpeed,
          files,
          createdAt: metadata.createdAt,
          updatedAt: metadata.updatedAt,
        });

        // Update metadata status
        const statusMap: Record<string, string> = {
          'active': 'ACTIVE',
          'waiting': 'WAITING',
          'paused': 'PAUSED',
          'error': 'ERROR',
          'complete': 'COMPLETE',
          'removed': 'REMOVED',
        };

        const wasNotComplete = metadata.status !== 'COMPLETE';
        const isNowComplete = overallStatus === 'complete';

        if (metadata.status !== statusMap[overallStatus]) {
          await this.prisma.downloadMetadata.update({
            where: { id: metadata.id },
            data: { status: statusMap[overallStatus] as any },
          });

          // If download just completed, handle completion properly
          if (wasNotComplete && isNowComplete) {
            await this.handleDownloadCompletion(metadata.id, metadata.aria2Gid);
          }
        }

      } catch (error) {
        // If we can't get Aria2 status, mark as error
        groupedDownloads.push({
          id: metadata.id,
          name: metadata.name,
          originalUrl: metadata.originalUrl,
          type: metadata.type,
          mediaType: metadata.mediaType,
          mediaTitle: metadata.mediaTitle,
          mediaYear: metadata.mediaYear,
          mediaPoster: metadata.mediaPoster,
          mediaOverview: metadata.mediaOverview,
          status: 'error',
          totalSize: 0,
          completedSize: 0,
          progress: 0,
          downloadSpeed: 0,
          files: [],
          createdAt: metadata.createdAt,
          updatedAt: metadata.updatedAt,
        });
      }
    }

    return groupedDownloads;
  }

  private async handleDownloadCompletion(downloadMetadataId: string, aria2Gid: string): Promise<void> {
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
        // Let the DownloadProgressTrackerService handle TorrentDownload completion
        // This avoids race conditions between services
        this.logger.debug(`TorrentDownload records found for aria2Gid ${aria2Gid}, letting DownloadProgressTrackerService handle completion`);
        return;
      }

      // Handle legacy completion for downloads without TorrentDownload records
      const torrentRequest = await this.prisma.requestedTorrent.findFirst({
        where: {
          downloadJobId: downloadMetadataId,
          status: 'DOWNLOADING'
        }
      });

      if (torrentRequest) {
        await this.prisma.requestedTorrent.update({
          where: { id: torrentRequest.id },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
            updatedAt: new Date(),
          }
        });

        this.logger.log(`Marked legacy torrent request ${torrentRequest.id} (${torrentRequest.title}) as complete`);
      } else {
        this.logger.debug(`No related torrent request found for download metadata ${downloadMetadataId}`);
      }
    } catch (error) {
      this.logger.error(`Error handling download completion for download ${downloadMetadataId}:`, error);
    }
  }

  async deleteDownloadMetadata(id: string): Promise<void> {
    const metadata = await this.prisma.downloadMetadata.findUnique({
      where: { id }
    });

    if (!metadata) {
      throw new Error('Download metadata not found');
    }

    // Update related torrent requests IMMEDIATELY to prevent race conditions
    // with the cron job that might mark requests as complete
    await this.updateRelatedTorrentRequestsOnDeletion(id, metadata.aria2Gid);

    // Collect file paths before removing from Aria2
    const filesToDelete: string[] = [];

    try {
      // Get main download file paths
      const mainStatus = await this.aria2Service.getStatus(metadata.aria2Gid);
      if (mainStatus && mainStatus.files) {
        for (const file of mainStatus.files) {
          if (file.path) {
            filesToDelete.push(file.path);
          }
        }
      }
    } catch (error) {
      this.logger.debug(`Could not get main download files for ${metadata.aria2Gid}: ${error.message}`);
    }

    // Get child download file paths
    for (const childGid of metadata.aria2ChildGids) {
      try {
        const childStatus = await this.aria2Service.getStatus(childGid);
        if (childStatus && childStatus.files) {
          for (const file of childStatus.files) {
            if (file.path) {
              filesToDelete.push(file.path);
            }
          }
        }
      } catch (error) {
        this.logger.debug(`Could not get child download files for ${childGid}: ${error.message}`);
      }
    }

    // Remove from Aria2 first (use forceRemove for thorough cleanup)
    try {
      await this.aria2Service.forceRemove(metadata.aria2Gid);
    } catch (error) {
      this.logger.debug(`Could not remove main download ${metadata.aria2Gid}: ${error.message}`);
    }

    for (const childGid of metadata.aria2ChildGids) {
      try {
        await this.aria2Service.forceRemove(childGid);
      } catch (error) {
        this.logger.debug(`Could not remove child download ${childGid}: ${error.message}`);
      }
    }

    // Delete actual files from disk
    await this.deleteFiles(filesToDelete, metadata.name);

    // Remove from database
    await this.prisma.downloadMetadata.delete({ where: { id } });

    this.logger.log(`Successfully deleted download ${metadata.name} and cleaned up ${filesToDelete.length} files`);
  }

  private async deleteFiles(filePaths: string[], downloadName: string): Promise<void> {
    const deletedFiles: string[] = [];
    const failedFiles: string[] = [];

    for (const filePath of filePaths) {
      try {
        // Check if file exists before trying to delete
        await fs.access(filePath);
        await fs.unlink(filePath);
        deletedFiles.push(filePath);
        this.logger.debug(`Deleted file: ${filePath}`);
      } catch (error) {
        if (error.code === 'ENOENT') {
          this.logger.debug(`File already deleted or doesn't exist: ${filePath}`);
        } else {
          failedFiles.push(filePath);
          this.logger.warn(`Failed to delete file ${filePath}: ${error.message}`);
        }
      }
    }

    // Try to clean up empty directories
    const directories = new Set<string>();
    for (const filePath of [...deletedFiles, ...filePaths]) {
      const dir = path.dirname(filePath);
      directories.add(dir);
    }

    for (const dir of directories) {
      try {
        // Only delete if directory is empty
        const files = await fs.readdir(dir);
        if (files.length === 0) {
          await fs.rmdir(dir);
          this.logger.debug(`Deleted empty directory: ${dir}`);
        }
      } catch (error) {
        // Ignore directory deletion errors
        this.logger.debug(`Could not delete directory ${dir}: ${error.message}`);
      }
    }

    if (deletedFiles.length > 0) {
      this.logger.log(`Deleted ${deletedFiles.length} files for download: ${downloadName}`);
    }

    if (failedFiles.length > 0) {
      this.logger.warn(`Failed to delete ${failedFiles.length} files for download: ${downloadName}`);
    }
  }

  async pauseDownload(id: string): Promise<void> {
    const metadata = await this.prisma.downloadMetadata.findUnique({
      where: { id }
    });

    if (!metadata) {
      throw new Error('Download metadata not found');
    }

    // Pause main download
    try {
      await this.aria2Service.pause(metadata.aria2Gid);
    } catch {
      // Ignore if already paused or removed
    }

    // Pause all child downloads
    for (const childGid of metadata.aria2ChildGids) {
      try {
        await this.aria2Service.pause(childGid);
      } catch {
        // Ignore if already paused or removed
      }
    }
  }

  async resumeDownload(id: string): Promise<void> {
    const metadata = await this.prisma.downloadMetadata.findUnique({
      where: { id }
    });

    if (!metadata) {
      throw new Error('Download metadata not found');
    }

    // Resume main download
    try {
      await this.aria2Service.unpause(metadata.aria2Gid);
    } catch {
      // Ignore if already active or removed
    }

    // Resume all child downloads
    for (const childGid of metadata.aria2ChildGids) {
      try {
        await this.aria2Service.unpause(childGid);
      } catch {
        // Ignore if already active or removed
      }
    }
  }

  /**
   * Update related torrent requests when a download is deleted
   */
  private async updateRelatedTorrentRequestsOnDeletion(downloadMetadataId: string, aria2Gid: string): Promise<void> {
    try {
      // Find torrent requests that are linked to this download
      // They can be linked by either downloadJobId (metadata ID) or aria2Gid
      const relatedRequests = await this.prisma.requestedTorrent.findMany({
        where: {
          OR: [
            { downloadJobId: downloadMetadataId },
            { aria2Gid: aria2Gid }
          ]
        }
      });

      if (relatedRequests.length === 0) {
        this.logger.debug(`No related torrent requests found for download metadata ${downloadMetadataId}`);
        return;
      }

      // Update each related request using orchestrator if available
      for (const request of relatedRequests) {
        try {
          // Determine the appropriate action based on current request status
          if (request.status === 'COMPLETED') {
            // If it was already completed, leave it as completed
            this.logger.debug(`Skipping completed request ${request.id} (${request.title})`);
            continue;
          }

          if (this.orchestrator) {
            // Use orchestrator for proper state transitions
            if (request.status === 'DOWNLOADING') {
              // If it was actively downloading, mark as cancelled since it was manually deleted
              await this.orchestrator.markAsCancelled(request.id, 'Download manually deleted by user');
              this.logger.log(`Cancelled torrent request ${request.id} (${request.title}) due to download deletion`);
            } else {
              // For other statuses, also mark as cancelled
              await this.orchestrator.markAsCancelled(request.id, 'Associated download was deleted');
              this.logger.log(`Cancelled torrent request ${request.id} (${request.title}) due to download deletion`);
            }
          } else {
            // Fallback to direct database update if orchestrator not available
            const newStatus = request.status === 'DOWNLOADING' ? 'FAILED' : 'CANCELLED';

            await this.prisma.requestedTorrent.update({
              where: { id: request.id },
              data: {
                status: newStatus as any,
                downloadJobId: null,
                aria2Gid: null,
                updatedAt: new Date(),
              }
            });

            this.logger.log(`Updated torrent request ${request.id} (${request.title}) status to ${newStatus} due to download deletion (fallback)`);
          }
        } catch (requestError) {
          this.logger.error(`Error updating individual request ${request.id}:`, requestError);
          // Continue with other requests
        }
      }

    } catch (error) {
      this.logger.error(`Error updating related torrent requests for download ${downloadMetadataId}:`, error);
      // Don't throw the error to avoid blocking the download deletion
    }
  }
}
