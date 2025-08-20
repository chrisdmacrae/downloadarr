import { useState, useEffect, useCallback } from 'react'
import { apiService } from '@/services/api'

export interface LiveDownloadStatus {
  requestId: string;
  status: string;
  progress: number;
  downloadSpeed: string;
  eta: string;
  totalSize: number;
  completedSize: number;
  files: Array<{
    path: string;
    size: number;
    completedSize: number;
    progress: number;
  }>;
  torrentDownloads: Array<{
    id: string;
    title: string;
    status: string;
    progress: number;
    speed: string;
    eta: string;
  }>;
}

export interface DownloadSummary {
  totalRequests: number;
  downloading: number;
  completed: number;
  failed: number;
  totalProgress: number;
  totalSpeed: string;
}

export function useDownloadStatus(requestId?: string) {
  const [downloadStatus, setDownloadStatus] = useState<LiveDownloadStatus | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchDownloadStatus = useCallback(async () => {
    if (!requestId) return

    setIsLoading(true)
    setError(null)
    
    try {
      const response = await apiService.getRequestDownloadStatus(requestId)
      if (response.success && response.data) {
        setDownloadStatus(response.data)
      } else {
        setError(response.error || 'Failed to fetch download status')
      }
    } catch (err) {
      setError('Failed to fetch download status')
      console.error('Error fetching download status:', err)
    } finally {
      setIsLoading(false)
    }
  }, [requestId])

  useEffect(() => {
    if (!requestId) return

    fetchDownloadStatus()
    
    // Poll for updates every 5 seconds for downloading requests
    const interval = setInterval(fetchDownloadStatus, 5000)
    
    return () => clearInterval(interval)
  }, [requestId, fetchDownloadStatus])

  return {
    downloadStatus,
    isLoading,
    error,
    refreshStatus: fetchDownloadStatus,
  }
}

export function useDownloadSummary() {
  const [summary, setSummary] = useState<DownloadSummary | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchSummary = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await apiService.getDownloadSummary()
      if (response.success && response.data) {
        setSummary(response.data)
      } else {
        setError(response.error || 'Failed to fetch download summary')
      }
    } catch (err) {
      setError('Failed to fetch download summary')
      console.error('Error fetching download summary:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSummary()
    
    // Poll for updates every 10 seconds
    const interval = setInterval(fetchSummary, 10000)
    
    return () => clearInterval(interval)
  }, [fetchSummary])

  return {
    summary,
    isLoading,
    error,
    refreshSummary: fetchSummary,
  }
}

// Hook for multiple download statuses
export function useMultipleDownloadStatuses(requestIds: string[]) {
  const [statuses, setStatuses] = useState<Record<string, LiveDownloadStatus>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchStatuses = useCallback(async () => {
    if (requestIds.length === 0) return

    setIsLoading(true)
    setError(null)
    
    try {
      const promises = requestIds.map(async (id) => {
        const response = await apiService.getRequestDownloadStatus(id)
        return { id, data: response.success ? response.data : null }
      })

      const results = await Promise.all(promises)
      const newStatuses: Record<string, LiveDownloadStatus> = {}
      
      results.forEach(({ id, data }) => {
        if (data) {
          newStatuses[id] = data
        }
      })

      setStatuses(newStatuses)
    } catch (err) {
      setError('Failed to fetch download statuses')
      console.error('Error fetching download statuses:', err)
    } finally {
      setIsLoading(false)
    }
  }, [requestIds])

  useEffect(() => {
    if (requestIds.length === 0) return

    fetchStatuses()
    
    // Poll for updates every 5 seconds
    const interval = setInterval(fetchStatuses, 5000)
    
    return () => clearInterval(interval)
  }, [requestIds, fetchStatuses])

  return {
    statuses,
    isLoading,
    error,
    refreshStatuses: fetchStatuses,
  }
}
