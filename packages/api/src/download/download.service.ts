import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { CreateDownloadDto } from './dto/create-download.dto';
import { Aria2Service } from './aria2.service';
import { DownloadMetadataService } from './download-metadata.service';
import { RequestedTorrentsService } from '../torrents/services/requested-torrents.service';
import { RequestStatus } from '../../generated/prisma';

@Injectable()
export class DownloadService {
  private readonly logger = new Logger(DownloadService.name);

  constructor(
    private aria2Service: Aria2Service,
    private downloadMetadataService: DownloadMetadataService,
    @Inject(forwardRef(() => RequestedTorrentsService))
    private requestedTorrentsService: RequestedTorrentsService,
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

    // Check if this download matches any existing torrent requests
    await this.checkAndUpdateMatchingTorrentRequests(url, name, metadata.id.toString(), gid);

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

  /**
   * Check if a manual download matches any existing torrent requests and update their status
   */
  private async checkAndUpdateMatchingTorrentRequests(
    url: string,
    name: string | undefined,
    downloadId: string,
    aria2Gid: string
  ): Promise<void> {
    try {
      // Only check for torrent/magnet downloads
      if (!url.startsWith('magnet:') && !url.includes('.torrent')) {
        return;
      }

      // Get all pending/searching/failed requests that could match
      const searchableStates: RequestStatus[] = ['PENDING', 'SEARCHING', 'FAILED'];
      const requests = await this.requestedTorrentsService.getRequestsByStatuses(searchableStates);

      if (requests.length === 0) {
        return;
      }

      // Try to find a matching request
      const matchingRequest = await this.findMatchingTorrentRequest(requests, url, name);

      if (matchingRequest) {
        this.logger.log(`Found matching torrent request for manual download: ${matchingRequest.title}`);

        // Extract torrent info from the download
        const torrentInfo = this.extractTorrentInfoFromDownload(url, name);

        // Follow proper state transitions based on current status
        if (matchingRequest.status === 'PENDING') {
          // PENDING → SEARCHING → FOUND → DOWNLOADING
          await this.requestedTorrentsService.incrementSearchAttempt(matchingRequest.id);
          await this.requestedTorrentsService.markAsFound(matchingRequest.id, torrentInfo);
          await this.requestedTorrentsService.markAsDownloading(matchingRequest.id, downloadId, aria2Gid);
        } else if (matchingRequest.status === 'SEARCHING') {
          // SEARCHING → FOUND → DOWNLOADING
          await this.requestedTorrentsService.markAsFound(matchingRequest.id, torrentInfo);
          await this.requestedTorrentsService.markAsDownloading(matchingRequest.id, downloadId, aria2Gid);
        } else if (matchingRequest.status === 'FOUND') {
          // FOUND → DOWNLOADING (just update with download info)
          await this.requestedTorrentsService.markAsDownloading(matchingRequest.id, downloadId, aria2Gid);
        } else if (matchingRequest.status === 'FAILED') {
          // FAILED → SEARCHING → FOUND → DOWNLOADING
          await this.requestedTorrentsService.incrementSearchAttempt(matchingRequest.id);
          await this.requestedTorrentsService.markAsFound(matchingRequest.id, torrentInfo);
          await this.requestedTorrentsService.markAsDownloading(matchingRequest.id, downloadId, aria2Gid);
        } else {
          this.logger.warn(`Cannot link download to request in ${matchingRequest.status} status`);
          return;
        }

        this.logger.log(`Updated torrent request ${matchingRequest.title} status to DOWNLOADING`);
      }
    } catch (error) {
      this.logger.error('Error checking for matching torrent requests:', error);
      // Don't throw - we don't want to fail the download if request matching fails
    }
  }

  /**
   * Find a torrent request that matches the manual download
   */
  private async findMatchingTorrentRequest(
    requests: any[],
    url: string,
    name?: string
  ): Promise<any | null> {
    // If we have a name, try to match by title similarity
    if (name) {
      const normalizedName = this.normalizeTitle(name);

      for (const request of requests) {
        const normalizedRequestTitle = this.normalizeTitle(request.title);

        // Check for title similarity
        if (this.isTitleMatch(normalizedName, normalizedRequestTitle)) {
          // Additional checks based on content type
          if (await this.isContentTypeMatch(request, name)) {
            return request;
          }
        }
      }
    }

    // If we have a magnet link, try to match by exact magnet URI
    if (url.startsWith('magnet:')) {
      for (const request of requests) {
        // Check if any previous search results had this exact magnet
        if (request.foundMagnetUri === url) {
          return request;
        }
      }
    }

    return null;
  }

  /**
   * Normalize title for comparison
   */
  private normalizeTitle(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove special characters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Check if two titles are similar enough to be considered a match
   */
  private isTitleMatch(title1: string, title2: string): boolean {
    // Exact match
    if (title1 === title2) {
      return true;
    }

    // Check if one title contains the other (for cases like "Movie Title" vs "Movie Title 2023")
    if (title1.includes(title2) || title2.includes(title1)) {
      return true;
    }

    // Check for partial matches (at least 70% of words match)
    const words1 = title1.split(' ').filter(w => w.length > 2);
    const words2 = title2.split(' ').filter(w => w.length > 2);

    if (words1.length === 0 || words2.length === 0) {
      return false;
    }

    const matchingWords = words1.filter(word => words2.includes(word));
    const matchRatio = matchingWords.length / Math.max(words1.length, words2.length);

    return matchRatio >= 0.7;
  }

  /**
   * Check if the content type matches based on the download name and request type
   */
  private async isContentTypeMatch(request: any, downloadName: string): Promise<boolean> {
    const lowerName = downloadName.toLowerCase();

    // For TV shows, look for season/episode patterns
    if (request.contentType === 'TV_SHOW') {
      const hasSeasonEpisode = /s\d+e\d+|season\s*\d+|episode\s*\d+/i.test(downloadName);
      if (hasSeasonEpisode) {
        return true;
      }
    }

    // For movies, check for movie-like patterns
    if (request.contentType === 'MOVIE') {
      const hasMoviePattern = /\b(19|20)\d{2}\b|bluray|brrip|webrip|dvdrip|hdtv/i.test(downloadName);
      if (hasMoviePattern) {
        return true;
      }
    }

    // For games, check for game-like patterns
    if (request.contentType === 'GAME') {
      const hasGamePattern = /\b(pc|mac|linux|windows|steam|gog|repack)\b/i.test(downloadName);
      if (hasGamePattern) {
        return true;
      }
    }

    // Default to true if we can't determine content type from name
    return true;
  }

  /**
   * Extract torrent information from download details
   */
  private extractTorrentInfoFromDownload(url: string, name?: string): {
    title: string;
    link: string;
    magnetUri?: string;
    size: string;
    seeders: number;
    indexer: string;
  } {
    return {
      title: name || 'Manual Download',
      link: url.startsWith('magnet:') ? '' : url,
      magnetUri: url.startsWith('magnet:') ? url : undefined,
      size: 'Unknown',
      seeders: 0,
      indexer: 'Manual',
    };
  }
}
