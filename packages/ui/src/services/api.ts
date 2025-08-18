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
