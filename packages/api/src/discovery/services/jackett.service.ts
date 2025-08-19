import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { BaseExternalApiService } from './base-external-api.service';
import { TorrentFilterService, FilterCriteria } from './torrent-filter.service';
import {
  ExternalApiResponse,
  ExternalApiConfig,
  TorrentResult,
  TorrentSearchParams,
  JackettSearchResponse,
  JackettTorrent,
} from '../interfaces/external-api.interface';
import { TorrentSearchDto, MovieTorrentSearchDto, TvTorrentSearchDto } from '../dto/torrent-search.dto';

@Injectable()
export class JackettService extends BaseExternalApiService {

  constructor(
    protected readonly httpService: HttpService,
    protected readonly configService: ConfigService,
    private readonly torrentFilterService: TorrentFilterService,
  ) {
    super(httpService, configService);
  }

  protected getServiceConfig(): ExternalApiConfig {
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
        Category: this.mapCategoryToJackett(searchParams.category),
      };

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

  private mapCategoryToJackett(category?: string): string {
    const categoryMap: Record<string, string> = {
      'Movies': '2000',
      'TV': '5000',
      'Movies/HD': '2040',
      'Movies/SD': '2030',
      'Movies/UHD': '2160',
      'TV/HD': '5040',
      'TV/SD': '5030',
      'TV/UHD': '5160',
    };

    return category ? categoryMap[category] || '' : '';
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
