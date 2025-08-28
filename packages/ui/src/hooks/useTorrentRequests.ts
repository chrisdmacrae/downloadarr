import { useState, useEffect } from 'react'
import { apiService, TorrentRequest } from '@/services/api'

type StatusFilter = 'all' | TorrentRequest['status']

interface PaginationState {
  total: number
  limit: number
  offset: number
  hasMore: boolean
}

export function useTorrentRequests() {
  const [requests, setRequests] = useState<TorrentRequest[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({})
  const [pagination, setPagination] = useState<PaginationState>({
    total: 0,
    limit: 20,
    offset: 0,
    hasMore: false,
  })

  const fetchRequests = async (params?: {
    status?: string;
    userId?: string;
    search?: string;
    limit?: number;
    offset?: number;
    append?: boolean; // For load more functionality
  }) => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await apiService.getTorrentRequests({
        status: params?.status || (statusFilter !== 'all' ? statusFilter : undefined),
        userId: params?.userId,
        search: params?.search || searchQuery || undefined,
        limit: params?.limit || pagination.limit,
        offset: params?.offset || 0,
      })

      if (response.success && response.data) {
        if (params?.append) {
          setRequests(prev => [...prev, ...response.data!])
        } else {
          setRequests(response.data)
        }

        if (response.pagination) {
          setPagination(response.pagination)
        }
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

  const fetchStatusCounts = async (params?: {
    userId?: string;
    search?: string;
  }) => {
    try {
      const response = await apiService.getTorrentRequestCounts({
        userId: params?.userId,
        search: params?.search || searchQuery || undefined,
      })

      if (response.success && response.data) {
        setStatusCounts(response.data)
      }
    } catch (err) {
      console.error('Error fetching status counts:', err)
    }
  }

  useEffect(() => {
    fetchRequests()
    fetchStatusCounts()

    // Poll for updates every 30 seconds (only refresh current page)
    const interval = setInterval(() => {
      fetchRequests({ offset: pagination.offset })
      fetchStatusCounts()
    }, 30000)

    return () => clearInterval(interval)
  }, [pagination.offset])

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      // Reset to first page when search changes
      fetchRequests({ search: searchQuery, offset: 0 })
      fetchStatusCounts()
    }, 300) // 300ms debounce

    return () => clearTimeout(timeoutId)
  }, [searchQuery])

  // Status filter effect
  useEffect(() => {
    // Reset to first page when status filter changes
    fetchRequests({
      status: statusFilter !== 'all' ? statusFilter : undefined,
      offset: 0
    })
    // Note: Don't refetch counts on status filter change since counts don't change based on current filter
  }, [statusFilter])

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

  const getRequestForGame = (title: string, year?: number): TorrentRequest | undefined => {
    // For games, find any request for this game
    return requests.find(request => {
      const titleMatch = request.title.toLowerCase() === title.toLowerCase()
      const yearMatch = !year || request.year === year
      const isGame = request.contentType === 'GAME'

      return titleMatch && yearMatch && isGame
    })
  }

  const getRequestsByStatus = (status: TorrentRequest['status']) => {
    return requests.filter(request => request.status === status)
  }

  const refreshRequests = () => {
    fetchRequests({ offset: 0 })
  }

  const loadMore = () => {
    if (pagination.hasMore && !isLoading) {
      fetchRequests({
        offset: pagination.offset + pagination.limit,
        append: true
      })
    }
  }

  const goToPage = (page: number) => {
    const offset = page * pagination.limit
    fetchRequests({ offset })
  }

  const changePageSize = (newLimit: number) => {
    setPagination(prev => ({ ...prev, limit: newLimit }))
    fetchRequests({ limit: newLimit, offset: 0 })
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
    pagination,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    statusCounts,
    getRequestForItem,
    getRequestForShow,
    getRequestForGame,
    getRequestsByStatus,
    refreshRequests,
    loadMore,
    goToPage,
    changePageSize,
    getTvShowSeasonSummary,
    isOngoingTvShow,
  }
}
