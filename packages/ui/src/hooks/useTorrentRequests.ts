import { useState, useEffect } from 'react'
import { apiService, TorrentRequest } from '@/services/api'

export function useTorrentRequests() {
  const [requests, setRequests] = useState<TorrentRequest[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchRequests = async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await apiService.getTorrentRequests()
      if (response.success && response.data) {
        setRequests(response.data)
      } else {
        setError(response.error || 'Failed to fetch torrent requests')
      }
    } catch (err) {
      setError('Failed to fetch torrent requests')
      console.error('Error fetching torrent requests:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchRequests()
    
    // Poll for updates every 30 seconds
    const interval = setInterval(fetchRequests, 30000)
    
    return () => clearInterval(interval)
  }, [])

  const getRequestForItem = (title: string, year?: number, season?: number, episode?: number): TorrentRequest | undefined => {
    return requests.find(request => {
      const titleMatch = request.title.toLowerCase() === title.toLowerCase()
      const yearMatch = !year || request.year === year
      const seasonMatch = !season || request.season === season
      const episodeMatch = !episode || request.episode === episode
      
      return titleMatch && yearMatch && seasonMatch && episodeMatch
    })
  }

  const getRequestsByStatus = (status: TorrentRequest['status']) => {
    return requests.filter(request => request.status === status)
  }

  const refreshRequests = () => {
    fetchRequests()
  }

  return {
    requests,
    isLoading,
    error,
    getRequestForItem,
    getRequestsByStatus,
    refreshRequests,
  }
}
