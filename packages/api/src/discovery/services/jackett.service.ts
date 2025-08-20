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
  JackettSearchResponse,
  JackettTorrent,
} from '../interfaces/external-api.interface';
import { MovieTorrentSearchDto, TvTorrentSearchDto, GameTorrentSearchDto } from '../dto/torrent-search.dto';

@Injectable()
export class JackettService extends BaseExternalApiService {

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
    // Try to get configuration from database first
    try {
      const jackettConfig = await this.appConfigService.getJackettConfig();

      if (jackettConfig.apiKey) {
        return {
          baseUrl: jackettConfig.url,
          apiKey: jackettConfig.apiKey,
          timeout: 15000,
          retryAttempts: 2,
          retryDelay: 1000,
        };
      }
    } catch (error) {
      this.logger.debug('Could not get Jackett config from database, falling back to environment variables');
    }

    // Fallback to environment variables
    const jackettUrl = this.configService.get<string>('JACKETT_URL', 'http://localhost:9117');
    const apiKey = this.configService.get<string>('JACKETT_API_KEY');

    if (!apiKey) {
      this.logger.warn('JACKETT_API_KEY not configured - Jackett functionality will be limited');
    }

    return {
      baseUrl: jackettUrl,
      apiKey,
      timeout: 15000,
      retryAttempts: 2,
      retryDelay: 1000,
    };
  }

  async searchTorrents(searchParams: TorrentSearchParams): Promise<ExternalApiResponse<TorrentResult[]>> {
    try {
      const params: Record<string, any> = {
        Query: searchParams.query,
      };

      // Only add category if one is specified
      const categoryCode = searchParams.categoryCode || this.mapCategoryToJackett(searchParams.category);
      if (categoryCode) {
        params.Category = categoryCode;
      }

      // Add indexers if specified
      if (searchParams.indexers && searchParams.indexers.length > 0) {
        params.Tracker = searchParams.indexers.join(',');
      }

      const response = await this.makeRequest<JackettSearchResponse>('/api/v2.0/indexers/all/results', params);

      if (!response.success || !response.data) {
        return {
          success: false,
          error: response.error || 'Failed to search torrents',
        };
      }

      const rawTorrents = response.data.Results.map((torrent) => this.mapJackettToTorrentResult(torrent));

      // Apply advanced filtering and ranking
      const filterCriteria: FilterCriteria = {
        minSeeders: searchParams.minSeeders,
        maxSize: searchParams.maxSize,
        preferredQualities: searchParams.quality,
        preferredFormats: searchParams.format,
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
    };

    return this.searchTorrents(searchParams);
  }

  async searchGameTorrents(searchDto: GameTorrentSearchDto): Promise<ExternalApiResponse<TorrentResult[]>> {
    // Determine the appropriate Jackett category code based on platform
    let jackettCategoryCode: string | undefined; // No default - search all categories if no platform

    this.logger.debug(`Game search - Platform: ${searchDto.platform}, Query: ${searchDto.query}`);

    if (searchDto.platform) {
      const normalizedPlatform = this.gamePlatformsService.normalizePlatform(searchDto.platform);
      this.logger.debug(`Normalized platform: ${normalizedPlatform}`);

      if (normalizedPlatform) {
        jackettCategoryCode = this.gamePlatformsService.getJackettCategoryForPlatform(normalizedPlatform);
        this.logger.debug(`Jackett category code for ${normalizedPlatform}: ${jackettCategoryCode}`);
      }
    } else {
      this.logger.debug('No platform specified, searching all game categories');
    }

    const searchParams: TorrentSearchParams = {
      query: this.buildGameQuery(searchDto),
      categoryCode: jackettCategoryCode, // Use category code directly
      indexers: searchDto.indexers,
      minSeeders: searchDto.minSeeders,
      maxSize: searchDto.maxSize,
    };

    return this.searchTorrents(searchParams);
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
    // For games, we keep the query simple and let Jackett category filtering handle platform specificity
    // This prevents the search from becoming too restrictive
    let query = searchDto.query;

    // Don't add platform names to the query - this is now handled by Jackett category filtering
    // Don't add year to query for games as it often makes searches too specific
    // Game torrents are usually titled with the game name only, not the release year
    // The year and platform filtering should be handled by category filtering and post-search filtering

    return query;
  }

  private mapCategoryToJackett(category?: string): string {
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

  private mapJackettCodeToCategory(code: string): string {
    const codeMap: Record<string, string> = {
      '2000': 'Movies',
      '5000': 'TV',
      '2040': 'Movies/HD',
      '2030': 'Movies/SD',
      '2160': 'Movies/UHD',
      '5040': 'TV/HD',
      '5030': 'TV/SD',
      '4050': 'PC/Games',
      '4030': 'PC/Mac',
      '4060': 'PC/Mobile-iOS',
      '4070': 'PC/Mobile-Android',
      '1000': 'Console',
      '1010': 'Console/NDS',
      '1020': 'Console/PSP',
      '1030': 'Console/Wii',
      '1040': 'Console/XBox',
      '1050': 'Console/XBox 360',
      '1080': 'Console/PS3',
      '1110': 'Console/3DS',
      '1120': 'Console/PS Vita',
      '1130': 'Console/WiiU',
      '1140': 'Console/XBox One',
      '1180': 'Console/PS4',
      '5160': 'TV/UHD',
    };

    return codeMap[code] || 'PC/Games'; // Default to PC/Games
  }



  private mapJackettToTorrentResult(jackettTorrent: JackettTorrent): TorrentResult {
    return {
      title: jackettTorrent.Title,
      link: jackettTorrent.Link,
      magnetUri: jackettTorrent.MagnetUri,
      size: this.formatSize(jackettTorrent.Size),
      seeders: jackettTorrent.Seeders || 0,
      leechers: jackettTorrent.Peers || 0,
      category: jackettTorrent.CategoryDesc,
      indexer: jackettTorrent.Tracker,
      publishDate: jackettTorrent.PublishDate,
      quality: this.extractQuality(jackettTorrent.Title),
      format: this.extractFormat(jackettTorrent.Title),
    };
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

  private parseSize(sizeString: string): number {
    const match = sizeString.match(/^([\d.]+)\s*(B|KB|MB|GB|TB)$/i);
    if (!match) return 0;

    const value = parseFloat(match[1]);
    const unit = match[2].toUpperCase();

    const multipliers: Record<string, number> = {
      'B': 1,
      'KB': 1024,
      'MB': 1024 * 1024,
      'GB': 1024 * 1024 * 1024,
      'TB': 1024 * 1024 * 1024 * 1024,
    };

    return value * (multipliers[unit] || 0);
  }
}
