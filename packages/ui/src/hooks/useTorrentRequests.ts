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

  const getRequestForItem = (title: string, year?: number, season?: number, episode?: number, contentType?: 'MOVIE' | 'TV_SHOW'): TorrentRequest | undefined => {
    return requests.find(request => {
      const titleMatch = request.title.toLowerCase() === title.toLowerCase()
      const yearMatch = !year || request.year === year
      const seasonMatch = !season || request.season === season
      const episodeMatch = !episode || request.episode === episode
      const contentTypeMatch = !contentType || request.contentType === contentType

      return titleMatch && yearMatch && seasonMatch && episodeMatch && contentTypeMatch
    })
  }

  const getRequestForShow = (title: string, year?: number): TorrentRequest | undefined => {
    // For TV shows, find any request for this show regardless of season/episode
    return requests.find(request => {
      const titleMatch = request.title.toLowerCase() === title.toLowerCase()
      const yearMatch = !year || request.year === year
      const isShow = request.contentType === 'TV_SHOW'

      return titleMatch && yearMatch && isShow
    })
  }

  const getRequestsByStatus = (status: TorrentRequest['status']) => {
    return requests.filter(request => request.status === status)
  }

  const refreshRequests = () => {
    fetchRequests()
  }

  // TV Show season summary helpers
  const getTvShowSeasonSummary = (request: TorrentRequest) => {
    if (request.contentType !== 'TV_SHOW' || !request.tvShowSeasons) {
      return null
    }

    const seasons = request.tvShowSeasons.map(season => ({
      seasonNumber: season.seasonNumber,
      totalEpisodes: season.totalEpisodes || 0,
      completedEpisodes: season.episodes?.filter(ep => ep.status === 'COMPLETED').length || 0,
      downloadingEpisodes: season.episodes?.filter(ep => ep.status === 'DOWNLOADING').length || 0,
      status: season.status,
    }))

    return {
      totalSeasons: seasons.length,
      seasons: seasons.sort((a, b) => a.seasonNumber - b.seasonNumber),
      overallProgress: {
        totalEpisodes: seasons.reduce((sum, s) => sum + s.totalEpisodes, 0),
        completedEpisodes: seasons.reduce((sum, s) => sum + s.completedEpisodes, 0),
        downloadingEpisodes: seasons.reduce((sum, s) => sum + s.downloadingEpisodes, 0),
      }
    }
  }

  const isOngoingTvShow = (request: TorrentRequest): boolean => {
    return request.contentType === 'TV_SHOW' && request.isOngoing === true
  }

  return {
    requests,
    isLoading,
    error,
    getRequestForItem,
    getRequestForShow,
    getRequestsByStatus,
    refreshRequests,
    getTvShowSeasonSummary,
    isOngoingTvShow,
  }
}
