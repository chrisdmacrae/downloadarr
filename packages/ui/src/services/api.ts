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
  status: string;
  progress: number;
  data?: {
    url: string;
    type: string;
    name?: string;
    destination?: string;
    aria2Gid?: string;
  };
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

  // Get active downloads (this would need to be implemented in the API)
  getActiveDownloads: async (): Promise<DownloadJob[]> => {
    // For now, we'll use queue stats to get active count
    // In a real implementation, you'd want a dedicated endpoint
    await api.get('/downloads/queue/stats');
    return []; // Placeholder - would return actual active downloads
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
};

// Error handling interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

export default api;
