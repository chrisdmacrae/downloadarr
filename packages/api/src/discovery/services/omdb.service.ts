import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { BaseExternalApiService } from './base-external-api.service';
import { ExternalApiConfig, ExternalApiResponse, MovieDetails, SearchResult } from '../interfaces/external-api.interface';

interface OmdbSearchResponse {
  Search?: OmdbMovieItem[];
  totalResults?: string;
  Response: string;
  Error?: string;
}

interface OmdbMovieItem {
  Title: string;
  Year: string;
  imdbID: string;
  Type: string;
  Poster: string;
}

interface OmdbMovieDetails {
  Title: string;
  Year: string;
  Rated: string;
  Released: string;
  Runtime: string;
  Genre: string;
  Director: string;
  Writer: string;
  Actors: string;
  Plot: string;
  Language: string;
  Country: string;
  Awards: string;
  Poster: string;
  Ratings: Array<{ Source: string; Value: string }>;
  Metascore: string;
  imdbRating: string;
  imdbVotes: string;
  imdbID: string;
  Type: string;
  DVD: string;
  BoxOffice: string;
  Production: string;
  Website: string;
  Response: string;
  Error?: string;
}

@Injectable()
export class OmdbService extends BaseExternalApiService {

  constructor(
    protected readonly httpService: HttpService,
    protected readonly configService: ConfigService,
  ) {
    super(httpService, configService);
  }

  protected getServiceConfig(): ExternalApiConfig {
    return {
      baseUrl: 'http://www.omdbapi.com/',
      apiKey: this.validateApiKey('OMDB_API_KEY'),
      timeout: 10000,
      retryAttempts: 2,
      retryDelay: 1000,
      rateLimit: {
        requests: 1000, // OMDB allows 1000 requests per day for free tier
        window: 24 * 60 * 60 * 1000, // 24 hours
      },
    };
  }

  async searchMovies(query: string, year?: number, page: number = 1): Promise<ExternalApiResponse<SearchResult[]>> {
    try {
      const sanitizedQuery = this.sanitizeSearchQuery(query);
      if (!sanitizedQuery) {
        return {
          success: false,
          error: 'Invalid search query',
        };
      }

      const params: Record<string, any> = {
        s: sanitizedQuery,
        type: 'movie',
        page: page.toString(),
      };

      if (year) {
        params.y = year.toString();
      }

      const response = await this.makeRequest<OmdbSearchResponse>('', params);

      if (!response.success || !response.data) {
        return {
          success: false,
          error: response.error,
        };
      }

      if (response.data.Response === 'False') {
        return {
          success: false,
          error: response.data.Error || 'No results found',
        };
      }

      const searchResults: SearchResult[] = (response.data.Search || []).map(item => ({
        id: item.imdbID,
        title: item.Title,
        year: parseInt(item.Year),
        poster: item.Poster !== 'N/A' ? item.Poster : undefined,
        type: 'movie' as const,
      }));

      return {
        success: true,
        data: searchResults,
      };
    } catch (error) {
      this.logger.error(`Error searching movies: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async getMovieDetails(imdbId: string): Promise<ExternalApiResponse<MovieDetails>> {
    try {
      if (!imdbId || !imdbId.startsWith('tt')) {
        return {
          success: false,
          error: 'Invalid IMDb ID',
        };
      }

      const response = await this.makeRequest<OmdbMovieDetails>('', {
        i: imdbId,
        plot: 'full',
      });

      if (!response.success || !response.data) {
        return {
          success: false,
          error: response.error,
        };
      }

      if (response.data.Response === 'False') {
        return {
          success: false,
          error: response.data.Error || 'Movie not found',
        };
      }

      const movieDetails: MovieDetails = {
        id: response.data.imdbID,
        title: response.data.Title,
        year: parseInt(response.data.Year),
        poster: response.data.Poster !== 'N/A' ? response.data.Poster : undefined,
        overview: response.data.Plot !== 'N/A' ? response.data.Plot : undefined,
        type: 'movie',
        imdbId: response.data.imdbID,
        runtime: this.parseRuntime(response.data.Runtime),
        genre: response.data.Genre !== 'N/A' ? response.data.Genre.split(', ') : undefined,
        director: response.data.Director !== 'N/A' ? response.data.Director : undefined,
        actors: response.data.Actors !== 'N/A' ? response.data.Actors : undefined,
        plot: response.data.Plot !== 'N/A' ? response.data.Plot : undefined,
        rating: response.data.imdbRating !== 'N/A' ? parseFloat(response.data.imdbRating) : undefined,
        released: response.data.Released !== 'N/A' ? response.data.Released : undefined,
      };

      return {
        success: true,
        data: movieDetails,
      };
    } catch (error) {
      this.logger.error(`Error getting movie details: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private parseRuntime(runtime: string): number | undefined {
    if (!runtime || runtime === 'N/A') return undefined;
    const match = runtime.match(/(\d+)/);
    return match ? parseInt(match[1]) : undefined;
  }
}
