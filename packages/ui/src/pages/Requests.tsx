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
  ExternalLink
} from 'lucide-react'
import { DownloadStatusBadge } from '@/components/DownloadStatusBadge'
import { TorrentSelectionModal } from '@/components/TorrentSelectionModal'
import { EditRequestModal } from '@/components/EditRequestModal'
import { TvShowSeasonBadges } from '@/components/TvShowSeasonBadges'
import { TvShowSeasonModal } from '@/components/TvShowSeasonModal'
import { MovieDetailModal } from '@/components/MovieDetailModal'
import { GameDetailModal } from '@/components/GameDetailModal'
import { apiService, TorrentRequest } from '@/services/api'
import { useTorrentRequests } from '@/hooks/useTorrentRequests'
import { useToast } from '@/hooks/use-toast'

type StatusFilter = 'all' | TorrentRequest['status']

export default function Requests() {
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sortBy, setSortBy] = useState<'created' | 'updated' | 'priority'>('created')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [isCancelling, setIsCancelling] = useState<string | null>(null)
  const [isSearching, setIsSearching] = useState<string | null>(null)
  const [isReSearching, setIsReSearching] = useState<string | null>(null)
  const [isSearchingAll, setIsSearchingAll] = useState(false)
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

  const { requests, isLoading, error, refreshRequests, isOngoingTvShow } = useTorrentRequests()
  const { toast } = useToast()

  // Filter and sort requests
  const filteredRequests = requests
    .filter(request => {
      const matchesSearch = request.title.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesStatus = statusFilter === 'all' || request.status === statusFilter
      return matchesSearch && matchesStatus
    })
    .sort((a, b) => {
      let comparison = 0

      switch (sortBy) {
        case 'created':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          break
        case 'updated':
          comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
          break
        case 'priority':
          comparison = a.priority - b.priority
          break
      }

      return sortOrder === 'asc' ? comparison : -comparison
    })

  const handleCancelRequest = async (request: TorrentRequest) => {
    setIsCancelling(request.id)

    try {
      const response = await apiService.cancelTorrentRequest(request.id)

      if (response.success) {
        toast({
          title: "Request Cancelled",
          description: `${request.title} has been cancelled`,
        })
        refreshRequests()
      } else {
        toast({
          title: "Cancel Failed",
          description: response.error || "Failed to cancel request",
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

  const handleDeleteRequest = async (request: TorrentRequest) => {
    setIsDeleting(request.id)

    try {
      const response = await apiService.deleteTorrentRequest(request.id)

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
          description: response.error || "Failed to delete request",
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

  const handleSearchRequest = async (request: TorrentRequest) => {
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

  const handleEditRequest = (request: TorrentRequest) => {
    setEditRequest(request)
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

  const handleItemClick = (request: TorrentRequest) => {
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
      title: request.title
    });
    setShowDetailModal(true);
  }

  const getStatusCounts = () => {
    const counts = {
      all: requests.length,
      PENDING: 0,
      SEARCHING: 0,
      FOUND: 0,
      DOWNLOADING: 0,
      COMPLETED: 0,
      FAILED: 0,
      CANCELLED: 0,
      EXPIRED: 0,
    }

    requests.forEach(request => {
      counts[request.status]++
    })

    return counts
  }

  const statusCounts = getStatusCounts()

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
            <p className="text-muted-foreground mb-4">{error}</p>
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
              Manage your torrent download requests
            </p>
          </div>
          <div className="flex gap-2">
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
              <div className="text-lg md:text-2xl font-bold">{statusCounts.all}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:bg-accent" onClick={() => setStatusFilter('PENDING')}>
            <CardContent className="p-2 md:p-4 text-center">
              <div className="text-lg md:text-2xl font-bold text-yellow-600">{statusCounts.PENDING}</div>
              <div className="text-xs text-muted-foreground">Pending</div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:bg-accent" onClick={() => setStatusFilter('SEARCHING')}>
            <CardContent className="p-2 md:p-4 text-center">
              <div className="text-lg md:text-2xl font-bold text-blue-600">{statusCounts.SEARCHING}</div>
              <div className="text-xs text-muted-foreground">Searching</div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:bg-accent" onClick={() => setStatusFilter('DOWNLOADING')}>
            <CardContent className="p-2 md:p-4 text-center">
              <div className="text-lg md:text-2xl font-bold text-blue-600">{statusCounts.DOWNLOADING}</div>
              <div className="text-xs text-muted-foreground">Downloading</div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:bg-accent" onClick={() => setStatusFilter('COMPLETED')}>
            <CardContent className="p-2 md:p-4 text-center">
              <div className="text-lg md:text-2xl font-bold text-green-600">{statusCounts.COMPLETED}</div>
              <div className="text-xs text-muted-foreground">Completed</div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:bg-accent" onClick={() => setStatusFilter('FAILED')}>
            <CardContent className="p-2 md:p-4 text-center">
              <div className="text-lg md:text-2xl font-bold text-red-600">{statusCounts.FAILED}</div>
              <div className="text-xs text-muted-foreground">Failed</div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:bg-accent" onClick={() => setStatusFilter('CANCELLED')}>
            <CardContent className="p-2 md:p-4 text-center">
              <div className="text-lg md:text-2xl font-bold text-gray-600">{statusCounts.CANCELLED}</div>
              <div className="text-xs text-muted-foreground">Cancelled</div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:bg-accent" onClick={() => setStatusFilter('EXPIRED')}>
            <CardContent className="p-2 md:p-4 text-center">
              <div className="text-lg md:text-2xl font-bold text-gray-600">{statusCounts.EXPIRED}</div>
              <div className="text-xs text-muted-foreground">Expired</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Search */}
        <div className="flex flex-col gap-3 md:flex-row md:gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search requests..."
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
              const canCancel = ['PENDING', 'SEARCHING', 'DOWNLOADING'].includes(request.status)
              const canDelete = ['FAILED', 'CANCELLED', 'EXPIRED', 'COMPLETED'].includes(request.status) // Allow deletion of all requests - backend will handle download cancellation
              const canSearch = ['PENDING', 'FAILED', 'EXPIRED'].includes(request.status)
              const canReSearch = request.status === 'CANCELLED'
              const canEdit = ['PENDING', 'SEARCHING', 'FAILED', 'CANCELLED'].includes(request.status)

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
                                <DownloadStatusBadge request={request} />
                              </div>
                              <Badge variant="outline" className="capitalize text-xs">
                                {isOngoingTvShow(request)
                                  ? 'Ongoing Series'
                                  : request.contentType.toLowerCase().replace('_', ' ')
                                }
                              </Badge>
                              {request.platform && (
                                <Badge variant="secondary" className="text-xs">
                                  {request.platform}
                                </Badge>
                              )}
                              {/* Display qualities for movies/TV shows */}
                              {(request.contentType === 'MOVIE' || request.contentType === 'TV_SHOW') && request.preferredQualities && request.preferredQualities.length > 0 && (
                                <>
                                  {request.preferredQualities.slice(0, 2).map((quality, index) => (
                                    <Badge key={index} variant="secondary" className="text-xs">
                                      {quality.replace('HD_', '').replace('UHD_', '')}
                                    </Badge>
                                  ))}
                                  {request.preferredQualities.length > 2 && (
                                    <Badge variant="secondary" className="text-xs">
                                      +{request.preferredQualities.length - 2}
                                    </Badge>
                                  )}
                                </>
                              )}
                              {/* Display formats for movies/TV shows */}
                              {(request.contentType === 'MOVIE' || request.contentType === 'TV_SHOW') && request.preferredFormats && request.preferredFormats.length > 0 && (
                                <>
                                  {request.preferredFormats.slice(0, 2).map((format, index) => (
                                    <Badge key={index} variant="outline" className="text-xs">
                                      {format}
                                    </Badge>
                                  ))}
                                  {request.preferredFormats.length > 2 && (
                                    <Badge variant="outline" className="text-xs">
                                      +{request.preferredFormats.length - 2}
                                    </Badge>
                                  )}
                                </>
                              )}
                            </div>
                          </CardDescription>
                        </div>
                      </div>
                      {/* Desktop: Status badge and menu on the right */}
                      <div className="hidden md:flex items-center gap-2">
                        <DownloadStatusBadge request={request} />
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

                  {request.contentType === 'TV_SHOW' && isOngoingTvShow(request) ? (
                    <CardContent className="pt-0 px-3 md:px-6">
                      <TvShowSeasonBadges
                        request={request}
                        onSeasonClick={(seasonNumber) => handleSeasonClick(request, seasonNumber)}
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

                  {!request.isOngoing && request.foundTorrentTitle && (
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
    </div>
  )
}
