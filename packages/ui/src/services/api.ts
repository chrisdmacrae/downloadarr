import axios from 'axios';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001',
  timeout: 5000, // Reduced timeout to 5 seconds
  headers: {
    'Content-Type': 'application/json',
  },
});

// Types for API responses
export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  total: number;
}

export interface VpnStatus {
  enabled: boolean;
  connected: boolean;
  publicIP?: string;
  containerRunning?: boolean;
  containerHealthy?: boolean;
  message?: string;
}

export interface Aria2Stats {
  downloadSpeed: string;
  uploadSpeed: string;
  numActive: string;
  numWaiting: string;
  numStopped: string;
  numStoppedTotal: string;
}

export interface DownloadJob {
  id: string;
  name: string;
  originalUrl: string;
  type: string;
  mediaType?: string;
  mediaTitle?: string;
  mediaYear?: number;
  mediaPoster?: string;
  mediaOverview?: string;
  status: string;
  totalSize: number;
  completedSize: number;
  progress: number;
  downloadSpeed: number;
  files: Array<{
    name: string;
    size: number;
    completed: number;
    progress: number;
  }>;
  createdAt: string;
  updatedAt: string;
}

// Discovery service types
export interface SearchResult {
  id: string;
  title: string;
  year?: number;
  poster?: string;
  overview?: string;
  type: 'movie' | 'tv' | 'game';
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

export interface GamePlatform {
  id: string;
  name: string;
  category: string;
  description: string;
  aliases: string[];
}

export interface OrganizationSettings {
  id: string;
  libraryPath: string;
  moviesPath?: string;
  tvShowsPath?: string;
  gamesPath?: string;
  organizeOnComplete: boolean;
  replaceExistingFiles: boolean;
  extractArchives: boolean;
  deleteAfterExtraction: boolean;
  enableReverseIndexing: boolean;
  reverseIndexingCron: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationRule {
  id: string;
  contentType: 'MOVIE' | 'TV_SHOW' | 'GAME';
  isDefault: boolean;
  isActive: boolean;
  folderNamePattern: string;
  fileNamePattern: string;
  seasonFolderPattern?: string;
  basePath?: string;
  platform?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrganizationRuleDto {
  contentType: 'MOVIE' | 'TV_SHOW' | 'GAME';
  isDefault?: boolean;
  isActive?: boolean;
  folderNamePattern: string;
  fileNamePattern: string;
  seasonFolderPattern?: string;
  basePath?: string;
  platform?: string;
}

export interface PathPreview {
  folderPath: string;
  fileName: string;
  fullPath: string;
}

export interface FileMetadata {
  title: string;
  year?: number;
  season?: number;
  episode?: number;
  platform?: string;
  quality?: string;
  format?: string;
  edition?: string;
}

// Torrent Request Types
export interface TorrentRequest {
  id: string;
  contentType: 'MOVIE' | 'TV_SHOW' | 'GAME';
  title: string;
  year?: number;
  season?: number;
  episode?: number;
  imdbId?: string;
  tmdbId?: number;
  // TV Show specific fields for ongoing requests
  isOngoing?: boolean;
  totalSeasons?: number;
  totalEpisodes?: number;
  // Game-specific fields
  igdbId?: number;
  platform?: string;
  genre?: string;
  status: 'PENDING' | 'SEARCHING' | 'FOUND' | 'DOWNLOADING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'EXPIRED';
  priority: number;
  preferredQualities: string[];
  preferredFormats: string[];
  minSeeders: number;
  maxSizeGB: number;
  searchAttempts: number;
  maxSearchAttempts: number;
  foundTorrentTitle?: string;
  // downloadProgress, downloadSpeed, downloadEta removed - now fetched live via getRequestDownloadStatus
  createdAt: string;
  updatedAt: string;
  // TV Show management relationships
  tvShowSeasons?: TvShowSeason[];
  torrentDownloads?: TorrentDownload[];
}

// TV Show Season Management Types
export interface TvShowSeason {
  id: string;
  requestedTorrentId: string;
  seasonNumber: number;
  totalEpisodes?: number;
  status: 'PENDING' | 'SEARCHING' | 'FOUND' | 'DOWNLOADING' | 'COMPLETED' | 'FAILED';
  createdAt: string;
  updatedAt: string;
  episodes?: TvShowEpisode[];
  torrentDownloads?: TorrentDownload[];
}

export interface TvShowEpisode {
  id: string;
  tvShowSeasonId: string;
  episodeNumber: number;
  title?: string;
  airDate?: string;
  status: 'PENDING' | 'SEARCHING' | 'FOUND' | 'DOWNLOADING' | 'COMPLETED' | 'FAILED';
  createdAt: string;
  updatedAt: string;
  torrentDownloads?: TorrentDownload[];
}

export interface TorrentDownload {
  id: string;
  requestedTorrentId: string;
  tvShowSeasonId?: string;
  tvShowEpisodeId?: string;
  torrentTitle: string;
  torrentLink?: string;
  magnetUri?: string;
  torrentSize?: string;
  seeders?: number;
  indexer?: string;
  downloadJobId?: string;
  aria2Gid?: string;
  downloadProgress?: number;
  downloadSpeed?: string;
  downloadEta?: string;
  status: 'PENDING' | 'DOWNLOADING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface TorrentSearchResult {
  id: string;
  requestedTorrentId: string;
  title: string;
  link: string;
  magnetUri?: string;
  size: string;
  sizeBytes?: string;
  seeders: number;
  leechers: number;
  category: string;
  indexer: string;
  publishDate: string;
  quality?: string;
  format?: string;
  rankingScore: number;
  isSelected: boolean;
  isAutoSelected: boolean;
  createdAt: string;
}

export interface TorrentResult {
  id: string;
  title: string;
  link: string;
  magnetUri?: string;
  size: string;
  sizeBytes?: number;
  seeders: number;
  leechers: number;
  category: string;
  indexer: string;
  publishDate: string;
  quality?: string;
  format?: string;
  rankingScore: number;
}

export interface CreateTorrentRequestDto {
  title: string;
  year?: number;
  season?: number;
  episode?: number;
  imdbId?: string;
  tmdbId?: number;
  // TV Show specific fields for ongoing requests
  isOngoing?: boolean;
  totalSeasons?: number;
  totalEpisodes?: number;
  // Game-specific fields
  igdbId?: number;
  platform?: string;
  genre?: string;
  preferredQualities?: string[];
  preferredFormats?: string[];
  minSeeders?: number;
  maxSizeGB?: number;
  priority?: number;
  searchIntervalMins?: number;
  maxSearchAttempts?: number;
  blacklistedWords?: string[];
  trustedIndexers?: string[];
}

export interface UpdateTorrentRequestDto {
  preferredQualities?: string[];
  preferredFormats?: string[];
  minSeeders?: number;
  maxSizeGB?: number;
  priority?: number;
  searchIntervalMins?: number;
  maxSearchAttempts?: number;
  blacklistedWords?: string[];
  trustedIndexers?: string[];
}

export interface TorrentRequestStats {
  total: number;
  pending: number;
  searching: number;
  found: number;
  downloading: number;
  completed: number;
  failed: number;
  cancelled: number;
  expired: number;
}

// API service functions
export const apiService = {
  // Get queue statistics
  getQueueStats: async (): Promise<QueueStats> => {
    const response = await api.get('/downloads/queue/stats');
    return response.data;
  },

  // Get VPN status
  getVpnStatus: async (): Promise<VpnStatus> => {
    const response = await api.get('/vpn/status');
    return response.data;
  },

  // Get Aria2 global statistics
  getAria2Stats: async (): Promise<Aria2Stats> => {
    const response = await api.get('/downloads/aria2/stats');
    return response.data;
  },

  // Get all downloads
  getDownloads: async (): Promise<DownloadJob[]> => {
    const response = await api.get('/downloads');
    return response.data;
  },

  // Get active downloads (filters all downloads for active ones)
  getActiveDownloads: async (): Promise<DownloadJob[]> => {
    const response = await api.get('/downloads');
    return response.data.filter((download: DownloadJob) =>
      download.status === 'active' || download.status === 'downloading'
    );
  },

  // Create a new download
  createDownload: async (downloadData: {
    url: string;
    type: 'magnet' | 'torrent' | 'http' | 'https';
    name?: string;
    destination?: string;
  }) => {
    const response = await api.post('/downloads', downloadData);
    return response.data;
  },

  // Get download status
  getDownloadStatus: async (id: string): Promise<DownloadJob> => {
    const response = await api.get(`/downloads/${id}/status`);
    return response.data;
  },

  // Pause download
  pauseDownload: async (id: string) => {
    const response = await api.put(`/downloads/${id}/pause`);
    return response.data;
  },

  // Resume download
  resumeDownload: async (id: string) => {
    const response = await api.put(`/downloads/${id}/resume`);
    return response.data;
  },

  // Cancel download
  cancelDownload: async (id: string) => {
    const response = await api.delete(`/downloads/${id}`);
    return response.data;
  },

  // Discovery Services
  // Movies
  searchMovies: async (query: string, year?: number, page?: number): Promise<{ success: boolean; data?: SearchResult[]; error?: string }> => {
    const params = new URLSearchParams({ query });
    if (year) params.append('year', year.toString());
    if (page) params.append('page', page.toString());

    const response = await api.get(`/movies/search?${params}`);
    return response.data;
  },

  getMovieDetails: async (id: string): Promise<{ success: boolean; data?: MovieDetails; error?: string }> => {
    const response = await api.get(`/movies/${id}`);
    return response.data;
  },

  getPopularMovies: async (page?: number): Promise<{ success: boolean; data?: SearchResult[]; error?: string }> => {
    const params = page ? `?page=${page}` : '';
    const response = await api.get(`/movies/popular${params}`);
    return response.data;
  },

  getMovieGenres: async (): Promise<{ success: boolean; data?: Array<{ id: number; name: string }>; error?: string }> => {
    const response = await api.get('/movies/genres/list');
    return response.data;
  },

  getMoviesByGenre: async (genreId: number, page?: number): Promise<{ success: boolean; data?: SearchResult[]; error?: string }> => {
    const params = page ? `?page=${page}` : '';
    const response = await api.get(`/movies/genres/${genreId}${params}`);
    return response.data;
  },

  // TV Shows
  searchTvShows: async (query: string, year?: number, page?: number): Promise<{ success: boolean; data?: SearchResult[]; error?: string }> => {
    const params = new URLSearchParams({ query });
    if (year) params.append('year', year.toString());
    if (page) params.append('page', page.toString());

    const response = await api.get(`/tv-shows/search?${params}`);
    return response.data;
  },

  getTvShowDetails: async (id: string): Promise<{ success: boolean; data?: TvShowDetails; error?: string }> => {
    const response = await api.get(`/tv-shows/${id}`);
    return response.data;
  },

  getPopularTvShows: async (page?: number): Promise<{ success: boolean; data?: SearchResult[]; error?: string }> => {
    const params = page ? `?page=${page}` : '';
    const response = await api.get(`/tv-shows/popular${params}`);
    return response.data;
  },

  getTvGenres: async (): Promise<{ success: boolean; data?: Array<{ id: number; name: string }>; error?: string }> => {
    const response = await api.get('/tv-shows/genres/list');
    return response.data;
  },

  getTvShowsByGenre: async (genreId: number, page?: number): Promise<{ success: boolean; data?: SearchResult[]; error?: string }> => {
    const params = page ? `?page=${page}` : '';
    const response = await api.get(`/tv-shows/genres/${genreId}${params}`);
    return response.data;
  },

  // Games
  searchGames: async (query: string, limit?: number): Promise<{ success: boolean; data?: SearchResult[]; error?: string }> => {
    const params = new URLSearchParams({ query });
    if (limit) params.append('limit', limit.toString());

    const response = await api.get(`/games/search?${params}`);
    return response.data;
  },

  getGameDetails: async (id: string): Promise<{ success: boolean; data?: GameDetails; error?: string }> => {
    const response = await api.get(`/games/${id}`);
    return response.data;
  },

  getPopularGames: async (limit?: number): Promise<{ success: boolean; data?: SearchResult[]; error?: string }> => {
    const params = limit ? `?limit=${limit}` : '';
    const response = await api.get(`/games/popular${params}`);
    return response.data;
  },

  getSupportedPlatforms: async (): Promise<{ success: boolean; data?: Array<{ name: string; id: number }>; error?: string }> => {
    const response = await api.get('/games/platforms/list');
    return response.data;
  },

  getGamesByPlatform: async (platformName: string, limit?: number): Promise<{ success: boolean; data?: SearchResult[]; error?: string }> => {
    const params = limit ? `?limit=${limit}` : '';
    const response = await api.get(`/games/platforms/${encodeURIComponent(platformName)}${params}`);
    return response.data;
  },

  getPcGamesByGenre: async (genreName: string, limit?: number): Promise<{ success: boolean; data?: SearchResult[]; error?: string }> => {
    const params = limit ? `?limit=${limit}` : '';
    const response = await api.get(`/games/pc/genres/${encodeURIComponent(genreName)}${params}`);
    return response.data;
  },

  // Torrent Request Services
  requestMovieDownload: async (dto: CreateTorrentRequestDto): Promise<{ success: boolean; data?: TorrentRequest; error?: string }> => {
    const response = await api.post('/torrent-requests/movies', dto);
    return response.data;
  },

  requestTvShowDownload: async (dto: CreateTorrentRequestDto): Promise<{ success: boolean; data?: TorrentRequest; error?: string }> => {
    const response = await api.post('/torrent-requests/tv-shows', dto);
    return response.data;
  },

  requestGameDownload: async (dto: CreateTorrentRequestDto): Promise<{ success: boolean; data?: TorrentRequest; error?: string }> => {
    const response = await api.post('/torrent-requests/games', dto);
    return response.data;
  },

  getTorrentRequests: async (status?: string, userId?: string): Promise<{ success: boolean; data?: TorrentRequest[]; error?: string }> => {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (userId) params.append('userId', userId);

    const response = await api.get(`/torrent-requests?${params}`);
    return response.data;
  },

  getTorrentRequest: async (id: string): Promise<{ success: boolean; data?: TorrentRequest; error?: string }> => {
    const response = await api.get(`/torrent-requests/${id}`);
    return response.data;
  },

  cancelTorrentRequest: async (id: string): Promise<{ success: boolean; data?: TorrentRequest; error?: string }> => {
    const response = await api.put(`/torrent-requests/${id}/cancel`);
    return response.data;
  },

  deleteTorrentRequest: async (id: string): Promise<{ success: boolean; message?: string; error?: string }> => {
    const response = await api.delete(`/torrent-requests/${id}`);
    return response.data;
  },

  updateTorrentRequest: async (id: string, dto: UpdateTorrentRequestDto): Promise<{ success: boolean; data?: TorrentRequest; error?: string }> => {
    const response = await api.put(`/torrent-requests/${id}`, dto);
    return response.data;
  },

  getTorrentRequestStats: async (userId?: string): Promise<{ success: boolean; data?: TorrentRequestStats; error?: string }> => {
    const params = userId ? `?userId=${userId}` : '';
    const response = await api.get(`/torrent-requests/stats${params}`);
    return response.data;
  },

  triggerTorrentSearch: async (): Promise<{ success: boolean; message?: string; error?: string }> => {
    const response = await api.post('/torrent-requests/trigger-search');
    return response.data;
  },

  triggerRequestSearch: async (id: string): Promise<{ success: boolean; message?: string; error?: string }> => {
    const response = await api.post(`/torrent-requests/${id}/search`);
    return response.data;
  },

  triggerAllRequestsSearch: async (): Promise<{ success: boolean; message?: string; searchedCount?: number; error?: string }> => {
    const response = await api.post('/torrent-requests/search-all');
    return response.data;
  },

  // Live Download Status Services
  getRequestDownloadStatus: async (id: string): Promise<{ success: boolean; data?: any; error?: string }> => {
    const response = await api.get(`/torrent-requests/${id}/download-status`);
    return response.data;
  },

  getDownloadSummary: async (): Promise<{ success: boolean; data?: any; error?: string }> => {
    const response = await api.get('/torrent-requests/download-summary');
    return response.data;
  },

  getSearchResults: async (requestId: string): Promise<{ success: boolean; data?: TorrentSearchResult[]; error?: string }> => {
    const response = await api.get(`/torrent-requests/${requestId}/search-results`);
    return response.data;
  },

  // TV Show Season Management
  getTvShowSeasons: async (requestId: string): Promise<{ success: boolean; data?: TvShowSeason[]; error?: string }> => {
    const response = await api.get(`/torrent-requests/${requestId}/seasons`);
    return response.data;
  },

  getTvShowSeason: async (requestId: string, seasonNumber: number): Promise<{ success: boolean; data?: TvShowSeason; error?: string }> => {
    const response = await api.get(`/torrent-requests/${requestId}/seasons/${seasonNumber}`);
    return response.data;
  },

  getTvShowEpisodes: async (requestId: string, seasonNumber: number): Promise<{ success: boolean; data?: TvShowEpisode[]; error?: string }> => {
    const response = await api.get(`/torrent-requests/${requestId}/seasons/${seasonNumber}/episodes`);
    return response.data;
  },

  getTorrentDownloads: async (requestId: string): Promise<{ success: boolean; data?: TorrentDownload[]; error?: string }> => {
    const response = await api.get(`/torrent-requests/${requestId}/downloads`);
    return response.data;
  },

  // Direct torrent search endpoints
  searchTorrents: async (params: {
    query: string;
    category?: string;
    indexers?: string[];
    minSeeders?: number;
    maxSize?: string;
    quality?: string[];
    format?: string[];
    limit?: number;
  }): Promise<{ success: boolean; data?: TorrentResult[]; error?: string }> => {
    const searchParams = new URLSearchParams();
    searchParams.append('query', params.query);
    if (params.category) searchParams.append('category', params.category);
    if (params.indexers) params.indexers.forEach(indexer => searchParams.append('indexers', indexer));
    if (params.minSeeders) searchParams.append('minSeeders', params.minSeeders.toString());
    if (params.maxSize) searchParams.append('maxSize', params.maxSize);
    if (params.quality) params.quality.forEach(q => searchParams.append('quality', q));
    if (params.format) params.format.forEach(f => searchParams.append('format', f));
    if (params.limit) searchParams.append('limit', params.limit.toString());

    const response = await api.get(`/torrents/search?${searchParams}`);
    return response.data;
  },

  searchMovieTorrents: async (params: {
    query: string;
    year?: number;
    imdbId?: string;
    indexers?: string[];
    minSeeders?: number;
    maxSize?: string;
    quality?: string[];
    format?: string[];
    limit?: number;
  }): Promise<{ success: boolean; data?: TorrentResult[]; error?: string }> => {
    const searchParams = new URLSearchParams();
    searchParams.append('query', params.query);
    if (params.year) searchParams.append('year', params.year.toString());
    if (params.imdbId) searchParams.append('imdbId', params.imdbId);
    if (params.indexers) params.indexers.forEach(indexer => searchParams.append('indexers', indexer));
    if (params.minSeeders) searchParams.append('minSeeders', params.minSeeders.toString());
    if (params.maxSize) searchParams.append('maxSize', params.maxSize);
    if (params.quality) params.quality.forEach(q => searchParams.append('quality', q));
    if (params.format) params.format.forEach(f => searchParams.append('format', f));
    if (params.limit) searchParams.append('limit', params.limit.toString());

    const response = await api.get(`/torrents/movies/search?${searchParams}`);
    return response.data;
  },

  searchTvTorrents: async (params: {
    query: string;
    season?: number;
    episode?: number;
    year?: number;
    imdbId?: string;
    indexers?: string[];
    minSeeders?: number;
    maxSize?: string;
    quality?: string[];
    format?: string[];
    limit?: number;
  }): Promise<{ success: boolean; data?: TorrentResult[]; error?: string }> => {
    const searchParams = new URLSearchParams();
    searchParams.append('query', params.query);
    if (params.season) searchParams.append('season', params.season.toString());
    if (params.episode) searchParams.append('episode', params.episode.toString());
    if (params.imdbId) searchParams.append('imdbId', params.imdbId);
    if (params.indexers) params.indexers.forEach(indexer => searchParams.append('indexers', indexer));
    if (params.minSeeders) searchParams.append('minSeeders', params.minSeeders.toString());
    if (params.maxSize) searchParams.append('maxSize', params.maxSize);
    if (params.quality) params.quality.forEach(q => searchParams.append('quality', q));
    if (params.format) params.format.forEach(f => searchParams.append('format', f));
    if (params.limit) searchParams.append('limit', params.limit.toString());

    const response = await api.get(`/torrents/tv/search?${searchParams}`);
    return response.data;
  },

  searchGameTorrents: async (params: {
    query: string;
    year?: number;
    platform?: string;
    igdbId?: number;
    indexers?: string[];
    minSeeders?: number;
    maxSize?: string;
    limit?: number;
  }): Promise<{ success: boolean; data?: TorrentResult[]; error?: string }> => {
    const searchParams = new URLSearchParams();
    searchParams.append('query', params.query);
    if (params.year) searchParams.append('year', params.year.toString());
    if (params.platform) searchParams.append('platform', params.platform);
    if (params.igdbId) searchParams.append('igdbId', params.igdbId.toString());
    if (params.indexers) params.indexers.forEach(i => searchParams.append('indexers', i));
    if (params.minSeeders) searchParams.append('minSeeders', params.minSeeders.toString());
    if (params.maxSize) searchParams.append('maxSize', params.maxSize);
    if (params.limit) searchParams.append('limit', params.limit.toString());

    const response = await api.get(`/torrents/games?${searchParams}`);
    return response.data;
  },

  selectTorrent: async (requestId: string, resultId: string): Promise<{ success: boolean; message?: string; error?: string }> => {
    const response = await api.post(`/torrent-requests/${requestId}/select-torrent/${resultId}`);
    return response.data;
  },

  linkDownloadToRequest: async (requestId: string, downloadJobId: string, aria2Gid?: string, torrentTitle?: string): Promise<{ success: boolean; message?: string; error?: string }> => {
    const response = await api.post(`/torrent-requests/${requestId}/link-download`, {
      downloadJobId,
      aria2Gid,
      torrentTitle,
    });
    return response.data;
  },

  // Game Platforms API
  getGamePlatforms: async (): Promise<{ success: boolean; data: GamePlatform[] }> => {
    const response = await api.get('/game-platforms');
    return response.data;
  },

  getGamePlatformOptions: async (grouped = false): Promise<{ success: boolean; data: any }> => {
    const response = await api.get(`/game-platforms/options?grouped=${grouped}`);
    return response.data;
  },

  searchGamePlatforms: async (query: string): Promise<{ success: boolean; data: GamePlatform[] }> => {
    const response = await api.get(`/game-platforms/search?q=${encodeURIComponent(query)}`);
    return response.data;
  },

  // Organization Services
  getOrganizationSettings: async (): Promise<OrganizationSettings> => {
    const response = await api.get('/organization/settings');
    return response.data;
  },

  updateOrganizationSettings: async (settings: Partial<OrganizationSettings>): Promise<OrganizationSettings> => {
    const response = await api.put('/organization/settings', settings);
    return response.data;
  },

  getOrganizationRules: async (): Promise<OrganizationRule[]> => {
    const response = await api.get('/organization/rules');
    return response.data;
  },

  getOrganizationRule: async (contentType: 'MOVIE' | 'TV_SHOW' | 'GAME'): Promise<OrganizationRule> => {
    const response = await api.get(`/organization/rules/${contentType}`);
    return response.data;
  },

  createOrganizationRule: async (rule: CreateOrganizationRuleDto): Promise<OrganizationRule> => {
    const response = await api.post('/organization/rules', rule);
    return response.data;
  },

  updateOrganizationRule: async (id: string, rule: Partial<OrganizationRule>): Promise<OrganizationRule> => {
    const response = await api.put(`/organization/rules/${id}`, rule);
    return response.data;
  },

  deleteOrganizationRule: async (id: string): Promise<{ success: boolean }> => {
    const response = await api.delete(`/organization/rules/${id}`);
    return response.data;
  },

  previewOrganizationPath: async (context: {
    contentType: 'MOVIE' | 'TV_SHOW' | 'GAME';
    title: string;
    year?: number;
    season?: number;
    episode?: number;
    platform?: string;
    quality?: string;
    format?: string;
    edition?: string;
  }): Promise<PathPreview> => {
    const response = await api.post('/organization/preview-path', context);
    return response.data;
  },

  triggerReverseIndexing: async (): Promise<{ success: boolean; message: string; results?: any }> => {
    const response = await api.post('/organization/reverse-index');
    return response.data;
  },

  getReverseIndexingStatus: async (): Promise<{ isRunning: boolean }> => {
    const response = await api.get('/organization/reverse-index/status');
    return response.data;
  },

  extractMetadata: async (fileName: string, contentType: 'MOVIE' | 'TV_SHOW' | 'GAME'): Promise<FileMetadata> => {
    const response = await api.get(`/organization/extract-metadata?fileName=${encodeURIComponent(fileName)}&contentType=${contentType}`);
    return response.data;
  },

  // Get poster URL for a TMDB ID
  getTmdbPosterUrl: async (tmdbId: number, contentType: 'movie' | 'tv' = 'movie'): Promise<{ success: boolean; data?: string; error?: string }> => {
    const endpoint = contentType === 'tv' ? 'tv-shows' : 'movies';
    const response = await api.get(`/discovery/${endpoint}/tmdb/${tmdbId}/poster`);
    return response.data;
  },
};

// Error handling interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

// Utility function to generate TMDB poster URL from TMDB ID
export const getTmdbPosterUrl = (tmdbId: number | string | undefined, size: string = 'w500'): string | undefined => {
  if (!tmdbId) return undefined;

  // For now, we'll need to make an API call to get the poster path
  // This is a placeholder - in a real implementation, you might want to cache this
  // TODO: Use the size parameter when implementing the actual TMDB API call
  console.log(`Getting poster for TMDB ID ${tmdbId} with size ${size}`)
  // or add an endpoint that returns the poster URL directly
  return undefined;
};

// Utility function to generate poster URL for a request
export const getRequestPosterUrl = (request: TorrentRequest): string | undefined => {
  // Try TMDB ID first (most reliable for movies/TV shows)
  if (request.tmdbId) {
    return getTmdbPosterUrl(request.tmdbId);
  }

  // For now, return undefined - we could potentially add IMDB poster lookup later
  return undefined;
};

export default api;
