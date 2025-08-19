import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/services/api';

// Query keys for consistent cache management
export const queryKeys = {
  queueStats: ['queue', 'stats'] as const,
  vpnStatus: ['vpn', 'status'] as const,
  aria2Stats: ['aria2', 'stats'] as const,
  downloads: ['downloads'] as const,
  activeDownloads: ['downloads', 'active'] as const,
  downloadStatus: (id: string) => ['downloads', id, 'status'] as const,
};

// Hook for queue statistics
export const useQueueStats = () => {
  return useQuery({
    queryKey: queryKeys.queueStats,
    queryFn: apiService.getQueueStats,
    refetchInterval: 5000, // Refetch every 5 seconds
    staleTime: 3000, // Consider data stale after 3 seconds
  });
};

// Hook for VPN status
export const useVpnStatus = () => {
  return useQuery({
    queryKey: queryKeys.vpnStatus,
    queryFn: apiService.getVpnStatus,
    refetchInterval: 10000, // Refetch every 10 seconds
    staleTime: 8000, // Consider data stale after 8 seconds
  });
};

// Hook for Aria2 statistics
export const useAria2Stats = () => {
  return useQuery({
    queryKey: queryKeys.aria2Stats,
    queryFn: apiService.getAria2Stats,
    refetchInterval: 5000, // Refetch every 5 seconds
    staleTime: 3000, // Consider data stale after 3 seconds
  });
};

// Hook for all downloads
export const useDownloads = () => {
  return useQuery({
    queryKey: queryKeys.downloads,
    queryFn: apiService.getDownloads,
    refetchInterval: 3000, // Refetch every 3 seconds for real-time updates
    staleTime: 1000, // Consider data stale after 1 second
  });
};

// Hook for active downloads
export const useActiveDownloads = () => {
  return useQuery({
    queryKey: queryKeys.activeDownloads,
    queryFn: apiService.getActiveDownloads,
    refetchInterval: 3000, // Refetch every 3 seconds for real-time updates
    staleTime: 1000, // Consider data stale after 1 second
  });
};

// Hook for individual download status
export const useDownloadStatus = (id: string) => {
  return useQuery({
    queryKey: queryKeys.downloadStatus(id),
    queryFn: () => apiService.getDownloadStatus(id),
    refetchInterval: 2000, // Refetch every 2 seconds for progress updates
    staleTime: 1000,
    enabled: !!id, // Only run query if id is provided
  });
};

// Mutation hooks for download actions
export const useCreateDownload = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: apiService.createDownload,
    onSuccess: () => {
      // Immediately refetch downloads and stats
      queryClient.refetchQueries({ queryKey: queryKeys.downloads });
      queryClient.refetchQueries({ queryKey: queryKeys.queueStats });
      queryClient.refetchQueries({ queryKey: queryKeys.activeDownloads });
    },
  });
};

export const usePauseDownload = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: apiService.pauseDownload,
    onSuccess: (_, downloadId) => {
      // Immediately refetch downloads and stats
      queryClient.refetchQueries({ queryKey: queryKeys.downloads });
      queryClient.refetchQueries({ queryKey: queryKeys.queueStats });
      queryClient.refetchQueries({ queryKey: queryKeys.activeDownloads });
      queryClient.invalidateQueries({ queryKey: queryKeys.downloadStatus(downloadId) });
    },
  });
};

export const useResumeDownload = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: apiService.resumeDownload,
    onSuccess: (_, downloadId) => {
      // Immediately refetch downloads and stats
      queryClient.refetchQueries({ queryKey: queryKeys.downloads });
      queryClient.refetchQueries({ queryKey: queryKeys.queueStats });
      queryClient.refetchQueries({ queryKey: queryKeys.activeDownloads });
      queryClient.invalidateQueries({ queryKey: queryKeys.downloadStatus(downloadId) });
    },
  });
};

export const useCancelDownload = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: apiService.cancelDownload,
    onSuccess: (_, downloadId) => {
      // Immediately refetch downloads and stats
      queryClient.refetchQueries({ queryKey: queryKeys.downloads });
      queryClient.refetchQueries({ queryKey: queryKeys.queueStats });
      queryClient.refetchQueries({ queryKey: queryKeys.activeDownloads });
      queryClient.invalidateQueries({ queryKey: queryKeys.downloadStatus(downloadId) });
    },
  });
};
