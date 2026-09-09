import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { BaseExternalApiService } from './base-external-api.service';
import { TorrentFilterService, FilterCriteria } from './torrent-filter.service';
import { GamePlatformsService } from '../../config/game-platforms.service';
import { AppConfigurationService } from '../../config/services/app-configuration.service';
import {
  ExternalApiResponse,
  ExternalApiConfig,
  TorrentResult,
  TorrentSearchParams,
  ProwlarrRelease,
} from '../interfaces/external-api.interface';
import { MovieTorrentSearchDto, TvTorrentSearchDto, GameTorrentSearchDto } from '../dto/torrent-search.dto';

/**
 * ASP.NET Core binds a `List<int>` from repeated keys (`indexerIds=1&indexerIds=2`),
 * not from axios' default bracket notation (`indexerIds[]=1`).
 */
const PROWLARR_REQUEST_OPTIONS = {
  paramsSerializer: { indexes: null as null },
};

/**
 * Search against every indexer configured in Prowlarr.
 *
 * Prowlarr's `/api/v1/search` speaks Newznab, so the category tables below are
 * the standard Newznab codes. It returns a flat array of releases, and rewrites
 * both `downloadUrl` and `magnetUrl` into signed links back through itself —
 * those proxy links are resolved at download time, not here; see
 * `DownloadService.createDownload`.
 */
@Injectable()
export class ProwlarrService extends BaseExternalApiService {
  /**
   * Results to ask each indexer for. Ranking only ever picks from the top of
   * the list, so a broad query does not need to drag back thousands of rows.
   */
  private static readonly SEARCH_LIMIT = 100;

  constructor(
    protected readonly httpService: HttpService,
    protected readonly configService: ConfigService,
    private readonly torrentFilterService: TorrentFilterService,
    private readonly gamePlatformsService: GamePlatformsService,
    private readonly appConfigService: AppConfigurationService,
  ) {
    super(httpService, configService);
  }

  protected async getServiceConfig(): Promise<ExternalApiConfig> {
    // Runtime config lives in the database; env vars are the fallback for
    // installs that never went through the onboarding wizard.
    try {
      const prowlarrConfig = await this.appConfigService.getProwlarrConfig();

      if (prowlarrConfig.apiKey) {
        return {
          baseUrl: prowlarrConfig.url,
          apiKey: prowlarrConfig.apiKey,
          timeout: 30000,
          retryAttempts: 2,
          retryDelay: 1000,
        };
      }
    } catch (error) {
      this.logger.debug('Could not get Prowlarr config from database, falling back to environment variables');
    }

    const prowlarrUrl = this.configService.get<string>('PROWLARR_URL', 'http://localhost:9696');
    const apiKey = this.configService.get<string>('PROWLARR_API_KEY');

    if (!apiKey) {
      this.logger.warn('PROWLARR_API_KEY not configured - Prowlarr functionality will be limited');
    }

    return {
      baseUrl: prowlarrUrl,
      apiKey,
      // Prowlarr fans a query out to every indexer and waits for the slowest,
      // so it needs a longer leash than a plain metadata lookup.
      timeout: 30000,
      retryAttempts: 2,
      retryDelay: 1000,
    };
  }

  async searchTorrents(searchParams: TorrentSearchParams): Promise<ExternalApiResponse<TorrentResult[]>> {
    try {
      const params: Record<string, any> = {
        query: searchParams.query,
        // The generic Newznab function, which every indexer supports. The typed
        // ones (movie, tvsearch) want ids we do not always have.
        type: 'search',
        limit: ProwlarrService.SEARCH_LIMIT,
      };

      // Only add categories if one is specified - otherwise Prowlarr searches all of them.
      const categoryCode = searchParams.categoryCode || this.mapCategoryToNewznab(searchParams.category);
      if (categoryCode) {
        params.categories = categoryCode;
      }

      // Prowlarr addresses indexers by numeric id, so caller-supplied names
      // have to be resolved against /indexer first.
      if (searchParams.indexers && searchParams.indexers.length > 0) {
        const indexerIds = await this.resolveIndexerIds(searchParams.indexers);
        if (indexerIds.length > 0) {
          params.indexerIds = indexerIds;
        }
      }

      const response = await this.makeRequest<ProwlarrRelease[]>('/api/v1/search', params, PROWLARR_REQUEST_OPTIONS);

      if (!response.success || !response.data) {
        return {
          success: false,
          error: response.error || 'Failed to search torrents',
        };
      }

      const rawTorrents = response.data
        // Prowlarr indexes Usenet too; Downloadarr only knows how to grab torrents.
        .filter((release) => release.protocol !== 'usenet')
        .map((release) => this.mapProwlarrToTorrentResult(release));

      // Apply advanced filtering and ranking
      const filterCriteria: FilterCriteria = {
        minSeeders: searchParams.minSeeders,
        maxSize: searchParams.maxSize,
        preferredQualities: searchParams.quality,
        preferredFormats: searchParams.format,
        preferredLanguages: searchParams.language,
      };

      const filteredTorrents = this.torrentFilterService.filterAndRankTorrents(rawTorrents, filterCriteria);

      return {
        success: true,
        data: filteredTorrents,
      };
    } catch (error) {
      this.logger.error('Error searching torrents:', error);
      return {
        success: false,
        error: error.message || 'Failed to search torrents',
      };
    }
  }

  async searchMovieTorrents(searchDto: MovieTorrentSearchDto): Promise<ExternalApiResponse<TorrentResult[]>> {
    const searchParams: TorrentSearchParams = {
      query: this.buildMovieQuery(searchDto),
      category: 'Movies',
      indexers: searchDto.indexers,
      minSeeders: searchDto.minSeeders,
      maxSize: searchDto.maxSize,
      quality: searchDto.quality,
      format: searchDto.format,
      language: searchDto.language,
    };

    return this.searchTorrents(searchParams);
  }

  async searchTvTorrents(searchDto: TvTorrentSearchDto): Promise<ExternalApiResponse<TorrentResult[]>> {
    const searchParams: TorrentSearchParams = {
      query: this.buildTvQuery(searchDto),
      category: 'TV',
      indexers: searchDto.indexers,
      minSeeders: searchDto.minSeeders,
      maxSize: searchDto.maxSize,
      quality: searchDto.quality,
      format: searchDto.format,
      language: searchDto.language,
    };

    return this.searchTorrents(searchParams);
  }

  async searchGameTorrents(searchDto: GameTorrentSearchDto): Promise<ExternalApiResponse<TorrentResult[]>> {
    // Determine the appropriate category code based on platform
    let categoryCode: string | undefined; // No default - search all categories if no platform

    this.logger.debug(`Game search - Platform: ${searchDto.platform}, Query: ${searchDto.query}`);

    if (searchDto.platform) {
      const normalizedPlatform = this.gamePlatformsService.normalizePlatform(searchDto.platform);
      this.logger.debug(`Normalized platform: ${normalizedPlatform}`);

      if (normalizedPlatform) {
        categoryCode = this.gamePlatformsService.getIndexerCategoryForPlatform(normalizedPlatform);
        this.logger.debug(`Category code for ${normalizedPlatform}: ${categoryCode}`);
      }
    } else {
      this.logger.debug('No platform specified, searching all game categories');
    }

    const searchParams: TorrentSearchParams = {
      query: this.buildGameQuery(searchDto),
      categoryCode, // Use category code directly
      indexers: searchDto.indexers,
      minSeeders: searchDto.minSeeders,
      maxSize: searchDto.maxSize,
      language: searchDto.language,
    };

    return this.searchTorrents(searchParams);
  }

  /**
   * The indexers Prowlarr currently has enabled, for the settings UI and for
   * turning caller-supplied indexer names into the ids the search API wants.
   */
  async getIndexers(): Promise<ExternalApiResponse<Array<{ id: number; name: string; protocol: string; enable: boolean }>>> {
    const response = await this.makeRequest<Array<Record<string, any>>>('/api/v1/indexer');

    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.error || 'Failed to fetch indexers',
      };
    }

    return {
      success: true,
      data: response.data.map((indexer) => ({
        id: indexer.id,
        name: indexer.name,
        protocol: indexer.protocol,
        enable: indexer.enable !== false,
      })),
    };
  }

  private async resolveIndexerIds(indexers: string[]): Promise<number[]> {
    // Ids can be passed straight through; anything else is matched by name.
    const numeric = indexers.filter((indexer) => /^\d+$/.test(indexer)).map(Number);
    const byName = indexers.filter((indexer) => !/^\d+$/.test(indexer));

    if (byName.length === 0) {
      return numeric;
    }

    const known = await this.getIndexers();
    if (!known.success || !known.data) {
      this.logger.warn('Could not resolve indexer names - searching all indexers instead');
      return numeric;
    }

    const wanted = new Set(byName.map((name) => name.toLowerCase()));
    const resolved = known.data
      .filter((indexer) => wanted.has(indexer.name.toLowerCase()))
      .map((indexer) => indexer.id);

    return [...numeric, ...resolved];
  }

  private buildMovieQuery(searchDto: MovieTorrentSearchDto): string {
    let query = searchDto.query;

    if (searchDto.year) {
      query += ` ${searchDto.year}`;
    }

    return query;
  }

  private buildTvQuery(searchDto: TvTorrentSearchDto): string {
    let query = searchDto.query;

    if (searchDto.season && searchDto.episode) {
      query += ` S${searchDto.season.toString().padStart(2, '0')}E${searchDto.episode.toString().padStart(2, '0')}`;
    } else if (searchDto.season) {
      query += ` S${searchDto.season.toString().padStart(2, '0')}`;
    }

    return query;
  }

  private buildGameQuery(searchDto: GameTorrentSearchDto): string {
    // For games, we keep the query simple and let category filtering handle platform specificity
    // This prevents the search from becoming too restrictive
    let query = searchDto.query;

    // Don't add platform names to the query - this is now handled by category filtering
    // Don't add year to query for games as it often makes searches too specific
    // Game torrents are usually titled with the game name only, not the release year
    // The year and platform filtering should be handled by category filtering and post-search filtering

    return query;
  }

  private mapCategoryToNewznab(category?: string): string {
    const categoryMap: Record<string, string> = {
      'Movies': '2000',
      'TV': '5000',
      'Movies/HD': '2040',
      'Movies/SD': '2030',
      'Movies/UHD': '2160',
      'TV/HD': '5040',
      'TV/SD': '5030',
      'PC/Games': '4050',
      'PC/Mac': '4030',
      'PC/Mobile-iOS': '4060',
      'PC/Mobile-Android': '4070',
      'Console': '1000',
      'Console/NDS': '1010',
      'Console/PSP': '1020',
      'Console/Wii': '1030',
      'Console/XBox': '1040',
      'Console/XBox 360': '1050',
      'Console/PS3': '1080',
      'Console/3DS': '1110',
      'Console/PS Vita': '1120',
      'Console/WiiU': '1130',
      'Console/XBox One': '1140',
      'Console/PS4': '1180',
      'Games': '4050', // Default to PC/Games
      'TV/UHD': '5160',
    };

    return category ? categoryMap[category] || '' : '';
  }

  private mapProwlarrToTorrentResult(release: ProwlarrRelease): TorrentResult {
    return {
      title: release.title,
      // Prowlarr rewrites both fields into proxy links back through itself, so
      // neither is ever a `magnet:` URI and `magnetUri` is deliberately left
      // unset. A release carries at least one of the two; the .torrent side is
      // preferred because it resolves in one hop.
      link: release.downloadUrl || release.magnetUrl || '',
      size: this.formatSize(release.size),
      seeders: release.seeders ?? 0,
      leechers: release.leechers ?? 0,
      category: this.describeCategories(release),
      indexer: release.indexer,
      publishDate: release.publishDate,
      quality: this.extractQuality(release.title),
      format: this.extractFormat(release.title),
      language: this.torrentFilterService.detectLanguage(release.title),
    };
  }

  /**
   * A release carries the full category tree it matched; the most specific
   * entry is the useful label.
   */
  private describeCategories(release: ProwlarrRelease): string {
    const categories = release.categories || [];

    if (categories.length === 0) {
      return 'Unknown';
    }

    // Sub-categories carry higher ids than their parent (2040 under 2000), so
    // the highest id is the most specific label available.
    const mostSpecific = categories.reduce((best, current) => (current.id > best.id ? current : best));

    return mostSpecific.name || 'Unknown';
  }

  private extractQuality(title: string): string | undefined {
    const qualities = ['2160p', '4K', '1080p', '720p', '480p', 'SD'];
    const titleLower = title.toLowerCase();

    for (const quality of qualities) {
      if (titleLower.includes(quality.toLowerCase())) {
        return quality;
      }
    }

    return undefined;
  }

  private extractFormat(title: string): string | undefined {
    const formats = ['x265', 'x264', 'HEVC', 'AV1', 'XviD', 'DivX'];
    const titleLower = title.toLowerCase();

    for (const format of formats) {
      if (titleLower.includes(format.toLowerCase())) {
        return format;
      }
    }

    return undefined;
  }

  private formatSize(sizeInBytes?: number): string {
    if (!sizeInBytes || typeof sizeInBytes !== 'number' || isNaN(sizeInBytes)) {
      return 'Unknown';
    }

    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = sizeInBytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }
}
