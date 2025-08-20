import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { AxiosRequestConfig, AxiosResponse } from 'axios';
import { firstValueFrom, timeout, retry, catchError } from 'rxjs';
import { BaseExternalApiService } from './base-external-api.service';
import { ExternalApiConfig, ExternalApiResponse, TvShowDetails, SearchResult, MovieDetails } from '../interfaces/external-api.interface';

interface TmdbSearchResponse {
  page: number;
  results: TmdbTvShowItem[];
  total_pages: number;
  total_results: number;
}

interface TmdbMovieSearchResponse {
  page: number;
  results: TmdbMovieItem[];
  total_pages: number;
  total_results: number;
}

interface TmdbGenre {
  id: number;
  name: string;
}

interface TmdbGenresResponse {
  genres: TmdbGenre[];
}

interface TmdbTvShowItem {
  id: number;
  name: string;
  original_name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string;
  genre_ids: number[];
  origin_country: string[];
  original_language: string;
  popularity: number;
  vote_average: number;
  vote_count: number;
}

interface TmdbMovieItem {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  genre_ids: number[];
  original_language: string;
  popularity: number;
  vote_average: number;
  vote_count: number;
  adult: boolean;
}

interface TmdbTvShowDetails {
  id: number;
  name: string;
  original_name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string;
  last_air_date: string;
  genres: Array<{ id: number; name: string }>;
  created_by: Array<{ id: number; name: string }>;
  networks: Array<{ id: number; name: string; logo_path: string | null }>;
  number_of_episodes: number;
  number_of_seasons: number;
  status: string;
  type: string;
  vote_average: number;
  vote_count: number;
  external_ids: {
    imdb_id: string | null;
    tvdb_id: number | null;
  };
}

interface TmdbMovieDetails {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  genres: Array<{ id: number; name: string }>;
  runtime: number;
  vote_average: number;
  vote_count: number;
  adult: boolean;
  external_ids: {
    imdb_id: string | null;
  };
  credits?: {
    cast: Array<{ id: number; name: string; character: string }>;
    crew: Array<{ id: number; name: string; job: string }>;
  };
}

@Injectable()
export class TmdbService extends BaseExternalApiService {
  private readonly imageBaseUrl = 'https://image.tmdb.org/t/p/w500';

  constructor(
    protected readonly httpService: HttpService,
    protected readonly configService: ConfigService,
  ) {
    super(httpService, configService);
  }

  protected getServiceConfig(): ExternalApiConfig {
    return {
      baseUrl: 'https://api.themoviedb.org/3',
      apiKey: this.validateApiKey('TMDB_API_KEY'),
      timeout: 10000,
      retryAttempts: 2,
      retryDelay: 1000,
      rateLimit: {
        requests: 40, // TMDB allows 40 requests per 10 seconds
        window: 10 * 1000, // 10 seconds
      },
    };
  }

  // Override makeRequest to use TMDB's api_key parameter name instead of apikey
  protected async makeRequest<T>(
    endpoint: string,
    params?: Record<string, any>,
    options?: AxiosRequestConfig,
  ): Promise<ExternalApiResponse<T>> {
    try {
      this.config = this.getServiceConfig();

      // Check rate limiting
      if (this.config.rateLimit && this.rateLimitInfo) {
        await this.checkRateLimit();
      }

      const url = `${this.config.baseUrl}${endpoint}`;
      const requestConfig: AxiosRequestConfig = {
        timeout: this.config.timeout || 10000,
        params: {
          ...params,
          // Use TMDB's api_key parameter name instead of apikey
          ...(this.config.apiKey && { api_key: this.config.apiKey }),
        },
        ...options,
      };

      this.logger.debug(`Making request to: ${url}`, { params: requestConfig.params });

      const response = await firstValueFrom(
        this.httpService.get<T>(url, requestConfig).pipe(
          timeout(this.config.timeout || 10000),
          retry(this.config.retryAttempts || 2),
          catchError((error) => {
            this.logger.error(`API request failed: ${error.message}`, error.stack);
            throw new HttpException(
              `External API error: ${error.message}`,
              error.response?.status || HttpStatus.SERVICE_UNAVAILABLE,
            );
          }),
        ),
      );

      // Update rate limit info from headers
      this.updateRateLimitInfo(response);

      return {
        success: true,
        data: response.data,
        statusCode: response.status,
      };
    } catch (error) {
      this.logger.error(`Request failed for ${endpoint}:`, error);
      return {
        success: false,
        error: error.message || 'Unknown error occurred',
        statusCode: error.status || HttpStatus.SERVICE_UNAVAILABLE,
      };
    }
  }

  async searchTvShows(query: string, year?: number, page: number = 1): Promise<ExternalApiResponse<SearchResult[]>> {
    try {
      const sanitizedQuery = this.sanitizeSearchQuery(query);
      if (!sanitizedQuery) {
        return {
          success: false,
          error: 'Invalid search query',
        };
      }

      const params: Record<string, any> = {
        query: sanitizedQuery,
        page: page.toString(),
        include_adult: 'false',
      };

      if (year) {
        params.first_air_date_year = year.toString();
      }

      const response = await this.makeRequest<TmdbSearchResponse>('/search/tv', params);

      if (!response.success || !response.data) {
        return {
          success: false,
          error: response.error,
        };
      }

      const searchResults: SearchResult[] = response.data.results.map(item => ({
        id: item.id.toString(),
        title: item.name,
        year: item.first_air_date ? new Date(item.first_air_date).getFullYear() : undefined,
        poster: item.poster_path ? `${this.imageBaseUrl}${item.poster_path}` : undefined,
        overview: item.overview || undefined,
        type: 'tv' as const,
      }));

      return {
        success: true,
        data: searchResults,
      };
    } catch (error) {
      this.logger.error(`Error searching TV shows: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async getTvShowDetails(tmdbId: string): Promise<ExternalApiResponse<TvShowDetails>> {
    try {
      const id = parseInt(tmdbId);
      if (isNaN(id)) {
        return {
          success: false,
          error: 'Invalid TMDB ID',
        };
      }

      const params = {
        append_to_response: 'external_ids',
      };

      const response = await this.makeRequest<TmdbTvShowDetails>(`/tv/${id}`, params);

      if (!response.success || !response.data) {
        return {
          success: false,
          error: response.error,
        };
      }

      const tvShowDetails: TvShowDetails = {
        id: response.data.id.toString(),
        title: response.data.name,
        year: response.data.first_air_date ? new Date(response.data.first_air_date).getFullYear() : undefined,
        poster: response.data.poster_path ? `${this.imageBaseUrl}${response.data.poster_path}` : undefined,
        overview: response.data.overview || undefined,
        type: 'tv',
        tmdbId: response.data.id,
        imdbId: response.data.external_ids?.imdb_id || undefined,
        seasons: response.data.number_of_seasons,
        episodes: response.data.number_of_episodes,
        genre: response.data.genres?.map(g => g.name) || undefined,
        creator: response.data.created_by?.map(c => c.name).join(', ') || undefined,
        network: response.data.networks?.map(n => n.name).join(', ') || undefined,
        status: response.data.status,
        firstAirDate: response.data.first_air_date || undefined,
        lastAirDate: response.data.last_air_date || undefined,
      };

      return {
        success: true,
        data: tvShowDetails,
      };
    } catch (error) {
      this.logger.error(`Error getting TV show details: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async getPopularTvShows(page: number = 1): Promise<ExternalApiResponse<SearchResult[]>> {
    try {
      const params = {
        page: page.toString(),
      };

      const response = await this.makeRequest<TmdbSearchResponse>('/tv/popular', params);

      if (!response.success || !response.data) {
        return {
          success: false,
          error: response.error,
        };
      }

      const searchResults: SearchResult[] = response.data.results.map(item => ({
        id: item.id.toString(),
        title: item.name,
        year: item.first_air_date ? new Date(item.first_air_date).getFullYear() : undefined,
        poster: item.poster_path ? `${this.imageBaseUrl}${item.poster_path}` : undefined,
        overview: item.overview || undefined,
        type: 'tv' as const,
      }));

      return {
        success: true,
        data: searchResults,
      };
    } catch (error) {
      this.logger.error(`Error getting popular TV shows: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async getPopularMovies(page: number = 1): Promise<ExternalApiResponse<SearchResult[]>> {
    try {
      const params = {
        page: page.toString(),
      };

      const response = await this.makeRequest<TmdbMovieSearchResponse>('/movie/popular', params);

      if (!response.success || !response.data) {
        return {
          success: false,
          error: response.error,
        };
      }

      const searchResults: SearchResult[] = response.data.results.map(item => ({
        id: item.id.toString(),
        title: item.title,
        year: item.release_date ? new Date(item.release_date).getFullYear() : undefined,
        poster: item.poster_path ? `${this.imageBaseUrl}${item.poster_path}` : undefined,
        overview: item.overview || undefined,
        type: 'movie' as const,
      }));

      return {
        success: true,
        data: searchResults,
      };
    } catch (error) {
      this.logger.error(`Error getting popular movies: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async getMovieGenres(): Promise<ExternalApiResponse<Array<{ id: number; name: string }>>> {
    try {
      const response = await this.makeRequest<TmdbGenresResponse>('/genre/movie/list');

      if (!response.success || !response.data) {
        return {
          success: false,
          error: response.error,
        };
      }

      return {
        success: true,
        data: response.data.genres,
      };
    } catch (error) {
      this.logger.error(`Error getting movie genres: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async getMoviesByGenre(genreId: number, page: number = 1): Promise<ExternalApiResponse<SearchResult[]>> {
    try {
      const params = {
        with_genres: genreId.toString(),
        page: page.toString(),
        sort_by: 'popularity.desc',
        include_adult: 'false',
      };

      const response = await this.makeRequest<TmdbMovieSearchResponse>('/discover/movie', params);

      if (!response.success || !response.data) {
        return {
          success: false,
          error: response.error,
        };
      }

      const searchResults: SearchResult[] = response.data.results.map(item => ({
        id: item.id.toString(),
        title: item.title,
        year: item.release_date ? new Date(item.release_date).getFullYear() : undefined,
        poster: item.poster_path ? `${this.imageBaseUrl}${item.poster_path}` : undefined,
        overview: item.overview || undefined,
        type: 'movie' as const,
      }));

      return {
        success: true,
        data: searchResults,
      };
    } catch (error) {
      this.logger.error(`Error getting movies by genre: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async getTvGenres(): Promise<ExternalApiResponse<Array<{ id: number; name: string }>>> {
    try {
      const response = await this.makeRequest<TmdbGenresResponse>('/genre/tv/list');

      if (!response.success || !response.data) {
        return {
          success: false,
          error: response.error,
        };
      }

      return {
        success: true,
        data: response.data.genres,
      };
    } catch (error) {
      this.logger.error(`Error getting TV genres: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async getTvShowsByGenre(genreId: number, page: number = 1): Promise<ExternalApiResponse<SearchResult[]>> {
    try {
      const params = {
        with_genres: genreId.toString(),
        page: page.toString(),
        sort_by: 'popularity.desc',
        include_adult: 'false',
      };

      const response = await this.makeRequest<TmdbSearchResponse>('/discover/tv', params);

      if (!response.success || !response.data) {
        return {
          success: false,
          error: response.error,
        };
      }

      const searchResults: SearchResult[] = response.data.results.map(item => ({
        id: item.id.toString(),
        title: item.name,
        year: item.first_air_date ? new Date(item.first_air_date).getFullYear() : undefined,
        poster: item.poster_path ? `${this.imageBaseUrl}${item.poster_path}` : undefined,
        overview: item.overview || undefined,
        type: 'tv' as const,
      }));

      return {
        success: true,
        data: searchResults,
      };
    } catch (error) {
      this.logger.error(`Error getting TV shows by genre: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async getMovieDetails(tmdbId: string): Promise<ExternalApiResponse<MovieDetails>> {
    try {
      const id = parseInt(tmdbId);
      if (isNaN(id)) {
        return {
          success: false,
          error: 'Invalid TMDB ID',
        };
      }

      const params = {
        append_to_response: 'external_ids',
      };

      const response = await this.makeRequest<TmdbMovieDetails>(`/movie/${id}`, params);

      if (!response.success || !response.data) {
        return {
          success: false,
          error: response.error,
        };
      }

      const movieDetails: MovieDetails = {
        id: response.data.id.toString(),
        title: response.data.title,
        year: response.data.release_date ? new Date(response.data.release_date).getFullYear() : undefined,
        poster: response.data.poster_path ? `${this.imageBaseUrl}${response.data.poster_path}` : undefined,
        overview: response.data.overview || undefined,
        type: 'movie',
        tmdbId: response.data.id,
        imdbId: response.data.external_ids?.imdb_id || undefined,
        runtime: response.data.runtime,
        genre: response.data.genres?.map(g => g.name) || undefined,
        director: response.data.credits?.crew?.find(c => c.job === 'Director')?.name || undefined,
        actors: response.data.credits?.cast?.slice(0, 5).map(a => a.name).join(', ') || undefined,
        rating: response.data.vote_average,
        released: response.data.release_date,
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
}
