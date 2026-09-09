import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { AxiosRequestConfig, AxiosResponse } from 'axios';
import { firstValueFrom, timeout, retry, catchError } from 'rxjs';
import { BaseExternalApiService } from './base-external-api.service';
import { AppConfigurationService } from '../../config/services/app-configuration.service';
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
  origin_country?: string[];
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
  episode_run_time: number[];
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
  private readonly backdropBaseUrl = 'https://image.tmdb.org/t/p/w780';

  /**
   * Genre id -> name, cached per kind. List endpoints return `genre_ids` only, but the
   * poster hover panel and hero banner show category names, so the two small genre
   * lists are fetched once and reused.
   */
  private readonly genreNameCache = new Map<'movie' | 'tv', Map<number, string>>();

  constructor(
    protected readonly httpService: HttpService,
    protected readonly configService: ConfigService,
    private readonly appConfigService: AppConfigurationService,
  ) {
    super(httpService, configService);
  }

  protected async getServiceConfig(): Promise<ExternalApiConfig> {
    const apiKeysConfig = await this.appConfigService.getApiKeysConfig();

    if (!apiKeysConfig.tmdbApiKey) {
      throw new Error('TMDB API key is not configured. Please configure it in the application settings.');
    }

    return {
      baseUrl: 'https://api.themoviedb.org/3',
      apiKey: apiKeysConfig.tmdbApiKey,
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
      this.config = await this.getServiceConfig();

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
        query: sanitizedQuery,
        page: page.toString(),
        include_adult: 'false',
      };

      if (year) {
        params.year = year.toString();
      }

      const response = await this.makeRequest<TmdbMovieSearchResponse>('/search/movie', params);

      if (!response.success || !response.data) {
        return {
          success: false,
          error: response.error,
        };
      }

      const genreNames = await this.getGenreNameMap('movie');
      // Anime films have their own destination, so they are excluded here.
      const searchResults: SearchResult[] = response.data.results
        .filter(item => !this.isAnimeMovie(item))
        .map(item => this.mapMovieItem(item, genreNames));

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

      const genreNames = await this.getGenreNameMap('tv');
      // Anime has its own destination, so it is excluded here. Pages come back
      // slightly shorter as a result; TMDB has no "exclude by origin" filter.
      const searchResults: SearchResult[] = response.data.results
        .filter(item => !this.isAnime(item))
        .map(item => this.mapTvItem(item, genreNames));

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
        backdrop: response.data.backdrop_path ? `${this.backdropBaseUrl}${response.data.backdrop_path}` : undefined,
        overview: response.data.overview || undefined,
        type: 'tv',
        rating: response.data.vote_average || undefined,
        genres: response.data.genres?.map(g => g.name) || undefined,
        episodeRuntime: response.data.episode_run_time?.[0] || undefined,
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

      const genreNames = await this.getGenreNameMap('tv');
      // Anime has its own destination, so it is excluded here. Pages come back
      // slightly shorter as a result; TMDB has no "exclude by origin" filter.
      const searchResults: SearchResult[] = response.data.results
        .filter(item => !this.isAnime(item))
        .map(item => this.mapTvItem(item, genreNames));

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

      const genreNames = await this.getGenreNameMap('movie');
      // Anime films have their own destination, so they are excluded here.
      const searchResults: SearchResult[] = response.data.results
        .filter(item => !this.isAnimeMovie(item))
        .map(item => this.mapMovieItem(item, genreNames));

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

  /**
   * Fetches (and caches) the TMDB genre list for a kind so list results can carry
   * category names. A failed lookup caches nothing and simply yields no categories.
   */
  private async getGenreNameMap(kind: 'movie' | 'tv'): Promise<Map<number, string>> {
    const cached = this.genreNameCache.get(kind);
    if (cached) {
      return cached;
    }

    const response = await this.makeRequest<TmdbGenresResponse>(`/genre/${kind}/list`);
    if (!response.success || !response.data) {
      return new Map();
    }

    const map = new Map(response.data.genres.map(g => [g.id, g.name] as const));
    this.genreNameCache.set(kind, map);
    return map;
  }

  private resolveGenreNames(ids: number[] | undefined, names: Map<number, string>): string[] | undefined {
    const resolved = (ids || []).map(id => names.get(id)).filter((name): name is string => !!name);
    return resolved.length ? resolved : undefined;
  }

  /**
   * TMDB has no "anime" genre, so anime is identified the way the wider
   * ecosystem does: animation produced in Japan. Discover queries can express
   * that server-side; results from endpoints that cannot (search, /tv/popular)
   * are classified with the same rule client-side so the two agree.
   */
  private static readonly ANIMATION_GENRE_ID = 16;
  private static readonly ANIME_LANGUAGE = 'ja';

  private isAnime(item: TmdbTvShowItem): boolean {
    return this.isJapaneseAnimation(item.genre_ids, item.original_language, item.origin_country);
  }

  /** The same rule for films: Studio Ghibli et al. belong under Anime, not Movies. */
  private isAnimeMovie(item: TmdbMovieItem): boolean {
    return this.isJapaneseAnimation(item.genre_ids, item.original_language, item.origin_country);
  }

  private isJapaneseAnimation(
    genreIds: number[] | undefined,
    originalLanguage: string | undefined,
    originCountry: string[] | undefined,
  ): boolean {
    const isAnimated = (genreIds || []).includes(TmdbService.ANIMATION_GENRE_ID);
    if (!isAnimated) {
      return false;
    }
    return (
      originalLanguage === TmdbService.ANIME_LANGUAGE || (originCountry || []).includes('JP')
    );
  }

  private mapMovieItem(item: TmdbMovieItem, genreNames: Map<number, string>): SearchResult {
    return {
      id: item.id.toString(),
      title: item.title,
      year: item.release_date ? new Date(item.release_date).getFullYear() : undefined,
      poster: item.poster_path ? `${this.imageBaseUrl}${item.poster_path}` : undefined,
      backdrop: item.backdrop_path ? `${this.backdropBaseUrl}${item.backdrop_path}` : undefined,
      overview: item.overview || undefined,
      type: 'movie' as const,
      rating: item.vote_average || undefined,
      genres: this.resolveGenreNames(item.genre_ids, genreNames),
    };
  }

  private mapTvItem(item: TmdbTvShowItem, genreNames: Map<number, string>): SearchResult {
    return {
      id: item.id.toString(),
      title: item.name,
      year: item.first_air_date ? new Date(item.first_air_date).getFullYear() : undefined,
      poster: item.poster_path ? `${this.imageBaseUrl}${item.poster_path}` : undefined,
      backdrop: item.backdrop_path ? `${this.backdropBaseUrl}${item.backdrop_path}` : undefined,
      overview: item.overview || undefined,
      type: 'tv' as const,
      rating: item.vote_average || undefined,
      genres: this.resolveGenreNames(item.genre_ids, genreNames),
    };
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

      const genreNames = await this.getGenreNameMap('movie');
      // Anime films have their own destination, so they are excluded here.
      const searchResults: SearchResult[] = response.data.results
        .filter(item => !this.isAnimeMovie(item))
        .map(item => this.mapMovieItem(item, genreNames));

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

  /**
   * Anime discovery. `/discover/tv` can express "animation, made in Japan"
   * server-side, so these results need no further filtering.
   */
  private animeDiscoverParams(page: number): Record<string, string> {
    return {
      with_genres: TmdbService.ANIMATION_GENRE_ID.toString(),
      with_original_language: TmdbService.ANIME_LANGUAGE,
      page: page.toString(),
      sort_by: 'popularity.desc',
      include_adult: 'false',
    };
  }

  async getPopularAnime(page: number = 1): Promise<ExternalApiResponse<SearchResult[]>> {
    try {
      const response = await this.makeRequest<TmdbSearchResponse>(
        '/discover/tv',
        this.animeDiscoverParams(page),
      );

      if (!response.success || !response.data) {
        return { success: false, error: response.error };
      }

      const genreNames = await this.getGenreNameMap('tv');
      const searchResults: SearchResult[] = response.data.results.map(item =>
        this.mapTvItem(item, genreNames),
      );

      return { success: true, data: searchResults };
    } catch (error) {
      this.logger.error(`Error getting popular anime: ${error.message}`, error.stack);
      return { success: false, error: error.message };
    }
  }

  async getAnimeByGenre(genreId: number, page: number = 1): Promise<ExternalApiResponse<SearchResult[]>> {
    try {
      const params = this.animeDiscoverParams(page);
      // Combined with a comma TMDB treats genres as AND, which is what we want:
      // animation *and* the requested genre.
      params.with_genres = `${TmdbService.ANIMATION_GENRE_ID},${genreId}`;

      const response = await this.makeRequest<TmdbSearchResponse>('/discover/tv', params);

      if (!response.success || !response.data) {
        return { success: false, error: response.error };
      }

      const genreNames = await this.getGenreNameMap('tv');
      const searchResults: SearchResult[] = response.data.results.map(item =>
        this.mapTvItem(item, genreNames),
      );

      return { success: true, data: searchResults };
    } catch (error) {
      this.logger.error(`Error getting anime by genre: ${error.message}`, error.stack);
      return { success: false, error: error.message };
    }
  }

  /**
   * Search has no genre or language filter that composes with a text query, so
   * results are classified with the same rule the discover queries encode.
   */
  async searchAnime(query: string, year?: number, page: number = 1): Promise<ExternalApiResponse<SearchResult[]>> {
    try {
      const sanitizedQuery = this.sanitizeSearchQuery(query);
      if (!sanitizedQuery) {
        return { success: false, error: 'Invalid search query' };
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
        return { success: false, error: response.error };
      }

      const genreNames = await this.getGenreNameMap('tv');
      const searchResults: SearchResult[] = response.data.results
        .filter(item => this.isAnime(item))
        .map(item => this.mapTvItem(item, genreNames));

      return { success: true, data: searchResults };
    } catch (error) {
      this.logger.error(`Error searching anime: ${error.message}`, error.stack);
      return { success: false, error: error.message };
    }
  }

  private animeMovieDiscoverParams(page: number): Record<string, string> {
    return {
      with_genres: TmdbService.ANIMATION_GENRE_ID.toString(),
      with_original_language: TmdbService.ANIME_LANGUAGE,
      page: page.toString(),
      sort_by: 'popularity.desc',
      include_adult: 'false',
    };
  }

  async getPopularAnimeMovies(page: number = 1): Promise<ExternalApiResponse<SearchResult[]>> {
    try {
      const response = await this.makeRequest<TmdbMovieSearchResponse>(
        '/discover/movie',
        this.animeMovieDiscoverParams(page),
      );

      if (!response.success || !response.data) {
        return { success: false, error: response.error };
      }

      const genreNames = await this.getGenreNameMap('movie');
      const searchResults: SearchResult[] = response.data.results.map(item =>
        this.mapMovieItem(item, genreNames),
      );

      return { success: true, data: searchResults };
    } catch (error) {
      this.logger.error(`Error getting popular anime movies: ${error.message}`, error.stack);
      return { success: false, error: error.message };
    }
  }

  async getAnimeMoviesByGenre(genreId: number, page: number = 1): Promise<ExternalApiResponse<SearchResult[]>> {
    try {
      const params = this.animeMovieDiscoverParams(page);
      params.with_genres = `${TmdbService.ANIMATION_GENRE_ID},${genreId}`;

      const response = await this.makeRequest<TmdbMovieSearchResponse>('/discover/movie', params);

      if (!response.success || !response.data) {
        return { success: false, error: response.error };
      }

      const genreNames = await this.getGenreNameMap('movie');
      const searchResults: SearchResult[] = response.data.results.map(item =>
        this.mapMovieItem(item, genreNames),
      );

      return { success: true, data: searchResults };
    } catch (error) {
      this.logger.error(`Error getting anime movies by genre: ${error.message}`, error.stack);
      return { success: false, error: error.message };
    }
  }

  async searchAnimeMovies(query: string, year?: number, page: number = 1): Promise<ExternalApiResponse<SearchResult[]>> {
    try {
      const sanitizedQuery = this.sanitizeSearchQuery(query);
      if (!sanitizedQuery) {
        return { success: false, error: 'Invalid search query' };
      }

      const params: Record<string, any> = {
        query: sanitizedQuery,
        page: page.toString(),
        include_adult: 'false',
      };

      if (year) {
        params.year = year.toString();
      }

      const response = await this.makeRequest<TmdbMovieSearchResponse>('/search/movie', params);

      if (!response.success || !response.data) {
        return { success: false, error: response.error };
      }

      const genreNames = await this.getGenreNameMap('movie');
      const searchResults: SearchResult[] = response.data.results
        .filter(item => this.isAnimeMovie(item))
        .map(item => this.mapMovieItem(item, genreNames));

      return { success: true, data: searchResults };
    } catch (error) {
      this.logger.error(`Error searching anime movies: ${error.message}`, error.stack);
      return { success: false, error: error.message };
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

      const genreNames = await this.getGenreNameMap('tv');
      // Anime has its own destination, so it is excluded here. Pages come back
      // slightly shorter as a result; TMDB has no "exclude by origin" filter.
      const searchResults: SearchResult[] = response.data.results
        .filter(item => !this.isAnime(item))
        .map(item => this.mapTvItem(item, genreNames));

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
        backdrop: response.data.backdrop_path ? `${this.backdropBaseUrl}${response.data.backdrop_path}` : undefined,
        overview: response.data.overview || undefined,
        type: 'movie',
        genres: response.data.genres?.map(g => g.name) || undefined,
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
