import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Search,
  MoreVertical,
  Trash2,
  XCircle,
  RefreshCw,
  Download,
  Calendar,
  AlertCircle,
  Loader2,
  SearchIcon,
  PlayCircle,
  Edit,
  ExternalLink,
  Link
} from 'lucide-react'
import { DownloadStatusBadge } from '@/components/DownloadStatusBadge'
import { TorrentSelectionModal } from '@/components/TorrentSelectionModal'
import { EditRequestModal } from '@/components/EditRequestModal'
import { TvShowSeasonBadges } from '@/components/TvShowSeasonBadges'
import { TvShowSeasonModal } from '@/components/TvShowSeasonModal'
import { MovieDetailModal } from '@/components/MovieDetailModal'
import { GameDetailModal } from '@/components/GameDetailModal'
import { apiService, TorrentRequest, AggregatedRequest } from '@/services/api'
import { useAggregatedRequests, useRequestStats } from '@/hooks/useApi'
import { HttpDownloadRequestModal } from '@/components/HttpDownloadRequestModal'
import { useToast } from '@/hooks/use-toast'

type StatusFilter = 'all' | TorrentRequest['status'] | 'PENDING_METADATA' | 'METADATA_MATCHED'

export default function Requests() {
  const [sortBy, setSortBy] = useState<'createdAt' | 'updatedAt' | 'priority'>('createdAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [isCancelling, setIsCancelling] = useState<string | null>(null)
  const [isSearching, setIsSearching] = useState<string | null>(null)
  const [isReSearching, setIsReSearching] = useState<string | null>(null)
  const [isSearchingAll, setIsSearchingAll] = useState(false)
  const [isStartingDownload, setIsStartingDownload] = useState<string | null>(null)
  const [torrentSelectionRequest, setTorrentSelectionRequest] = useState<TorrentRequest | null>(null)
  const [editRequest, setEditRequest] = useState<TorrentRequest | null>(null)
  const [seasonModalRequest, setSeasonModalRequest] = useState<TorrentRequest | null>(null)
  const [seasonModalSeasonNumber, setSeasonModalSeasonNumber] = useState<number | null>(null)
  const [selectedItem, setSelectedItem] = useState<{
    type: 'movie' | 'tv' | 'game'
    id: string
    title: string
  } | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showHttpRequestModal, setShowHttpRequestModal] = useState(false)

  // Use aggregated requests API
  const { data: requestsData, isLoading, error, refetch } = useAggregatedRequests({
    search: searchQuery || undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    limit: pageSize,
    offset: (currentPage - 1) * pageSize,
    sortBy,
    sortOrder,
  })

  const { data: statsData } = useRequestStats()

  const requests = requestsData?.data || []
  const totalCount = requestsData?.total || 0
  const statusCounts = statsData?.data?.total || {}

  const { toast } = useToast()

  const refreshRequests = () => {
    refetch()
  }

  const goToPage = (page: number) => {
    setCurrentPage(page)
  }

  const changePageSize = (size: number) => {
    setPageSize(size)
    setCurrentPage(1)
  }

  const isOngoingTvShow = (request: AggregatedRequest) => {
    return request.type === 'torrent' && request.contentType === 'TV_SHOW'
  }

  // Note: Filtering and sorting is now handled server-side via pagination
  // Client-side filtering conflicts with server-side pagination
  const filteredRequests = requests

  const handleStartHttpDownload = async (request: AggregatedRequest) => {
    if (request.type !== 'http' || request.status !== 'METADATA_MATCHED') {
      return
    }

    setIsStartingDownload(request.id)

    try {
      const response = await apiService.startHttpDownload(request.id)

      if (response.success) {
        toast({
          title: "Download Started",
          description: `Started download for "${request.title}"`,
        })
        refreshRequests()
      } else {
        toast({
          title: "Start Failed",
          description: "Failed to start download",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Error starting HTTP download:', error)
      toast({
        title: "Start Failed",
        description: "An error occurred while starting the download",
        variant: "destructive",
      })
    } finally {
      setIsStartingDownload(null)
    }
  }

  const handleCancelRequest = async (request: AggregatedRequest) => {
    setIsCancelling(request.id)

    try {
      let response
      if (request.type === 'torrent') {
        response = await apiService.cancelTorrentRequest(request.id)
      } else {
        response = await apiService.cancelHttpDownloadRequest(request.id)
      }

      if (response.success) {
        toast({
          title: "Request Cancelled",
          description: `${request.title} has been cancelled`,
        })
        refreshRequests()
      } else {
        toast({
          title: "Cancel Failed",
          description: "Failed to cancel request",
        })
      }
    } catch (error) {
      console.error('Error cancelling request:', error)
      toast({
        title: "Cancel Failed",
        description: "An error occurred while cancelling the request",
      })
    } finally {
      setIsCancelling(null)
    }
  }

  const handleDeleteRequest = async (request: AggregatedRequest) => {
    setIsDeleting(request.id)

    try {
      let response
      if (request.type === 'torrent') {
        response = await apiService.deleteTorrentRequest(request.id)
      } else {
        response = await apiService.deleteHttpDownloadRequest(request.id)
      }

      if (response.success) {
        const isDownloading = request.status === 'DOWNLOADING'
        toast({
          title: "Request Deleted",
          description: isDownloading
            ? `${request.title} has been removed and its download cancelled`
            : `${request.title} has been removed`,
        })
        refreshRequests()
      } else {
        toast({
          title: "Delete Failed",
          description: "Failed to delete request",
        })
      }
    } catch (error) {
      console.error('Error deleting request:', error)
      toast({
        title: "Delete Failed",
        description: "An error occurred while deleting the request",
      })
    } finally {
      setIsDeleting(null)
    }
  }

  const handleSearchRequest = async (request: AggregatedRequest) => {
    if (request.type === 'http') {
      // HTTP requests don't support re-searching after creation
      toast({
        title: "Not Available",
        description: "HTTP requests cannot be re-searched. Please create a new request if needed.",
        variant: "destructive",
      })
      return
    }

    setIsSearching(request.id)

    try {
      const response = await apiService.triggerRequestSearch(request.id)

      if (response.success) {
        toast({
          title: "Search Triggered",
          description: `Search started for ${request.title}`,
        })
        refreshRequests()
      } else {
        toast({
          title: "Search Failed",
          description: response.error || "Failed to trigger search",
        })
      }
    } catch (error) {
      console.error('Error triggering search:', error)
      toast({
        title: "Search Failed",
        description: "An error occurred while triggering the search",
      })
    } finally {
      setIsSearching(null)
    }
  }

  const handleReSearch = async (id: string) => {
    setIsReSearching(id)

    try {
      const response = await apiService.reSearchCancelledRequest(id)

      if (response.success) {
        toast({
          title: "Re-search Triggered",
          description: response.message || "Cancelled request reset and search started",
        })
        refreshRequests()
      } else {
        toast({
          title: "Re-search Failed",
          description: response.error || "Failed to re-search cancelled request",
        })
      }
    } catch (error) {
      console.error('Error re-searching cancelled request:', error)
      toast({
        title: "Re-search Failed",
        description: "An error occurred while re-searching the cancelled request",
      })
    } finally {
      setIsReSearching(null)
    }
  }

  const handleSearchAll = async () => {
    setIsSearchingAll(true)

    try {
      const response = await apiService.triggerAllRequestsSearch()

      if (response.success) {
        toast({
          title: "Batch Search Triggered",
          description: `Search started for ${response.searchedCount || 0} requests`,
        })
        refreshRequests()
      } else {
        toast({
          title: "Search Failed",
          description: response.error || "Failed to trigger batch search",
        })
      }
    } catch (error) {
      console.error('Error triggering batch search:', error)
      toast({
        title: "Search Failed",
        description: "An error occurred while triggering the batch search",
      })
    } finally {
      setIsSearchingAll(false)
    }
  }



  const handleTorrentSelected = () => {
    refreshRequests()
  }

  const handleEditRequest = (request: AggregatedRequest) => {
    if (request.type === 'torrent' && request.contentType && request.title) {
      // Convert AggregatedRequest to TorrentRequest for editing
      const torrentRequest: TorrentRequest = {
        ...request,
        contentType: request.contentType, // Ensure non-null
        title: request.title, // Ensure non-null
        year: request.year || undefined, // Convert null to undefined
        status: request.status as any, // Cast status to TorrentRequest status type
        preferredQualities: [],
        preferredFormats: [],
        minSeeders: 0,
        maxSizeGB: 0,
        isOngoing: false,
        foundTorrentTitle: request.foundTorrentTitle || undefined,
        searchAttempts: 0,
        maxSearchAttempts: 5,
      }
      setEditRequest(torrentRequest)
    }
    // HTTP requests don't support editing currently
  }



  const handleRequestUpdated = () => {
    refreshRequests()
  }

  const handleSeasonClick = (request: TorrentRequest, seasonNumber: number) => {
    setSeasonModalRequest(request)
    setSeasonModalSeasonNumber(seasonNumber)
  }

  const handleSeasonModalClose = () => {
    setSeasonModalRequest(null)
    setSeasonModalSeasonNumber(null)
  }

  const handleItemClick = (request: AggregatedRequest) => {
    // Determine the correct ID and type for fetching complete data
    let id: string;
    let type: 'movie' | 'tv' | 'game';

    if (request.contentType === 'GAME' && request.igdbId) {
      id = request.igdbId.toString();
      type = 'game';
    } else if (request.contentType === 'MOVIE' && request.tmdbId) {
      id = request.tmdbId.toString();
      type = 'movie';
    } else if (request.contentType === 'TV_SHOW' && request.tmdbId) {
      id = request.tmdbId.toString();
      type = 'tv';
    } else {
      // Fallback - this won't work for fetching external data
      console.warn(`No external ID found for request: ${request.title}`, request);
      id = request.id;
      type = request.contentType === 'MOVIE' ? 'movie' :
            request.contentType === 'TV_SHOW' ? 'tv' : 'game';
    }

    setSelectedItem({
      type,
      id,
      title: request.title || 'Unknown'
    });
    setShowDetailModal(true);
  }

  // Status counts are now fetched from the server via the hook

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Error Loading Requests</h2>
            <p className="text-muted-foreground mb-4">{error.message || 'An error occurred'}</p>
            <Button onClick={refreshRequests}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col gap-4 md:gap-6">
        {/* Header */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Download Requests</h1>
            <p className="text-sm md:text-base text-muted-foreground">
              Manage your torrent and HTTP download requests
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => setShowHttpRequestModal(true)}
              variant="default"
              size="sm"
              className="flex-1 md:flex-none"
            >
              <Link className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">Add HTTP Download</span>
            </Button>
            <Button
              onClick={handleSearchAll}
              disabled={isSearchingAll || isLoading}
              variant="outline"
              size="sm"
              className="flex-1 md:flex-none"
            >
              <PlayCircle className={`h-4 w-4 md:mr-2 ${isSearchingAll ? 'animate-spin' : ''}`} />
              <span className="hidden md:inline">{isSearchingAll ? 'Searching...' : 'Search All'}</span>
            </Button>
            <Button onClick={refreshRequests} disabled={isLoading} size="sm" className="flex-1 md:flex-none">
              <RefreshCw className={`h-4 w-4 md:mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden md:inline">Refresh</span>
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="hidden md:grid grid-cols-4 lg:grid-cols-8 gap-4">
          <Card className="cursor-pointer hover:bg-accent" onClick={() => setStatusFilter('all')}>
            <CardContent className="p-2 md:p-4 text-center">
              <div className="text-lg md:text-2xl font-bold">{statusCounts.all || 0}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:bg-accent" onClick={() => setStatusFilter('PENDING')}>
            <CardContent className="p-2 md:p-4 text-center">
              <div className="text-lg md:text-2xl font-bold text-yellow-600">{statusCounts.PENDING || 0}</div>
              <div className="text-xs text-muted-foreground">Pending</div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:bg-accent" onClick={() => setStatusFilter('SEARCHING')}>
            <CardContent className="p-2 md:p-4 text-center">
              <div className="text-lg md:text-2xl font-bold text-blue-600">{statusCounts.SEARCHING || 0}</div>
              <div className="text-xs text-muted-foreground">Searching</div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:bg-accent" onClick={() => setStatusFilter('DOWNLOADING')}>
            <CardContent className="p-2 md:p-4 text-center">
              <div className="text-lg md:text-2xl font-bold text-blue-600">{statusCounts.DOWNLOADING || 0}</div>
              <div className="text-xs text-muted-foreground">Downloading</div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:bg-accent" onClick={() => setStatusFilter('COMPLETED')}>
            <CardContent className="p-2 md:p-4 text-center">
              <div className="text-lg md:text-2xl font-bold text-green-600">{statusCounts.COMPLETED || 0}</div>
              <div className="text-xs text-muted-foreground">Completed</div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:bg-accent" onClick={() => setStatusFilter('FAILED')}>
            <CardContent className="p-2 md:p-4 text-center">
              <div className="text-lg md:text-2xl font-bold text-red-600">{statusCounts.FAILED || 0}</div>
              <div className="text-xs text-muted-foreground">Failed</div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:bg-accent" onClick={() => setStatusFilter('CANCELLED')}>
            <CardContent className="p-2 md:p-4 text-center">
              <div className="text-lg md:text-2xl font-bold text-gray-600">{statusCounts.CANCELLED || 0}</div>
              <div className="text-xs text-muted-foreground">Cancelled</div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:bg-accent" onClick={() => setStatusFilter('EXPIRED')}>
            <CardContent className="p-2 md:p-4 text-center">
              <div className="text-lg md:text-2xl font-bold text-gray-600">{statusCounts.EXPIRED || 0}</div>
              <div className="text-xs text-muted-foreground">Expired</div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:bg-accent" onClick={() => setStatusFilter('PENDING_METADATA')}>
            <CardContent className="p-2 md:p-4 text-center">
              <div className="text-lg md:text-2xl font-bold text-orange-600">{statusCounts.PENDING_METADATA || 0}</div>
              <div className="text-xs text-muted-foreground">Pending Metadata</div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:bg-accent" onClick={() => setStatusFilter('METADATA_MATCHED')}>
            <CardContent className="p-2 md:p-4 text-center">
              <div className="text-lg md:text-2xl font-bold text-purple-600">{statusCounts.METADATA_MATCHED || 0}</div>
              <div className="text-xs text-muted-foreground">Metadata Matched</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Search */}
        <div className="flex flex-col gap-3 md:flex-row md:gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search requests by title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={(value: StatusFilter) => setStatusFilter(value)}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="SEARCHING">Searching</SelectItem>
              <SelectItem value="FOUND">Found</SelectItem>
              <SelectItem value="DOWNLOADING">Downloading</SelectItem>
              <SelectItem value="COMPLETED">Completed</SelectItem>
              <SelectItem value="FAILED">Failed</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
              <SelectItem value="EXPIRED">Expired</SelectItem>
            </SelectContent>
          </Select>
          <Select value={`${sortBy}-${sortOrder}`} onValueChange={(value) => {
            const [field, order] = value.split('-')
            setSortBy(field as typeof sortBy)
            setSortOrder(order as typeof sortOrder)
          }}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="created-desc">Newest First</SelectItem>
              <SelectItem value="created-asc">Oldest First</SelectItem>
              <SelectItem value="updated-desc">Recently Updated</SelectItem>
              <SelectItem value="priority-desc">High Priority</SelectItem>
              <SelectItem value="priority-asc">Low Priority</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Requests List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="text-center py-12">
            <Download className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No requests found</h3>
            <p className="text-muted-foreground">
              {requests.length === 0
                ? "You haven't made any download requests yet."
                : "No requests match your current filters."
              }
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredRequests.map((request) => {
              // Handle both torrent and HTTP request statuses
              const canCancel = request.type === 'torrent'
                ? ['PENDING', 'SEARCHING', 'DOWNLOADING'].includes(request.status)
                : ['PENDING_METADATA', 'METADATA_MATCHED', 'DOWNLOADING'].includes(request.status)

              const canDelete = request.type === 'torrent'
                ? ['FAILED', 'CANCELLED', 'EXPIRED', 'COMPLETED'].includes(request.status)
                : ['FAILED', 'CANCELLED', 'COMPLETED'].includes(request.status)

              const canSearch = request.type === 'torrent'
                ? ['PENDING', 'FAILED', 'EXPIRED'].includes(request.status)
                : request.status === 'PENDING_METADATA' // For HTTP, "search" means metadata matching

              const canReSearch = request.status === 'CANCELLED'
              const canEdit = request.type === 'torrent'
                ? ['PENDING', 'SEARCHING', 'FAILED', 'CANCELLED'].includes(request.status)
                : false // HTTP requests don't support editing currently

              const canStartDownload = request.type === 'http' && request.status === 'METADATA_MATCHED'

              return (
                <Card key={request.id} className="overflow-hidden">
                  <CardHeader className="p-3 md:p-6 pb-2 md:pb-6">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2 md:gap-3 flex-1 min-w-0">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <CardTitle className="text-base md:text-lg line-clamp-2 md:line-clamp-1 flex-1">
                              <div
                                className="flex items-center gap-2 flex-wrap cursor-pointer hover:text-primary transition-colors group"
                                onClick={() => handleItemClick(request)}
                              >
                                <span>
                                  {request.title}
                                  {request.year && (
                                    <span className="text-muted-foreground font-normal ml-1 md:ml-2">
                                      ({request.year})
                                    </span>
                                  )}
                                </span>
                                <ExternalLink className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors" />
                              </div>
                            </CardTitle>
                            {/* Mobile: Dropdown menu right of title */}
                            <div className="md:hidden">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {canSearch && (
                                    <DropdownMenuItem
                                      onClick={() => handleSearchRequest(request)}
                                      disabled={isSearching === request.id}
                                    >
                                      {isSearching === request.id ? (
                                        <>
                                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                          Searching...
                                        </>
                                      ) : (
                                        <>
                                          <SearchIcon className="h-4 w-4 mr-2" />
                                          Search Now
                                        </>
                                      )}
                                    </DropdownMenuItem>
                                  )}
                                  {canReSearch && (
                                    <DropdownMenuItem
                                      onClick={() => handleReSearch(request.id)}
                                      disabled={isReSearching === request.id}
                                    >
                                      {isReSearching === request.id ? (
                                        <>
                                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                          Re-searching...
                                        </>
                                      ) : (
                                        <>
                                          <RefreshCw className="h-4 w-4 mr-2" />
                                          Re-search
                                        </>
                                      )}
                                    </DropdownMenuItem>
                                  )}
                                  {canStartDownload && (
                                    <DropdownMenuItem
                                      onClick={() => handleStartHttpDownload(request)}
                                      disabled={isStartingDownload === request.id}
                                    >
                                      {isStartingDownload === request.id ? (
                                        <>
                                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                          Starting...
                                        </>
                                      ) : (
                                        <>
                                          <Download className="h-4 w-4 mr-2" />
                                          Start Download
                                        </>
                                      )}
                                    </DropdownMenuItem>
                                  )}
                                  {canEdit && (
                                    <DropdownMenuItem
                                      onClick={() => handleEditRequest(request)}
                                    >
                                      <Edit className="h-4 w-4 mr-2" />
                                      Edit Request
                                    </DropdownMenuItem>
                                  )}
                                  {canCancel && (
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                          <XCircle className="h-4 w-4 mr-2" />
                                          Cancel Request
                                        </DropdownMenuItem>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>Cancel Request</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            Are you sure you want to cancel the download request for "{request.title}"?
                                            This action cannot be undone.
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                                          <AlertDialogAction
                                            onClick={() => handleCancelRequest(request)}
                                            disabled={isCancelling === request.id}
                                          >
                                            {isCancelling === request.id ? (
                                              <>
                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                Cancelling...
                                              </>
                                            ) : (
                                              'Cancel Request'
                                            )}
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  )}
                                  {canDelete && (
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                          <Trash2 className="h-4 w-4 mr-2" />
                                          Delete Request
                                        </DropdownMenuItem>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>Delete Request</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            Are you sure you want to permanently delete the request for{' '}
                                            <span className="font-semibold">
                                              "{request.title}"
                                              {request.year && ` (${request.year})`}
                                              {request.season && ` Season ${request.season}`}
                                              {request.episode && ` Episode ${request.episode}`}
                                            </span>
                                            ?{' '}
                                            {request.status === 'DOWNLOADING' && (
                                              <span className="text-destructive font-medium">
                                                This will also stop the active download.{' '}
                                              </span>
                                            )}
                                            This action cannot be undone and will remove all associated data.
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                                          <AlertDialogAction
                                            onClick={() => handleDeleteRequest(request)}
                                            disabled={isDeleting === request.id}
                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                          >
                                            {isDeleting === request.id ? (
                                              <>
                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                Deleting...
                                              </>
                                            ) : (
                                              'Delete Request'
                                            )}
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                          <CardDescription className="flex flex-col md:flex-row md:items-center gap-1 md:gap-4 mt-0.5 md:mt-1">
                            <span className="flex items-center gap-1 text-xs">
                              <Calendar className="h-3 w-3 flex-shrink-0" />
                              <span>{formatDate(request.createdAt)}</span>
                            </span>
                            <div className="flex flex-wrap items-center gap-1 md:gap-2">
                              {/* Mobile: Status badge as first badge */}
                              <div className="md:hidden">
                                {request.type === 'torrent' ? (
                                  <DownloadStatusBadge request={request as any} />
                                ) : (
                                  <Badge variant={
                                    request.status === 'COMPLETED' ? 'default' :
                                    request.status === 'DOWNLOADING' ? 'secondary' :
                                    request.status === 'FAILED' ? 'destructive' :
                                    'outline'
                                  }>
                                    {request.status.replace('_', ' ')}
                                  </Badge>
                                )}
                              </div>
                              <Badge variant="outline" className="capitalize text-xs">
                                {isOngoingTvShow(request)
                                  ? 'Ongoing Series'
                                  : request.contentType?.toLowerCase().replace('_', ' ') || 'Unknown'
                                }
                              </Badge>
                              {request.platform && (
                                <Badge variant="secondary" className="text-xs">
                                  {request.platform}
                                </Badge>
                              )}
                              {/* Quality and format preferences only available for torrent requests */}
                              {request.type === 'torrent' && (request.contentType === 'MOVIE' || request.contentType === 'TV_SHOW') && (
                                <div className="text-xs text-muted-foreground">
                                  Torrent preferences configured
                                </div>
                              )}
                            </div>
                          </CardDescription>
                        </div>
                      </div>
                      {/* Desktop: Status badge and menu on the right */}
                      <div className="hidden md:flex items-center gap-2">
                        {request.type === 'torrent' ? (
                          <DownloadStatusBadge request={request as any} />
                        ) : (
                          <Badge variant={
                            request.status === 'COMPLETED' ? 'default' :
                            request.status === 'DOWNLOADING' ? 'secondary' :
                            request.status === 'FAILED' ? 'destructive' :
                            'outline'
                          }>
                            {request.status.replace('_', ' ')}
                          </Badge>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {canSearch && (
                              <DropdownMenuItem
                                onClick={() => handleSearchRequest(request)}
                                disabled={isSearching === request.id}
                              >
                                {isSearching === request.id ? (
                                  <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Searching...
                                  </>
                                ) : (
                                  <>
                                    <SearchIcon className="h-4 w-4 mr-2" />
                                    Search Now
                                  </>
                                )}
                              </DropdownMenuItem>
                            )}
                            {canReSearch && (
                              <DropdownMenuItem
                                onClick={() => handleReSearch(request.id)}
                                disabled={isReSearching === request.id}
                              >
                                {isReSearching === request.id ? (
                                  <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Re-searching...
                                  </>
                                ) : (
                                  <>
                                    <RefreshCw className="h-4 w-4 mr-2" />
                                    Re-search
                                  </>
                                )}
                              </DropdownMenuItem>
                            )}
                            {canStartDownload && (
                              <DropdownMenuItem
                                onClick={() => handleStartHttpDownload(request)}
                                disabled={isStartingDownload === request.id}
                              >
                                {isStartingDownload === request.id ? (
                                  <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Starting...
                                  </>
                                ) : (
                                  <>
                                    <Download className="h-4 w-4 mr-2" />
                                    Start Download
                                  </>
                                )}
                              </DropdownMenuItem>
                            )}
                            {canEdit && (
                              <DropdownMenuItem
                                onClick={() => handleEditRequest(request)}
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                Edit Request
                              </DropdownMenuItem>
                            )}
                            {canCancel && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                    <XCircle className="h-4 w-4 mr-2" />
                                    Cancel Request
                                  </DropdownMenuItem>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Cancel Request</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to cancel the download request for "{request.title}"?
                                      This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleCancelRequest(request)}
                                      disabled={isCancelling === request.id}
                                    >
                                      {isCancelling === request.id ? (
                                        <>
                                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                          Cancelling...
                                        </>
                                      ) : (
                                        'Cancel Request'
                                      )}
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                            {canDelete && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete Request
                                  </DropdownMenuItem>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Request</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to permanently delete the download request for "{request.title}"?
                                      {request.status === 'DOWNLOADING' && (
                                        <span className="block mt-2 text-orange-600 font-medium">
                                          ⚠️ This request has an active download that will be cancelled.
                                        </span>
                                      )}
                                      This action cannot be undone and will remove all associated data.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDeleteRequest(request)}
                                      disabled={isDeleting === request.id}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      {isDeleting === request.id ? (
                                        <>
                                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                          Deleting...
                                        </>
                                      ) : (
                                        'Delete Request'
                                      )}
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>



                  </CardHeader>

                  {request.contentType === 'TV_SHOW' && request.type === 'torrent' && isOngoingTvShow(request) ? (
                    <CardContent className="pt-0 px-3 md:px-6">
                      <TvShowSeasonBadges
                        request={request as any}
                        onSeasonClick={(seasonNumber) => handleSeasonClick(request as any, seasonNumber)}
                        className="flex-wrap"
                      />
                    </CardContent>
                  ) : (
                    <CardContent className="pt-0 px-3 md:px-6">
                      {request.season && (
                        <span className="text-xs">Season {request.season}</span>
                      )}
                      {request.episode && (
                        <span className="text-xs">Episode {request.episode}</span>
                      )}
                    </CardContent>
                  )}

                  {request.type === 'torrent' && request.foundTorrentTitle && (
                    <CardContent className="pt-0 px-3 md:px-6">
                      {request.foundTorrentTitle && (
                        <div className="text-xs md:text-sm text-muted-foreground mb-2">
                          <strong>Found:</strong> {request.foundTorrentTitle}
                        </div>
                      )}
                    </CardContent>
                  )}
                </Card>
              )
            })}
          </div>
        )}

        {/* Pagination Controls */}
        {!isLoading && totalCount > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 px-2">
            <div className="text-sm text-muted-foreground">
              Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount} requests
            </div>

            <div className="flex items-center gap-2">
              <Select value={pageSize.toString()} onValueChange={(value) => changePageSize(Number(value))}>
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>

                <span className="text-sm px-2">
                  Page {currentPage} of {Math.ceil(totalCount / pageSize)}
                </span>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage >= Math.ceil(totalCount / pageSize)}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Torrent Selection Modal */}
      <TorrentSelectionModal
        isOpen={!!torrentSelectionRequest}
        onClose={() => setTorrentSelectionRequest(null)}
        request={torrentSelectionRequest}
        onTorrentSelected={handleTorrentSelected}
      />

      {/* Edit Request Modal */}
      <EditRequestModal
        request={editRequest}
        open={!!editRequest}
        onOpenChange={(open) => !open && setEditRequest(null)}
        onRequestUpdated={handleRequestUpdated}
      />

      {/* TV Show Season Modal */}
      <TvShowSeasonModal
        isOpen={!!seasonModalRequest}
        onClose={handleSeasonModalClose}
        request={seasonModalRequest}
        seasonNumber={seasonModalSeasonNumber}
      />

      {/* Detail Modals */}
      {selectedItem && selectedItem.type !== 'game' && (
        <MovieDetailModal
          contentType={selectedItem.type as 'movie' | 'tv'}
          contentId={selectedItem.id}
          title={selectedItem.title}
          open={showDetailModal}
          onOpenChange={setShowDetailModal}
        />
      )}

      {selectedItem && selectedItem.type === 'game' && (
        <GameDetailModal
          gameId={selectedItem.id}
          title={selectedItem.title}
          open={showDetailModal}
          onOpenChange={setShowDetailModal}
        />
      )}

      {/* HTTP Download Request Modals */}
      <HttpDownloadRequestModal
        open={showHttpRequestModal}
        onOpenChange={setShowHttpRequestModal}
        onRequestCreated={() => {
          refreshRequests()
        }}
      />
    </div>
  )
}
