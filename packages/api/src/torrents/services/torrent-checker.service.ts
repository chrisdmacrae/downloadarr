import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RequestedTorrentsService } from './requested-torrents.service';
import { TorrentSearchLogService } from './torrent-search-log.service';
import { TorrentSearchResultsService } from './torrent-search-results.service';
import { JackettService } from '../../discovery/services/jackett.service';
import { TorrentFilterService, FilterCriteria } from '../../discovery/services/torrent-filter.service';
import { RequestLifecycleOrchestrator } from './request-lifecycle-orchestrator.service';
import { DownloadService } from '../../download/download.service';
import { DownloadType } from '../../download/dto/create-download.dto';
import { PrismaService } from '../../database/prisma.service';
import { RequestedTorrent, ContentType, RequestStatus } from '../../../generated/prisma';
import { TorrentResult } from '../../discovery/interfaces/external-api.interface';
import { TvShowTorrentSelectionService } from './tv-show-torrent-selection.service';
import { TvShowGapAnalysisService } from './tv-show-gap-analysis.service';

@Injectable()
export class TorrentCheckerService {
  private readonly logger = new Logger(TorrentCheckerService.name);
  private isSearching = false;

  constructor(
    private readonly requestedTorrentsService: RequestedTorrentsService,
    private readonly searchLogService: TorrentSearchLogService,
    private readonly searchResultsService: TorrentSearchResultsService,
    private readonly jackettService: JackettService,
    private readonly torrentFilterService: TorrentFilterService,
    private readonly orchestrator: RequestLifecycleOrchestrator,
    @Inject(forwardRef(() => DownloadService))
    private readonly downloadService: DownloadService,
    private readonly prisma: PrismaService,
    private readonly tvShowTorrentSelection: TvShowTorrentSelectionService,
    private readonly tvShowGapAnalysis: TvShowGapAnalysisService,
  ) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  async checkForRequestedTorrents(): Promise<void> {
    if (this.isSearching) {
      this.logger.debug('Torrent search already in progress, skipping...');
      return;
    }

    this.isSearching = true;
    
    try {
      this.logger.log('Starting periodic torrent search...');
      
      const requests = await this.requestedTorrentsService.getRequestsReadyForSearch();
      
      if (requests.length === 0) {
        this.logger.debug('No torrent requests ready for search');
        return;
      }

      this.logger.log(`Found ${requests.length} torrent requests ready for search`);

      // Process requests in batches to avoid overwhelming Jackett
      const batchSize = 3;
      for (let i = 0; i < requests.length; i += batchSize) {
        const batch = requests.slice(i, i + batchSize);
        await Promise.all(batch.map(request => this.processRequest(request)));
        
        // Small delay between batches
        if (i + batchSize < requests.length) {
          await this.delay(2000);
        }
      }

      this.logger.log('Completed periodic torrent search');
    } catch (error) {
      this.logger.error('Error during periodic torrent search:', error);
    } finally {
      this.isSearching = false;
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupExpiredRequests(): Promise<void> {
    try {
      this.logger.log('Cleaning up expired torrent requests...');
      const count = await this.requestedTorrentsService.cleanupExpiredRequests();
      if (count > 0) {
        this.logger.log(`Cleaned up ${count} expired torrent requests`);
      }
    } catch (error) {
      this.logger.error('Error cleaning up expired requests:', error);
    }
  }

  async processRequest(request: RequestedTorrent): Promise<void> {
    try {
      this.logger.log(`Processing torrent request: ${request.title} (${request.contentType})`);

      // Start search via orchestrator (this will increment attempts and set status)
      await this.orchestrator.startSearch(request.id);

      // Handle ongoing TV shows with special logic
      if (request.contentType === ContentType.TV_SHOW && request.isOngoing) {
        await this.processOngoingTvShowRequest(request);
      } else {
        // Handle regular requests (movies, specific TV episodes/seasons)
        await this.processRegularRequest(request);
      }

    } catch (error) {
      this.logger.error(`Error processing torrent request ${request.id}:`, error);

      // Mark as failed if we've exceeded max attempts
      if (request.searchAttempts >= request.maxSearchAttempts) {
        await this.orchestrator.markAsFailed(request.id, `Search failed after ${request.searchAttempts} attempts: ${error.message}`);
        this.logger.log(`Request ${request.title} marked as FAILED after ${request.searchAttempts} attempts`);
      } else {
        // Reset status back to PENDING for retry
        await this.orchestrator.transitionRequest({
          requestId: request.id,
          targetStatus: RequestStatus.PENDING,
          reason: 'Search failed, retrying later',
        });
      }
    }
  }

  private async processOngoingTvShowRequest(request: RequestedTorrent): Promise<void> {
    this.logger.log(`Processing ongoing TV show request: ${request.title}`);

    // Check if we need more content for this show
    const needsMoreContent = await this.tvShowGapAnalysis.needsMoreContent(request.id);
    if (!needsMoreContent) {
      this.logger.log(`No more content needed for: ${request.title}`);
      await this.requestedTorrentsService.updateRequestStatus(request.id, RequestStatus.PENDING);
      return;
    }

    // Use general query (show title only) to search for torrents
    const generalQuery = request.title;
    this.logger.log(`Searching with general query: "${generalQuery}"`);

    const searchResult = await this.searchForTorrents(request, generalQuery);

    if (searchResult.torrents.length === 0) {
      this.logger.log(`No torrents found for: ${request.title}`);
      await this.orchestrator.transitionRequest({
        requestId: request.id,
        targetStatus: RequestStatus.PENDING,
        reason: 'No torrents found with general query',
      });
      return;
    }

    // Analyze missing content and select the best torrent
    const missingContent = await this.tvShowTorrentSelection.analyzeMissingContent(request.id);
    const bestMatch = await this.tvShowTorrentSelection.selectBestTorrent(
      searchResult.torrents,
      missingContent,
      request.title
    );

    if (!bestMatch) {
      this.logger.log(`No suitable torrent found for missing content: ${request.title}`);
      await this.orchestrator.transitionRequest({
        requestId: request.id,
        targetStatus: RequestStatus.PENDING,
        reason: 'No torrents match missing content requirements',
      });
      return;
    }

    this.logger.log(`Selected best torrent: ${bestMatch.torrent.title} (${bestMatch.reason})`);

    // Initiate download based on torrent type
    const downloadInfo = await this.initiateTorrentDownloadForTvShow(request, bestMatch);

    // Update the main request status to FOUND first
    await this.orchestrator.markAsFound(request.id, {
      title: bestMatch.torrent.title,
      link: bestMatch.torrent.link,
      magnetUri: bestMatch.torrent.magnetUri,
      size: bestMatch.torrent.size,
      seeders: bestMatch.torrent.seeders,
      indexer: bestMatch.torrent.indexer,
    });

    // Then transition to DOWNLOADING since we've initiated downloads
    if (downloadInfo) {
      await this.orchestrator.startDownload(request.id, downloadInfo);
    }
  }

  private async processRegularRequest(request: RequestedTorrent): Promise<void> {
    // For TV shows, use the new strategy
    if (request.contentType === ContentType.TV_SHOW) {
      return this.processOngoingTvShowRequest(request);
    }

    // For movies and games, use the existing logic
    const searchQuery = await this.buildSearchQuery(request);
    const searchResult = await this.searchForTorrents(request, searchQuery);

    if (searchResult.torrents.length > 0) {
      const bestTorrent = searchResult.bestTorrent || searchResult.torrents[0];
      this.logger.log(`Found ${searchResult.torrents.length} torrents for: ${request.title}`);
      this.logger.log(`Auto-selecting best torrent: ${bestTorrent.title} (${bestTorrent.seeders} seeders)`);

      await this.initiateTorrentDownload(request, bestTorrent);
    } else {
      this.logger.log(`No suitable torrent found for: ${request.title}`);
      await this.orchestrator.transitionRequest({
        requestId: request.id,
        targetStatus: RequestStatus.PENDING,
        reason: 'No suitable torrents found',
      });
    }
  }

  private async buildSearchQuery(request: RequestedTorrent): Promise<string> {
    // For TV shows, use general query (show title only) for the new strategy
    if (request.contentType === ContentType.TV_SHOW) {
      return request.title;
    }

    // For movies and games, keep the existing logic
    return request.title;
  }



  private async searchForTorrents(request: RequestedTorrent, searchQuery: string): Promise<{
    torrents: TorrentResult[];
    bestTorrent?: TorrentResult;
  }> {
    try {
      // Determine search method based on content type
      let searchResult: any;
      
      if (request.contentType === ContentType.MOVIE) {
        searchResult = await this.jackettService.searchMovieTorrents({
          query: searchQuery,
          year: request.year,
          imdbId: request.imdbId,
          indexers: request.trustedIndexers.length > 0 ? request.trustedIndexers : undefined,
          minSeeders: request.minSeeders,
          maxSize: `${request.maxSizeGB}GB`,
          quality: request.preferredQualities as any,
          format: request.preferredFormats as any,
          limit: 50,
        });
      } else if (request.contentType === ContentType.TV_SHOW) {
        searchResult = await this.jackettService.searchTvTorrents({
          query: searchQuery,
          season: request.season,
          episode: request.episode,
          imdbId: request.imdbId,
          indexers: request.trustedIndexers.length > 0 ? request.trustedIndexers : undefined,
          minSeeders: request.minSeeders,
          maxSize: `${request.maxSizeGB}GB`,
          quality: request.preferredQualities as any,
          format: request.preferredFormats as any,
          limit: 50,
        });
      } else if (request.contentType === ContentType.GAME) {
        this.logger.debug(`Searching for game: ${searchQuery}, platform: ${request.platform}`);

        searchResult = await this.jackettService.searchGameTorrents({
          query: searchQuery,
          year: request.year,
          platform: request.platform,
          igdbId: request.igdbId,
          indexers: request.trustedIndexers.length > 0 ? request.trustedIndexers : undefined,
          minSeeders: request.minSeeders,
          maxSize: `${request.maxSizeGB}GB`,
          limit: 50,
        });
      }

      if (!searchResult.success || !searchResult.data) {
        this.logger.warn(`Search failed for ${request.title}: ${searchResult.error}`);
        return { torrents: [] };
      }

      const torrents = searchResult.data;
      
      // Apply additional filtering
      const filterCriteria: FilterCriteria = {
        minSeeders: request.minSeeders,
        maxSize: `${request.maxSizeGB}GB`,
        preferredQualities: request.preferredQualities as any,
        preferredFormats: request.preferredFormats as any,
        blacklistedWords: request.blacklistedWords,
        trustedIndexers: request.trustedIndexers,
      };

      const filteredTorrents = this.torrentFilterService.filterAndRankTorrents(torrents, filterCriteria);
      
      return {
        torrents: filteredTorrents,
        bestTorrent: filteredTorrents.length > 0 ? filteredTorrents[0] : undefined,
      };

    } catch (error) {
      this.logger.error(`Error searching for torrents: ${error.message}`);
      return { torrents: [] };
    }
  }

  async selectAndDownloadTorrent(requestId: string, resultId: string): Promise<void> {
    try {
      // Get the request and selected result
      const request = await this.requestedTorrentsService.getRequestById(requestId);
      if (!request) {
        throw new Error(`Request ${requestId} not found`);
      }

      // Select the torrent result
      const selectedResult = await this.searchResultsService.selectTorrent(resultId);

      // Convert search result to TorrentResult format for download
      const torrentResult: TorrentResult = {
        title: selectedResult.title,
        link: selectedResult.link,
        magnetUri: selectedResult.magnetUri,
        size: selectedResult.size,
        seeders: selectedResult.seeders,
        leechers: selectedResult.leechers,
        category: selectedResult.category,
        indexer: selectedResult.indexer,
        publishDate: selectedResult.publishDate,
        quality: selectedResult.quality,
        format: selectedResult.format,
      };

      // Initiate the download
      await this.initiateTorrentDownload(request, torrentResult);

      this.logger.log(`User selected and initiated download: ${selectedResult.title} for request ${request.title}`);
    } catch (error) {
      this.logger.error(`Error selecting and downloading torrent:`, error);
      throw error;
    }
  }

  private async initiateTorrentDownload(request: RequestedTorrent, torrent: TorrentResult): Promise<void> {
    try {
      this.logger.log(`Initiating download for: ${torrent.title} (${torrent.seeders} seeders)`);

      // Mark request as found first
      await this.orchestrator.markAsFound(request.id, {
        title: torrent.title,
        link: torrent.link,
        magnetUri: torrent.magnetUri,
        size: torrent.size,
        seeders: torrent.seeders,
        indexer: torrent.indexer,
      });

      // Create actual download job
      const downloadUrl = torrent.magnetUri || torrent.link;
      const downloadType = torrent.magnetUri ? DownloadType.MAGNET : DownloadType.TORRENT;

      const downloadJob = await this.downloadService.createDownload({
        url: downloadUrl,
        type: downloadType,
        name: this.sanitizeFilename(torrent.title),
        destination: this.getDownloadDestination(request),
      });

      const downloadJobId = downloadJob.id.toString();
      const aria2Gid = downloadJob.aria2Gid;

      // Create a torrent download record for tracking
      await this.prisma.torrentDownload.create({
        data: {
          requestedTorrentId: request.id,
          torrentTitle: torrent.title,
          torrentLink: torrent.link,
          magnetUri: torrent.magnetUri,
          torrentSize: torrent.size,
          seeders: torrent.seeders,
          indexer: torrent.indexer,
          downloadJobId,
          aria2Gid,
          status: 'DOWNLOADING',
        },
      });

      // Mark request as downloading via orchestrator
      await this.orchestrator.startDownload(request.id, {
        downloadJobId,
        aria2Gid,
        torrentInfo: {
          title: torrent.title,
          link: torrent.link,
          magnetUri: torrent.magnetUri,
          size: torrent.size,
          seeders: torrent.seeders,
          indexer: torrent.indexer,
        },
      });

      this.logger.log(`Successfully initiated download for: ${request.title}`);

    } catch (error) {
      this.logger.error(`Error initiating download for ${request.title}:`, error);

      // Mark request as failed via orchestrator
      await this.orchestrator.markAsFailed(request.id, `Download initiation failed: ${error.message}`);
    }
  }

  /**
   * Initiate torrent download for TV show based on the torrent match type
   */
  private async initiateTorrentDownloadForTvShow(request: RequestedTorrent, torrentMatch: any): Promise<{ downloadJobId: string; aria2Gid: string; torrentInfo: any } | null> {
    const { torrent, type } = torrentMatch;

    try {
      this.logger.log(`Initiating ${type} download for: ${torrent.title}`);

      // Create actual download job
      const downloadUrl = torrent.magnetUri || torrent.link;
      const downloadType = torrent.magnetUri ? DownloadType.MAGNET : DownloadType.TORRENT;

      const downloadJob = await this.downloadService.createDownload({
        url: downloadUrl,
        type: downloadType,
        name: this.sanitizeFilename(torrent.title),
        destination: this.getDownloadDestination(request),
      });

      const downloadJobId = downloadJob.id.toString();
      const aria2Gid = downloadJob.aria2Gid;

      // Create a single TorrentDownload record for the request
      await this.prisma.torrentDownload.create({
        data: {
          requestedTorrentId: request.id,
          torrentTitle: torrent.title,
          torrentLink: torrent.link,
          magnetUri: torrent.magnetUri,
          torrentSize: torrent.size,
          seeders: torrent.seeders,
          indexer: torrent.indexer,
          downloadJobId,
          aria2Gid,
          status: 'DOWNLOADING',
        },
      });

      this.logger.log(`Successfully initiated ${type} download for: ${request.title}`);

      // Return download info for status transition
      return {
        downloadJobId,
        aria2Gid,
        torrentInfo: {
          title: torrent.title,
          link: torrent.link,
          magnetUri: torrent.magnetUri,
          size: torrent.size,
          seeders: torrent.seeders,
          indexer: torrent.indexer,
        },
      };
    } catch (error) {
      this.logger.error(`Error initiating TV show download for ${request.title}:`, error);
      throw error;
    }
  }









  private sanitizeFilename(filename: string): string {
    return filename
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private getDownloadDestination(request: RequestedTorrent): string {
    const baseDir = process.env.DOWNLOAD_PATH || '/downloads';

    if (request.contentType === ContentType.MOVIE) {
      return `${baseDir}/movies`;
    } else if (request.contentType === ContentType.TV_SHOW) {
      return `${baseDir}/tv-shows`;
    } else if (request.contentType === ContentType.GAME) {
      return `${baseDir}/games`;
    } else {
      return `${baseDir}/other`;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Manual trigger for testing
  async triggerSearch(): Promise<void> {
    this.logger.log('Manually triggering torrent search...');
    await this.checkForRequestedTorrents();
  }

  // Search for a specific request
  async searchForSpecificRequest(requestId: string): Promise<void> {
    try {
      this.logger.log(`Manually triggering search for request ${requestId}`);

      const request = await this.requestedTorrentsService.getRequestById(requestId);
      if (!request) {
        throw new Error(`Request ${requestId} not found`);
      }

      // Process the specific request
      await this.processRequest(request);

      this.logger.log(`Completed manual search for request ${requestId}`);
    } catch (error) {
      this.logger.error(`Error during manual search for request ${requestId}:`, error);
      throw error;
    }
  }

  // Search for all pending/failed/expired requests
  async searchForAllRequests(): Promise<void> {
    try {
      this.logger.log('Manually triggering search for all searchable requests...');

      const searchableStates: RequestStatus[] = ['PENDING', 'FAILED', 'EXPIRED'];
      const requests = await this.requestedTorrentsService.getRequestsByStatuses(searchableStates);

      if (requests.length === 0) {
        this.logger.log('No searchable requests found');
        return;
      }

      this.logger.log(`Found ${requests.length} searchable requests`);

      // Process requests in batches to avoid overwhelming Jackett
      const batchSize = 3;
      for (let i = 0; i < requests.length; i += batchSize) {
        const batch = requests.slice(i, i + batchSize);
        await Promise.all(batch.map(request => this.processRequest(request)));

        // Small delay between batches
        if (i + batchSize < requests.length) {
          await this.delay(2000);
        }
      }

      this.logger.log('Completed manual search for all requests');
    } catch (error) {
      this.logger.error('Error during manual search for all requests:', error);
      throw error;
    }
  }

  // Get search status
  getSearchStatus(): { isSearching: boolean } {
    return { isSearching: this.isSearching };
  }
}
