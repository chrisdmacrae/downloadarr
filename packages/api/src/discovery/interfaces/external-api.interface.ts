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

/** How a browse listing is ordered. */
export const DISCOVER_SORTS = ['popular', 'top_rated', 'newest', 'oldest'] as const;
export type DiscoverSort = (typeof DISCOVER_SORTS)[number];

export interface DiscoverOptions {
  genreId?: number;
  /** Inclusive release-year range; either end may be left open. */
  yearFrom?: number;
  yearTo?: number;
  sort?: DiscoverSort;
  page?: number;
}

/** Games can also be listed by name, which is the one order that includes unrated games. */
export const GAME_DISCOVER_SORTS = [...DISCOVER_SORTS, 'title'] as const;
export type GameDiscoverSort = (typeof GAME_DISCOVER_SORTS)[number];

export interface GameDiscoverOptions extends Omit<DiscoverOptions, 'sort'> {
  /** A supported platform name ("PC", "SNES"); omit for every supported platform. */
  platform?: string;
  sort?: GameDiscoverSort;
}

/** One page of a browse listing, with enough to know whether more follow. */
export interface DiscoverPage {
  results: SearchResult[];
  page: number;
  totalPages: number;
  /** Absent when the source could not say how many titles match. */
  totalResults?: number;
}

/** A cast or crew member on a title, for "Cast & crew" rows. `id` is the TMDB person id. */
export interface CreditPerson {
  id: string;
  name: string;
  /** Character played, or job (Director, Creator). */
  role?: string;
  photo?: string;
  department: 'cast' | 'crew';
}

/** A person's page: who they are and what they've been in, most popular first. */
export interface PersonDetails {
  id: string;
  name: string;
  photo?: string;
  biography?: string;
  birthday?: string;
  deathday?: string;
  placeOfBirth?: string;
  knownFor?: string;
  credits: SearchResult[];
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
  cast?: CreditPerson[];
  recommendations?: SearchResult[];
  /** YouTube video key of the best trailer, e.g. for https://www.youtube.com/watch?v=<key>. */
  trailer?: string;
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
  cast?: CreditPerson[];
  recommendations?: SearchResult[];
  /** YouTube video key of the best trailer. */
  trailer?: string;
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
  categoryCode?: string; // Direct Newznab category code
  indexers?: string[]; // Prowlarr indexer names or numeric ids
  minSeeders?: number;
  maxSize?: string;
  quality?: string[];
  format?: string[];
  language?: string[];
}

/** A Newznab category as Prowlarr reports it on a release. */
export interface ProwlarrCategory {
  id: number;
  name: string;
  subCategories?: ProwlarrCategory[];
}

/**
 * One release from Prowlarr's `/api/v1/search`, which returns a bare array
 * rather than an envelope.
 *
 * Both `downloadUrl` and `magnetUrl` are rewritten by Prowlarr into signed
 * links back through itself (`{prowlarr}/{indexerId}/download?apikey=...`);
 * neither is the indexer's own URL, and `magnetUrl` is therefore *not* a
 * `magnet:` URI. Fetching a proxy link either returns the .torrent bytes or
 * redirects to the real magnet.
 */
export interface ProwlarrRelease {
  guid: string;
  title: string;
  size: number;
  indexerId: number;
  indexer: string;
  publishDate: string;
  downloadUrl?: string;
  magnetUrl?: string;
  infoUrl?: string;
  infoHash?: string;
  seeders?: number;
  leechers?: number;
  protocol: 'torrent' | 'usenet';
  categories?: ProwlarrCategory[];
  indexerFlags?: string[];
}
