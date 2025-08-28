import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RequestedTorrentsService } from './requested-torrents.service';
import { RequestLifecycleOrchestrator } from './request-lifecycle-orchestrator.service';
import { DownloadAggregationService } from './download-aggregation.service';
import { Aria2Service } from '../../download/aria2.service';
import { PrismaService } from '../../database/prisma.service';
import { OrganizationRulesService } from '../../organization/services/organization-rules.service';
import { FileOrganizationService } from '../../organization/services/file-organization.service';
import { RequestStatus, ContentType } from '../../../generated/prisma';

@Injectable()
export class DownloadProgressTrackerService {
  private readonly logger = new Logger(DownloadProgressTrackerService.name);

  constructor(
    private readonly requestedTorrentsService: RequestedTorrentsService,
    private readonly orchestrator: RequestLifecycleOrchestrator,
    private readonly downloadAggregationService: DownloadAggregationService,
    private readonly aria2Service: Aria2Service,
    private readonly prisma: PrismaService,
    private readonly organizationRulesService: OrganizationRulesService,
    private readonly fileOrganizationService: FileOrganizationService,
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
      // Use aggregation service to check completion status
      const isComplete = await this.downloadAggregationService.isDownloadComplete(aria2Gid);
      const failureStatus = await this.downloadAggregationService.isDownloadFailed(aria2Gid);

      if (isComplete) {
        await this.handleDownloadCompletion(requestId, aria2Gid);
      } else if (failureStatus.failed) {
        await this.handleDownloadFailure(requestId, aria2Gid, failureStatus.reason);
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
      });

      if (torrentDownloads.length > 0) {
        // Handle TorrentDownload completion (TV shows with detailed tracking)
        for (const torrentDownload of torrentDownloads) {
          await this.completeTorrentDownload(torrentDownload);
        }
      } else {
        // Handle simple request completion (movies, games, or legacy downloads)
        // First, try to organize the downloaded files
        await this.organizeDownloadedFiles(requestId, aria2Gid);

        await this.orchestrator.markAsCompleted(requestId);
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

      });

      if (torrentDownloads.length > 0) {
        // Handle TorrentDownload failure (TV shows with detailed tracking)
        for (const torrentDownload of torrentDownloads) {
          await this.failTorrentDownload(torrentDownload);
        }
      } else {
        // Handle simple request failure (movies, games, or legacy downloads)
        await this.orchestrator.markAsFailed(requestId, errorMessage || 'Download failed');
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

      // Organize downloaded files if aria2Gid is available
      if (torrentDownload.aria2Gid) {
        await this.organizeDownloadedFiles(torrentDownload.requestedTorrentId, torrentDownload.aria2Gid);
      }

      // Mark the request as completed
      await this.orchestrator.markAsCompleted(torrentDownload.requestedTorrentId);
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

      // Mark the request as failed
      await this.orchestrator.markAsFailed(torrentDownload.requestedTorrentId, 'Download failed');
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

  // NOTE: Season status updates are now handled by the season scanning service
  // which checks organized files in the library rather than download completion

  // NOTE: Episode status updates are now handled by the season scanning service
  // which checks organized files in the library rather than download completion

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

  /**
   * Organize downloaded files based on organization rules
   */
  private async organizeDownloadedFiles(requestId: string, aria2Gid: string): Promise<void> {
    try {
      this.logger.log(`Starting organization for request ${requestId} with aria2Gid ${aria2Gid}`);

      // Check if organization is enabled
      const settings = await this.organizationRulesService.getSettings();
      this.logger.log(`Organization settings - organizeOnComplete: ${settings.organizeOnComplete}`);

      if (!settings.organizeOnComplete) {
        this.logger.warn(`Organization on completion is disabled for request ${requestId}`);
        return;
      }

      // Get the request details
      const request = await this.prisma.requestedTorrent.findUnique({
        where: { id: requestId },
      });

      if (!request) {
        this.logger.warn(`Request ${requestId} not found for organization`);
        return;
      }

      this.logger.log(`Found request: ${request.title} (${request.contentType})`);

      // Check if organization rules exist for this content type
      try {
        const rule = await this.organizationRulesService.getRuleForContentType(request.contentType as ContentType, request.platform);
        this.logger.log(`Found organization rule for ${request.contentType}: ${rule.folderNamePattern} / ${rule.fileNamePattern}`);
      } catch (error) {
        this.logger.error(`No organization rule found for ${request.contentType}:`, error);
        return;
      }

      // Get download status and files from Aria2
      const downloadStatus = await this.aria2Service.getStatus(aria2Gid);
      this.logger.log(`Download status for ${aria2Gid}: ${downloadStatus.status}`);

      // Collect all files to organize (from main download and child downloads)
      const allFiles: Array<{ path: string; length: string; completedLength: string }> = [];

      // Add files from main download (if any)
      if (downloadStatus.files && downloadStatus.files.length > 0) {
        this.logger.log(`Found ${downloadStatus.files.length} files in main download`);
        allFiles.push(...downloadStatus.files);
      }

      // For torrents, check child downloads for actual content files
      if (downloadStatus.followedBy && downloadStatus.followedBy.length > 0) {
        this.logger.log(`Checking ${downloadStatus.followedBy.length} child downloads for files to organize`);

        for (const childGid of downloadStatus.followedBy) {
          try {
            const childStatus = await this.aria2Service.getStatus(childGid);
            if (childStatus.files && childStatus.files.length > 0) {
              this.logger.log(`Found ${childStatus.files.length} files in child download ${childGid}`);
              allFiles.push(...childStatus.files);
            }
          } catch (childError) {
            this.logger.debug(`Error getting child download files for ${childGid}:`, childError);
          }
        }
      }

      if (allFiles.length === 0) {
        this.logger.warn(`No files found for download ${aria2Gid} (including child downloads)`);
        return;
      }

      this.logger.log(`Found ${allFiles.length} total files for request: ${request.title}`);

      // Process each file
      let organizedCount = 0;
      let skippedCount = 0;

      for (const file of allFiles) {
        if (!file.path) {
          this.logger.debug(`Skipping file with no path`);
          continue;
        }

        this.logger.log(`Processing file: ${file.path}`);

        // Skip metadata files - they should not be organized
        if (this.isMetadataFile(file.path)) {
          this.logger.log(`Skipping metadata file: ${file.path}`);
          skippedCount++;
          continue;
        }

        try {
          // Convert Aria2 path to API container path
          // Aria2 reports paths as /downloads/... but in API container they're at /app/downloads/...
          const actualFilePath = this.convertAria2PathToContainerPath(file.path);
          this.logger.log(`Converted path: ${file.path} -> ${actualFilePath}`);

          // Create organization context
          // For TV shows, extract season/episode from file path if not available in request
          const extractedSeasonEpisode = this.extractSeasonEpisodeFromPath(file.path);

          const context = {
            contentType: request.contentType as ContentType,
            title: request.title,
            year: request.year || undefined,
            season: request.season || extractedSeasonEpisode.season,
            episode: request.episode || extractedSeasonEpisode.episode,
            platform: request.platform || undefined,
            quality: this.extractQualityFromPath(file.path),
            format: this.extractFormatFromPath(file.path),
            edition: this.extractEditionFromPath(file.path),
            originalPath: actualFilePath,
            fileName: file.path.split('/').pop() || 'unknown',
          };

          this.logger.log(`Organization context: ${JSON.stringify(context, null, 2)}`);

          // Organize the file
          const result = await this.fileOrganizationService.organizeFile(context, requestId);

          if (result.success) {
            this.logger.log(`Successfully organized: ${actualFilePath} -> ${result.organizedPath}`);
            organizedCount++;
          } else {
            this.logger.warn(`Failed to organize ${actualFilePath}: ${result.error}`);
          }

        } catch (error) {
          this.logger.error(`Error organizing file ${file.path}:`, error);
        }
      }

      this.logger.log(`Organization complete for request ${requestId}: ${organizedCount} organized, ${skippedCount} skipped`);

    } catch (error) {
      this.logger.error(`Error organizing files for request ${requestId}:`, error);
    }
  }

  /**
   * Check if a file is a metadata file that should not be organized
   */
  private isMetadataFile(filePath: string): boolean {
    const fileName = filePath.split('/').pop() || '';
    const fileNameLower = fileName.toLowerCase();

    // Check for metadata file patterns
    const isMetadata = (
      // Aria2 metadata files
      fileName.startsWith('[METADATA]') ||
      // Common metadata/info files (be more specific with .txt files)
      fileNameLower.endsWith('.nfo') ||
      fileNameLower.endsWith('.torrent') ||
      // Only exclude specific .txt files, not all
      fileNameLower.includes('readme') ||
      fileNameLower.includes('info.txt') ||
      fileNameLower.includes('description.txt') ||
      fileNameLower.includes('instructions.txt') ||
      // Subtitle files (usually organized separately)
      fileNameLower.endsWith('.srt') ||
      fileNameLower.endsWith('.sub') ||
      fileNameLower.endsWith('.idx') ||
      fileNameLower.endsWith('.ass') ||
      fileNameLower.endsWith('.ssa') ||
      fileNameLower.endsWith('.vtt') ||
      // Sample files
      fileNameLower.includes('sample') ||
      // Other metadata
      fileNameLower.endsWith('.sfv') ||
      fileNameLower.endsWith('.md5') ||
      fileNameLower.endsWith('.sha') ||
      fileNameLower.endsWith('.par2')
    );

    if (isMetadata) {
      this.logger.debug(`File ${fileName} identified as metadata file`);
    }

    return isMetadata;
  }

  /**
   * Convert Aria2 path to API container path
   * Aria2 reports paths as /downloads/... but in API container they're at /app/downloads/...
   */
  private convertAria2PathToContainerPath(aria2Path: string): string {
    // If the path starts with /downloads, replace it with /app/downloads
    if (aria2Path.startsWith('/downloads')) {
      return aria2Path.replace('/downloads', '/app/downloads');
    }

    // If it's already an absolute path starting with /app/downloads, return as-is
    if (aria2Path.startsWith('/app/downloads')) {
      return aria2Path;
    }

    // If it's a relative path, assume it's relative to /app/downloads
    return `/app/downloads/${aria2Path}`;
  }

  /**
   * Extract quality information from file path
   */
  private extractQualityFromPath(filePath: string): string | undefined {
    const fileName = filePath.toLowerCase();

    if (fileName.includes('2160p') || fileName.includes('4k')) return '2160p';
    if (fileName.includes('1080p')) return '1080p';
    if (fileName.includes('720p')) return '720p';
    if (fileName.includes('480p')) return '480p';

    return undefined;
  }

  /**
   * Extract format information from file path
   */
  private extractFormatFromPath(filePath: string): string | undefined {
    const fileName = filePath.toLowerCase();

    if (fileName.includes('x265') || fileName.includes('hevc')) return 'x265';
    if (fileName.includes('x264')) return 'x264';
    if (fileName.includes('av1')) return 'AV1';

    return undefined;
  }

  /**
   * Extract edition information from file path
   */
  private extractEditionFromPath(filePath: string): string | undefined {
    const fileName = filePath.toLowerCase();

    if (fileName.includes('bluray') || fileName.includes('brrip')) return 'BluRay';
    if (fileName.includes('webrip')) return 'WEBRip';
    if (fileName.includes('webdl') || fileName.includes('web-dl')) return 'WEB-DL';
    if (fileName.includes('hdtv')) return 'HDTV';
    if (fileName.includes('dvdrip')) return 'DVDRip';

    return undefined;
  }

  /**
   * Extract season and episode information from file path
   */
  private extractSeasonEpisodeFromPath(filePath: string): { season?: number; episode?: number } {
    const fileName = filePath.toLowerCase();

    // Common TV show patterns
    const patterns = [
      /s(\d+)e(\d+)/i,           // S01E01, s01e01
      /s(\d+)\s*e(\d+)/i,        // S01 E01
      /season\s*(\d+).*episode\s*(\d+)/i, // Season 1 Episode 1
      /(\d+)x(\d+)/,             // 1x01
      /s(\d+)\.e(\d+)/i,         // S01.E01
      /season[\s\._-]*(\d+)[\s\._-]*episode[\s\._-]*(\d+)/i, // Various season/episode formats
    ];

    for (const pattern of patterns) {
      const match = fileName.match(pattern);
      if (match) {
        const season = parseInt(match[1], 10);
        const episode = parseInt(match[2], 10);

        // Validate reasonable ranges
        if (season >= 1 && season <= 50 && episode >= 1 && episode <= 999) {
          return { season, episode };
        }
      }
    }

    // Try to extract just season information from directory structure
    const seasonOnlyPatterns = [
      /season[\s\._-]*(\d+)/i,   // Season 1, season_1, etc.
      /s(\d+)/i,                 // S01, s1, etc.
    ];

    for (const pattern of seasonOnlyPatterns) {
      const match = fileName.match(pattern);
      if (match) {
        const season = parseInt(match[1], 10);

        if (season >= 1 && season <= 50) {
          return { season };
        }
      }
    }

    return {};
  }
}
