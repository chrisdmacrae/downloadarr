import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { BaseExternalApiService } from './base-external-api.service';
import { ExternalApiConfig, ExternalApiResponse, GameDetails, SearchResult } from '../interfaces/external-api.interface';
import { firstValueFrom, timeout, retry, catchError } from 'rxjs';
import { AxiosRequestConfig } from 'axios';

interface IgdbGame {
  id: number;
  name: string;
  summary?: string;
  cover?: {
    id: number;
    url: string;
  };
  first_release_date?: number;
  genres?: Array<{ id: number; name: string }>;
  platforms?: Array<{ id: number; name: string; abbreviation: string }>;
  involved_companies?: Array<{
    id: number;
    company: { id: number; name: string };
    developer: boolean;
    publisher: boolean;
  }>;
  screenshots?: Array<{ id: number; url: string }>;
  rating?: number;
  rating_count?: number;
}

@Injectable()
export class IgdbService extends BaseExternalApiService {
  private readonly imageBaseUrl = 'https://images.igdb.com/igdb/image/upload/t_cover_big/';
  private readonly screenshotBaseUrl = 'https://images.igdb.com/igdb/image/upload/t_screenshot_med/';

  constructor(
    protected readonly httpService: HttpService,
    protected readonly configService: ConfigService,
  ) {
    super(httpService, configService);
  }

  protected getServiceConfig(): ExternalApiConfig {
    return {
      baseUrl: 'https://api.igdb.com/v4',
      timeout: 10000,
      retryAttempts: 2,
      retryDelay: 1000,
      rateLimit: {
        requests: 4, // IGDB allows 4 requests per second
        window: 1000, // 1 second
      },
    };
  }

  private getAuthHeaders(): Record<string, string> {
    const clientId = this.validateApiKey('IGDB_CLIENT_ID');
    const accessToken = this.validateApiKey('IGDB_ACCESS_TOKEN');

    return {
      'Client-ID': clientId,
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'text/plain',
    };
  }

  async searchGames(query: string, limit: number = 20): Promise<ExternalApiResponse<SearchResult[]>> {
    try {
      const sanitizedQuery = this.sanitizeSearchQuery(query);
      if (!sanitizedQuery) {
        return {
          success: false,
          error: 'Invalid search query',
        };
      }

      const requestBody = `search "${sanitizedQuery}";
fields id, name, summary, cover.url, first_release_date, genres.name, platforms.name;
limit ${limit};
where category = 0;`;

      const response = await this.makeIgdbRequest<IgdbGame[]>('/games', requestBody);

      if (!response.success || !response.data) {
        return {
          success: false,
          error: response.error,
        };
      }

      const searchResults: SearchResult[] = response.data.map(game => ({
        id: game.id.toString(),
        title: game.name,
        year: game.first_release_date ? new Date(game.first_release_date * 1000).getFullYear() : undefined,
        poster: game.cover?.url ? this.formatImageUrl(game.cover.url) : undefined,
        overview: game.summary || undefined,
        type: 'game' as const,
      }));

      return {
        success: true,
        data: searchResults,
      };
    } catch (error) {
      this.logger.error(`Error searching games: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async getGameDetails(igdbId: string): Promise<ExternalApiResponse<GameDetails>> {
    try {
      const id = parseInt(igdbId);
      if (isNaN(id)) {
        return {
          success: false,
          error: 'Invalid IGDB ID',
        };
      }

      const requestBody = `fields id, name, summary, cover.url, first_release_date, genres.name, platforms.name, platforms.abbreviation, involved_companies.company.name, involved_companies.developer, involved_companies.publisher, screenshots.url, rating, rating_count;
where id = ${id};`;

      const response = await this.makeIgdbRequest<IgdbGame[]>('/games', requestBody);

      if (!response.success || !response.data || response.data.length === 0) {
        return {
          success: false,
          error: 'Game not found',
        };
      }

      const game = response.data[0];
      const developers = game.involved_companies?.filter(c => c.developer).map(c => c.company.name) || [];
      const publishers = game.involved_companies?.filter(c => c.publisher).map(c => c.company.name) || [];

      const gameDetails: GameDetails = {
        id: game.id.toString(),
        title: game.name,
        year: game.first_release_date ? new Date(game.first_release_date * 1000).getFullYear() : undefined,
        poster: game.cover?.url ? this.formatImageUrl(game.cover.url) : undefined,
        overview: game.summary || undefined,
        type: 'game',
        igdbId: game.id,
        platforms: game.platforms?.map(p => p.name) || undefined,
        genre: game.genres?.map(g => g.name) || undefined,
        developer: developers.length > 0 ? developers.join(', ') : undefined,
        publisher: publishers.length > 0 ? publishers.join(', ') : undefined,
        releaseDate: game.first_release_date ? new Date(game.first_release_date * 1000).toISOString().split('T')[0] : undefined,
        rating: game.rating ? Math.round(game.rating / 10) : undefined, // Convert to 0-10 scale
        screenshots: game.screenshots?.map(s => this.formatScreenshotUrl(s.url)) || undefined,
      };

      return {
        success: true,
        data: gameDetails,
      };
    } catch (error) {
      this.logger.error(`Error getting game details: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async getPopularGames(limit: number = 20): Promise<ExternalApiResponse<SearchResult[]>> {
    try {
      this.logger.log(`Starting getPopularGames with limit: ${limit}`);

      // Get supported platform IDs
      const supportedPlatformIds = [18, 19, 4, 21, 5, 41, 33, 22, 24, 130, 29, 32, 23, 7, 8, 9, 11, 12];
      const platformFilter = supportedPlatformIds.join(',');

      const requestBody = `fields id, name, summary, cover.url, first_release_date, genres.name, platforms.name;
sort rating desc;
limit ${limit};
where category = 0 & rating_count > 100 & platforms = (${platformFilter});`;

      this.logger.log(`IGDB request body: ${requestBody}`);
      const response = await this.makeIgdbRequest<IgdbGame[]>('/games', requestBody);

      this.logger.log(`IGDB response for popular games:`, {
        success: response.success,
        error: response.error,
        dataLength: response.data ? response.data.length : 'no data',
        rawData: response.data ? JSON.stringify(response.data.slice(0, 2)) : 'no data'
      });

      if (!response.success || !response.data) {
        this.logger.error(`IGDB popular games request failed:`, response.error);
        return {
          success: false,
          error: response.error,
        };
      }

      this.logger.log(`Raw IGDB data sample:`, response.data.slice(0, 1));

      const searchResults: SearchResult[] = response.data.map(game => {
        this.logger.log(`Mapping game:`, { id: game.id, name: game.name, hasName: !!game.name, hasCover: !!game.cover });
        return {
          id: game.id.toString(),
          title: game.name,
          year: game.first_release_date ? new Date(game.first_release_date * 1000).getFullYear() : undefined,
          poster: game.cover?.url ? this.formatImageUrl(game.cover.url) : undefined,
          overview: game.summary || undefined,
          type: 'game' as const,
        };
      });

      this.logger.log(`Mapped ${searchResults.length} games for popular games response`);
      this.logger.log(`Sample mapped result:`, searchResults[0]);

      return {
        success: true,
        data: searchResults,
      };
    } catch (error) {
      this.logger.error(`Error getting popular games: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private async makeIgdbRequest<T>(endpoint: string, body: string): Promise<ExternalApiResponse<T>> {
    try {
      this.config = this.getServiceConfig();

      const url = `${this.config.baseUrl}${endpoint}`;
      const requestConfig: AxiosRequestConfig = {
        timeout: 30000, // Increase timeout to 30 seconds
        headers: this.getAuthHeaders(),
      };

      this.logger.debug(`Making IGDB request to: ${url}`, { body });

      // Use a simpler approach without RxJS pipes that might be causing issues
      const response = await this.httpService.axiosRef.post<T>(url, body, requestConfig);

      this.logger.debug(`IGDB response received:`, {
        status: response.status,
        dataLength: Array.isArray(response.data) ? response.data.length : 'not array',
        firstItem: Array.isArray(response.data) && response.data.length > 0 ? response.data[0] : 'none'
      });

      return {
        success: true,
        data: response.data,
        statusCode: response.status,
      };
    } catch (error) {
      this.logger.error(`IGDB request failed for ${endpoint}:`, error);
      return {
        success: false,
        error: error.message || 'Unknown error occurred',
        statusCode: error.status || 500,
      };
    }
  }

  private formatImageUrl(url: string): string {
    if (!url) return '';
    // Remove the 't_thumb' prefix and add our desired size
    const imageId = url.replace('//images.igdb.com/igdb/image/upload/t_thumb/', '');
    return `${this.imageBaseUrl}${imageId}`;
  }

  private formatScreenshotUrl(url: string): string {
    if (!url) return '';
    const imageId = url.replace('//images.igdb.com/igdb/image/upload/t_thumb/', '');
    return `${this.screenshotBaseUrl}${imageId}`;
  }

  async getGamesByPlatform(platformName: string, limit: number = 20): Promise<ExternalApiResponse<SearchResult[]>> {
    try {
      this.logger.log(`Getting games for platform: ${platformName}, limit: ${limit}`);

      // Map platform names to IGDB platform IDs
      const platformMap: Record<string, number> = {
        'NES': 18,
        'SNES': 19,
        'N64': 4,
        'GameCube': 21,
        'Wii': 5,
        'Wii U': 41,
        'Game Boy': 33,
        'Game Boy Color': 22,
        'Game Boy Advance': 24,
        'Switch': 130,
        'Genesis': 29,
        'Saturn': 32,
        'Dreamcast': 23,
        'PlayStation': 7,
        'PlayStation 2': 8,
        'PlayStation 3': 9,
        'Xbox': 11,
        'Xbox 360': 12,
      };

      const platformId = platformMap[platformName];
      if (!platformId) {
        return {
          success: false,
          error: `Platform "${platformName}" not supported`,
        };
      }

      const requestBody = `fields id, name, summary, cover.url, first_release_date, genres.name, platforms.name;
sort rating desc;
limit ${limit};
where category = 0 & platforms = (${platformId}) & rating_count > 10;`;

      const response = await this.makeIgdbRequest<IgdbGame[]>('/games', requestBody);

      if (!response.success || !response.data) {
        return {
          success: false,
          error: response.error,
        };
      }

      const searchResults: SearchResult[] = response.data.map(game => ({
        id: game.id.toString(),
        title: game.name,
        year: game.first_release_date ? new Date(game.first_release_date * 1000).getFullYear() : undefined,
        poster: game.cover?.url ? this.formatImageUrl(game.cover.url) : undefined,
        overview: game.summary || undefined,
        type: 'game' as const,
      }));

      return {
        success: true,
        data: searchResults,
      };
    } catch (error) {
      this.logger.error(`Error getting games by platform: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async getSupportedPlatforms(): Promise<ExternalApiResponse<Array<{ name: string; id: number }>>> {
    try {
      const platforms = [
        { name: 'NES', id: 18 },
        { name: 'SNES', id: 19 },
        { name: 'N64', id: 4 },
        { name: 'GameCube', id: 21 },
        { name: 'Wii', id: 5 },
        { name: 'Wii U', id: 41 },
        { name: 'Game Boy', id: 33 },
        { name: 'Game Boy Color', id: 22 },
        { name: 'Game Boy Advance', id: 24 },
        { name: 'Switch', id: 130 },
        { name: 'Genesis', id: 29 },
        { name: 'Saturn', id: 32 },
        { name: 'Dreamcast', id: 23 },
        { name: 'PlayStation', id: 7 },
        { name: 'PlayStation 2', id: 8 },
        { name: 'PlayStation 3', id: 9 },
        { name: 'Xbox', id: 11 },
        { name: 'Xbox 360', id: 12 },
      ];

      return {
        success: true,
        data: platforms,
      };
    } catch (error) {
      this.logger.error(`Error getting supported platforms: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
