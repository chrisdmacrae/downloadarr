import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RequestedTorrentsService } from './requested-torrents.service';
import { TorrentSearchLogService } from './torrent-search-log.service';
import { TorrentSearchResultsService } from './torrent-search-results.service';
import { JackettService } from '../../discovery/services/jackett.service';
import { TorrentFilterService, FilterCriteria } from '../../discovery/services/torrent-filter.service';
import { DownloadService } from '../../download/download.service';
import { DownloadType } from '../../download/dto/create-download.dto';
import { RequestedTorrent, ContentType, RequestStatus } from '../../../generated/prisma';
import { TorrentResult } from '../../discovery/interfaces/external-api.interface';

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
    private readonly downloadService: DownloadService,
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
    const startTime = Date.now();
    
    try {
      this.logger.log(`Processing torrent request: ${request.title} (${request.contentType})`);
      
      // Increment search attempt
      await this.requestedTorrentsService.incrementSearchAttempt(request.id);
      
      // Build search query
      const searchQuery = this.buildSearchQuery(request);
      
      // Search for torrents
      const searchResult = await this.searchForTorrents(request, searchQuery);
      
      // Automatically download the best torrent if found
      if (searchResult.torrents.length > 0) {
        const bestTorrent = searchResult.bestTorrent || searchResult.torrents[0];
        this.logger.log(`Found ${searchResult.torrents.length} torrents for: ${request.title}`);
        this.logger.log(`Auto-selecting best torrent: ${bestTorrent.title} (${bestTorrent.seeders} seeders)`);

        // Automatically initiate download for the best torrent
        await this.initiateTorrentDownload(request, bestTorrent);
      } else {
        this.logger.log(`No suitable torrent found for: ${request.title}`);
        // Reset status back to PENDING so it can be searched again later
        await this.requestedTorrentsService.updateRequestStatus(request.id, RequestStatus.PENDING);
      }

      // Log the search attempt
      await this.searchLogService.logSearch({
        requestedTorrentId: request.id,
        searchQuery,
        indexersSearched: request.trustedIndexers.length > 0 ? request.trustedIndexers : ['all'],
        resultsFound: searchResult.torrents.length,
        bestResultTitle: searchResult.bestTorrent?.title,
        bestResultSeeders: searchResult.bestTorrent?.seeders,
        searchDurationMs: Date.now() - startTime,
      });

    } catch (error) {
      this.logger.error(`Error processing torrent request ${request.id}:`, error);

      // Reset status back to PENDING so it can be searched again later
      await this.requestedTorrentsService.updateRequestStatus(request.id, RequestStatus.PENDING);

      // Log failed search
      await this.searchLogService.logSearch({
        requestedTorrentId: request.id,
        searchQuery: this.buildSearchQuery(request),
        indexersSearched: ['error'],
        resultsFound: 0,
        searchDurationMs: Date.now() - startTime,
      });
    }
  }

  private buildSearchQuery(request: RequestedTorrent): string {
    let query = request.title;

    if (request.contentType === ContentType.MOVIE && request.year) {
      query += ` ${request.year}`;
    }

    if (request.contentType === ContentType.TV_SHOW) {
      if (request.season && request.episode) {
        query += ` S${request.season.toString().padStart(2, '0')}E${request.episode.toString().padStart(2, '0')}`;
      } else if (request.season) {
        query += ` S${request.season.toString().padStart(2, '0')}`;
      }
    }

    return query;
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

      // Mark request as found
      await this.requestedTorrentsService.markAsFound(request.id, {
        title: torrent.title,
        link: torrent.link,
        magnetUri: torrent.magnetUri,
        size: torrent.size,
        seeders: torrent.seeders,
        indexer: torrent.indexer,
      });

      // Create download job
      const downloadUrl = torrent.magnetUri || torrent.link;
      const downloadType = torrent.magnetUri ? DownloadType.MAGNET : DownloadType.TORRENT;
      
      const downloadJob = await this.downloadService.createDownload({
        url: downloadUrl,
        type: downloadType,
        name: this.sanitizeFilename(torrent.title),
        destination: this.getDownloadDestination(request),
      });

      // Mark request as downloading
      await this.requestedTorrentsService.markAsDownloading(
        request.id,
        downloadJob.id.toString(),
        downloadJob.aria2Gid,
      );

      this.logger.log(`Successfully initiated download for: ${request.title}`);

    } catch (error) {
      this.logger.error(`Error initiating download for ${request.title}:`, error);
      
      // Mark request as failed
      await this.requestedTorrentsService.updateRequestStatus(request.id, RequestStatus.FAILED);
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
    } else {
      return `${baseDir}/tv-shows`;
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
