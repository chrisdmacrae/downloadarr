export interface ExternalApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
}

export interface SearchResult {
  id: string;
  title: string;
  year?: number;
  poster?: string;
  overview?: string;
  type: 'movie' | 'tv' | 'game';
  /**
   * Enrichment used by the media-library UI: 16:9 artwork for heroes and stateful
   * cards, and the facts the poster hover panel shows (rating chip, runtime,
   * season count, platform, categories). All optional - a provider that cannot
   * supply a field simply omits it and the UI drops that row.
   */
  backdrop?: string;
  rating?: number;
  genres?: string[];
  runtime?: number;
  seasons?: number;
  episodeRuntime?: number;
  platforms?: string[];
}

export interface MovieDetails extends SearchResult {
  type: 'movie';
  imdbId?: string;
  tmdbId?: number;
  runtime?: number;
  genre?: string[];
  director?: string;
  actors?: string;
  plot?: string;
  rating?: number;
  released?: string;
}

export interface TvShowDetails extends SearchResult {
  type: 'tv';
  tmdbId?: number;
  imdbId?: string;
  seasons?: number;
  episodes?: number;
  genre?: string[];
  creator?: string;
  network?: string;
  status?: string;
  firstAirDate?: string;
  lastAirDate?: string;
}

export interface GameDetails extends SearchResult {
  type: 'game';
  igdbId?: number;
  platforms?: string[];
  genre?: string[];
  developer?: string;
  publisher?: string;
  releaseDate?: string;
  rating?: number;
  screenshots?: string[];
}

export interface ApiRateLimit {
  limit: number;
  remaining: number;
  reset: number;
}

export interface ExternalApiConfig {
  baseUrl: string;
  apiKey?: string;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  rateLimit?: {
    requests: number;
    window: number; // in milliseconds
  };
}

// Torrent-related interfaces
export interface TorrentResult {
  title: string;
  link: string;
  magnetUri?: string;
  size: string;
  seeders: number;
  leechers: number;
  category: string;
  indexer: string;
  publishDate: string;
  quality?: string;
  format?: string;
  language?: string;
}

export interface TorrentSearchParams {
  query: string;
  category?: string;
  categoryCode?: string; // Direct Jackett category code
  indexers?: string[];
  minSeeders?: number;
  maxSize?: string;
  quality?: string[];
  format?: string[];
  language?: string[];
}

export interface JackettSearchResponse {
  Results: JackettTorrent[];
}

export interface JackettTorrent {
  Title: string;
  Link: string;
  MagnetUri?: string;
  Size: number;
  Seeders: number;
  Peers: number;
  CategoryDesc: string;
  Tracker: string;
  PublishDate: string;
  Details?: string;
}
