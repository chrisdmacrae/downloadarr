import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RequestedTorrentsService } from './requested-torrents.service';
import { TorrentSearchLogService } from './torrent-search-log.service';
import { TorrentSearchResultsService } from './torrent-search-results.service';
import { JackettService } from '../../discovery/services/jackett.service';
import { TorrentFilterService, FilterCriteria } from '../../discovery/services/torrent-filter.service';
import { DownloadService } from '../../download/download.service';
import { DownloadType } from '../../download/dto/create-download.dto';
import { PrismaService } from '../../database/prisma.service';
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
    private readonly prisma: PrismaService,
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
        await this.requestedTorrentsService.updateRequestStatus(request.id, RequestStatus.FAILED);
        this.logger.log(`Request ${request.title} marked as FAILED after ${request.searchAttempts} attempts`);
      } else {
        // Reset status back to PENDING for retry
        await this.requestedTorrentsService.updateRequestStatus(request.id, RequestStatus.PENDING);
      }
    }
  }

  private async processOngoingTvShowRequest(request: RequestedTorrent): Promise<void> {
    // Get the next season that needs to be downloaded
    const nextSeason = await this.getNextSeasonToSearch(request.id);
    if (!nextSeason) {
      this.logger.log(`No more seasons to search for: ${request.title}`);
      await this.requestedTorrentsService.updateRequestStatus(request.id, RequestStatus.PENDING);
      return;
    }

    this.logger.log(`Searching for season ${nextSeason} of ${request.title}`);

    // First, try to find a complete season pack
    const seasonPackQuery = `${request.title} S${nextSeason.toString().padStart(2, '0')}`;
    const seasonPackResult = await this.searchForTorrents(request, seasonPackQuery);

    if (seasonPackResult.torrents.length > 0) {
      const bestTorrent = seasonPackResult.bestTorrent || seasonPackResult.torrents[0];
      this.logger.log(`Found season pack for ${request.title} S${nextSeason}: ${bestTorrent.title}`);

      // Download the season pack and associate it with the season
      await this.initiateTorrentDownloadForSeason(request, bestTorrent, nextSeason);

      // Update the main request status to show we found and initiated a download
      await this.requestedTorrentsService.markAsFound(request.id, {
        title: bestTorrent.title,
        link: bestTorrent.link,
        magnetUri: bestTorrent.magnetUri,
        size: bestTorrent.size,
        seeders: bestTorrent.seeders,
        indexer: bestTorrent.indexer,
      });
      return;
    }

    // If no season pack found, try to find individual episodes
    this.logger.log(`No season pack found for ${request.title} S${nextSeason}, searching for individual episodes`);

    // Get episode count for this season from metadata
    const season = await this.prisma.tvShowSeason.findUnique({
      where: {
        requestedTorrentId_seasonNumber: {
          requestedTorrentId: request.id,
          seasonNumber: nextSeason,
        },
      },
      include: { episodes: true },
    });

    if (season && season.episodes.length > 0) {
      // Search for individual episodes that haven't been downloaded
      await this.searchForIndividualEpisodes(request, nextSeason, season.episodes);
    } else {
      // If we don't have episode metadata, try searching for the first few episodes
      await this.searchForFirstEpisodes(request, nextSeason);
    }
  }

  private async processRegularRequest(request: RequestedTorrent): Promise<void> {
    // Build search query for regular requests
    const searchQuery = await this.buildSearchQuery(request);

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
  }

  private async buildSearchQuery(request: RequestedTorrent): Promise<string> {
    let query = request.title;

    if (request.contentType === ContentType.MOVIE && request.year) {
      query += ` ${request.year}`;
    }

    if (request.contentType === ContentType.TV_SHOW) {
      if (request.isOngoing) {
        // For ongoing shows, search for the next season that needs to be downloaded
        const nextSeason = await this.getNextSeasonToSearch(request.id);
        if (nextSeason) {
          query += ` S${nextSeason.toString().padStart(2, '0')}`;
        }
      } else {
        // For specific season/episode requests
        if (request.season && request.episode) {
          query += ` S${request.season.toString().padStart(2, '0')}E${request.episode.toString().padStart(2, '0')}`;
        } else if (request.season) {
          query += ` S${request.season.toString().padStart(2, '0')}`;
        }
      }
    }

    return query;
  }

  private async getNextSeasonToSearch(requestId: string): Promise<number | null> {
    try {
      // Get all seasons for this request
      const seasons = await this.prisma.tvShowSeason.findMany({
        where: { requestedTorrentId: requestId },
        include: {
          torrentDownloads: {
            where: {
              status: { in: ['COMPLETED', 'DOWNLOADING'] }
            }
          }
        },
        orderBy: { seasonNumber: 'asc' }
      });

      // Find the first season that doesn't have any completed or downloading torrents
      for (const season of seasons) {
        if (season.torrentDownloads.length === 0) {
          return season.seasonNumber;
        }
      }

      // If all existing seasons have downloads, check if we should search for the next season
      if (seasons.length > 0) {
        const lastSeason = Math.max(...seasons.map(s => s.seasonNumber));
        // Search for the next season (this will help discover new seasons)
        return lastSeason + 1;
      }

      // If no seasons exist yet, start with season 1
      return 1;
    } catch (error) {
      this.logger.error(`Error getting next season to search for request ${requestId}:`, error);
      return 1; // Default to season 1
    }
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

      // Create a torrent download record for tracking (for all content types)
      // Progress data is sourced dynamically from aria2, not stored
      await this.prisma.torrentDownload.create({
        data: {
          requestedTorrentId: request.id,
          tvShowSeasonId: null, // Only used for TV shows
          tvShowEpisodeId: null, // Only used for TV shows
          torrentTitle: torrent.title,
          torrentLink: torrent.link,
          magnetUri: torrent.magnetUri,
          torrentSize: torrent.size,
          seeders: torrent.seeders,
          indexer: torrent.indexer,
          downloadJobId: downloadJob.id.toString(),
          aria2Gid: downloadJob.aria2Gid,
          status: 'DOWNLOADING',
        },
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

  private async initiateTorrentDownloadForSeason(request: RequestedTorrent, torrent: TorrentResult, seasonNumber: number): Promise<void> {
    try {
      this.logger.log(`Initiating season pack download for: ${torrent.title} (Season ${seasonNumber})`);

      // Create download job
      const downloadUrl = torrent.magnetUri || torrent.link;
      const downloadType = torrent.magnetUri ? DownloadType.MAGNET : DownloadType.TORRENT;

      const downloadJob = await this.downloadService.createDownload({
        url: downloadUrl,
        type: downloadType,
        name: this.sanitizeFilename(torrent.title),
        destination: this.getDownloadDestination(request),
      });

      // Create a torrent download record associated with the season
      const season = await this.prisma.tvShowSeason.findUnique({
        where: {
          requestedTorrentId_seasonNumber: {
            requestedTorrentId: request.id,
            seasonNumber: seasonNumber,
          },
        },
      });

      if (season) {
        await this.prisma.torrentDownload.create({
          data: {
            requestedTorrentId: request.id,
            tvShowSeasonId: season.id,
            torrentTitle: torrent.title,
            torrentLink: torrent.link,
            magnetUri: torrent.magnetUri,
            torrentSize: torrent.size,
            seeders: torrent.seeders,
            indexer: torrent.indexer,
            downloadJobId: downloadJob.id.toString(),
            aria2Gid: downloadJob.aria2Gid,
            status: 'DOWNLOADING',
          },
        });

        // Update season status
        await this.prisma.tvShowSeason.update({
          where: { id: season.id },
          data: { status: 'DOWNLOADING' },
        });
      }

      this.logger.log(`Successfully initiated season pack download for: ${request.title} S${seasonNumber}`);

    } catch (error) {
      this.logger.error(`Error initiating season download for ${request.title} S${seasonNumber}:`, error);
    }
  }

  private async initiateTorrentDownloadForEpisode(request: RequestedTorrent, torrent: TorrentResult, seasonNumber: number, episodeNumber: number): Promise<void> {
    try {
      this.logger.log(`Initiating episode download for: ${torrent.title} (S${seasonNumber}E${episodeNumber})`);

      // Create download job
      const downloadUrl = torrent.magnetUri || torrent.link;
      const downloadType = torrent.magnetUri ? DownloadType.MAGNET : DownloadType.TORRENT;

      const downloadJob = await this.downloadService.createDownload({
        url: downloadUrl,
        type: downloadType,
        name: this.sanitizeFilename(torrent.title),
        destination: this.getDownloadDestination(request),
      });

      // Find the specific episode
      const episode = await this.prisma.tvShowEpisode.findFirst({
        where: {
          tvShowSeason: {
            requestedTorrentId: request.id,
            seasonNumber: seasonNumber,
          },
          episodeNumber: episodeNumber,
        },
        include: { tvShowSeason: true },
      });

      if (episode) {
        await this.prisma.torrentDownload.create({
          data: {
            requestedTorrentId: request.id,
            tvShowSeasonId: episode.tvShowSeasonId,
            tvShowEpisodeId: episode.id,
            torrentTitle: torrent.title,
            torrentLink: torrent.link,
            magnetUri: torrent.magnetUri,
            torrentSize: torrent.size,
            seeders: torrent.seeders,
            indexer: torrent.indexer,
            downloadJobId: downloadJob.id.toString(),
            aria2Gid: downloadJob.aria2Gid,
            status: 'DOWNLOADING',
          },
        });

        // Update episode status
        await this.prisma.tvShowEpisode.update({
          where: { id: episode.id },
          data: { status: 'DOWNLOADING' },
        });
      }

      this.logger.log(`Successfully initiated episode download for: ${request.title} S${seasonNumber}E${episodeNumber}`);

    } catch (error) {
      this.logger.error(`Error initiating episode download for ${request.title} S${seasonNumber}E${episodeNumber}:`, error);
    }
  }

  private async searchForIndividualEpisodes(request: RequestedTorrent, seasonNumber: number, episodes: any[]): Promise<void> {
    // Search for the first few episodes that haven't been downloaded
    const undownloadedEpisodes = episodes.filter(ep => ep.status === 'PENDING').slice(0, 3);

    for (const episode of undownloadedEpisodes) {
      const episodeQuery = `${request.title} S${seasonNumber.toString().padStart(2, '0')}E${episode.episodeNumber.toString().padStart(2, '0')}`;
      const episodeResult = await this.searchForTorrents(request, episodeQuery);

      if (episodeResult.torrents.length > 0) {
        const bestTorrent = episodeResult.bestTorrent || episodeResult.torrents[0];
        this.logger.log(`Found episode torrent: ${bestTorrent.title}`);

        // Download the episode and associate it with the specific episode
        await this.initiateTorrentDownloadForEpisode(request, bestTorrent, seasonNumber, episode.episodeNumber);

        // Update the main request status to show we found and initiated a download
        await this.requestedTorrentsService.markAsFound(request.id, {
          title: bestTorrent.title,
          link: bestTorrent.link,
          magnetUri: bestTorrent.magnetUri,
          size: bestTorrent.size,
          seeders: bestTorrent.seeders,
          indexer: bestTorrent.indexer,
        });
        break; // Download one episode at a time
      }
    }
  }

  private async searchForFirstEpisodes(request: RequestedTorrent, seasonNumber: number): Promise<void> {
    // Try to find the first few episodes of the season
    for (let episode = 1; episode <= 3; episode++) {
      const episodeQuery = `${request.title} S${seasonNumber.toString().padStart(2, '0')}E${episode.toString().padStart(2, '0')}`;
      const episodeResult = await this.searchForTorrents(request, episodeQuery);

      if (episodeResult.torrents.length > 0) {
        const bestTorrent = episodeResult.bestTorrent || episodeResult.torrents[0];
        this.logger.log(`Found episode torrent: ${bestTorrent.title}`);

        // Download the episode
        await this.initiateTorrentDownloadForEpisode(request, bestTorrent, seasonNumber, episode);

        // Update the main request status to show we found and initiated a download
        await this.requestedTorrentsService.markAsFound(request.id, {
          title: bestTorrent.title,
          link: bestTorrent.link,
          magnetUri: bestTorrent.magnetUri,
          size: bestTorrent.size,
          seeders: bestTorrent.seeders,
          indexer: bestTorrent.indexer,
        });
        break; // Download one episode at a time
      }
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
