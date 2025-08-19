import { useState, useEffect } from 'react'
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
  Filter,
  MoreVertical,
  Trash2,
  XCircle,
  RefreshCw,
  Download,
  Film,
  Tv,
  Calendar,
  Clock,
  AlertCircle,
  CheckCircle,
  Loader2,
  SearchIcon,
  PlayCircle
} from 'lucide-react'
import { DownloadStatusBadge } from '@/components/DownloadStatusBadge'
import { TorrentSelectionModal } from '@/components/TorrentSelectionModal'
import { apiService, TorrentRequest } from '@/services/api'
import { useTorrentRequests } from '@/hooks/useTorrentRequests'
import { useToast } from '@/hooks/use-toast'

type StatusFilter = 'all' | TorrentRequest['status']

export default function Requests() {
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sortBy, setSortBy] = useState<'created' | 'updated' | 'priority'>('created')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [selectedRequest, setSelectedRequest] = useState<TorrentRequest | null>(null)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [isCancelling, setIsCancelling] = useState<string | null>(null)
  const [isSearching, setIsSearching] = useState<string | null>(null)
  const [isSearchingAll, setIsSearchingAll] = useState(false)
  const [torrentSelectionRequest, setTorrentSelectionRequest] = useState<TorrentRequest | null>(null)
  
  const { requests, isLoading, error, refreshRequests } = useTorrentRequests()
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
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Error cancelling request:', error)
      toast({
        title: "Cancel Failed",
        description: "An error occurred while cancelling the request",
        variant: "destructive",
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
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Error deleting request:', error)
      toast({
        title: "Delete Failed",
        description: "An error occurred while deleting the request",
        variant: "destructive",
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
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Error triggering search:', error)
      toast({
        title: "Search Failed",
        description: "An error occurred while triggering the search",
        variant: "destructive",
      })
    } finally {
      setIsSearching(null)
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
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Error triggering batch search:', error)
      toast({
        title: "Search Failed",
        description: "An error occurred while triggering the batch search",
        variant: "destructive",
      })
    } finally {
      setIsSearchingAll(false)
    }
  }

  const handleViewResults = (request: TorrentRequest) => {
    setTorrentSelectionRequest(request)
  }

  const handleTorrentSelected = () => {
    refreshRequests()
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

  const getContentIcon = (contentType: string) => {
    return contentType === 'MOVIE' ? Film : Tv
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
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Download Requests</h1>
            <p className="text-muted-foreground">
              Manage your torrent download requests
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleSearchAll}
              disabled={isSearchingAll || isLoading}
              variant="outline"
            >
              <PlayCircle className={`h-4 w-4 mr-2 ${isSearchingAll ? 'animate-spin' : ''}`} />
              {isSearchingAll ? 'Searching...' : 'Search All'}
            </Button>
            <Button onClick={refreshRequests} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
          <Card className="cursor-pointer hover:bg-accent" onClick={() => setStatusFilter('all')}>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold">{statusCounts.all}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:bg-accent" onClick={() => setStatusFilter('PENDING')}>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-yellow-600">{statusCounts.PENDING}</div>
              <div className="text-xs text-muted-foreground">Pending</div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:bg-accent" onClick={() => setStatusFilter('SEARCHING')}>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">{statusCounts.SEARCHING}</div>
              <div className="text-xs text-muted-foreground">Searching</div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:bg-accent" onClick={() => setStatusFilter('DOWNLOADING')}>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">{statusCounts.DOWNLOADING}</div>
              <div className="text-xs text-muted-foreground">Downloading</div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:bg-accent" onClick={() => setStatusFilter('COMPLETED')}>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{statusCounts.COMPLETED}</div>
              <div className="text-xs text-muted-foreground">Completed</div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:bg-accent" onClick={() => setStatusFilter('FAILED')}>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-red-600">{statusCounts.FAILED}</div>
              <div className="text-xs text-muted-foreground">Failed</div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:bg-accent" onClick={() => setStatusFilter('CANCELLED')}>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-gray-600">{statusCounts.CANCELLED}</div>
              <div className="text-xs text-muted-foreground">Cancelled</div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:bg-accent" onClick={() => setStatusFilter('EXPIRED')}>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-gray-600">{statusCounts.EXPIRED}</div>
              <div className="text-xs text-muted-foreground">Expired</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Search */}
        <div className="flex flex-col sm:flex-row gap-4">
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
            <SelectTrigger className="w-full sm:w-48">
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
            <SelectTrigger className="w-full sm:w-48">
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
              const ContentIcon = getContentIcon(request.contentType)
              const canCancel = ['PENDING', 'SEARCHING'].includes(request.status)
              const canDelete = true // Allow deletion of all requests - backend will handle download cancellation
              const canSearch = ['PENDING', 'FAILED', 'EXPIRED'].includes(request.status)
              const canViewResults = request.status === 'FOUND'
              
              return (
                <Card key={request.id} className="overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <ContentIcon className="h-5 w-5 mt-1 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-lg line-clamp-1">
                            {request.title}
                            {request.year && (
                              <span className="text-muted-foreground font-normal ml-2">
                                ({request.year})
                              </span>
                            )}
                          </CardTitle>
                          <CardDescription className="flex items-center gap-4 mt-1">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDate(request.createdAt)}
                            </span>
                            {request.season && (
                              <span>Season {request.season}</span>
                            )}
                            {request.episode && (
                              <span>Episode {request.episode}</span>
                            )}
                            <Badge variant="outline" className="capitalize">
                              {request.contentType.toLowerCase().replace('_', ' ')}
                            </Badge>
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
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
                            {canViewResults && (
                              <DropdownMenuItem
                                onClick={() => handleViewResults(request)}
                              >
                                <PlayCircle className="h-4 w-4 mr-2" />
                                View Results
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
                  
                  {(request.foundTorrentTitle || request.downloadProgress !== null) && (
                    <CardContent className="pt-0">
                      {request.foundTorrentTitle && (
                        <div className="text-sm text-muted-foreground mb-2">
                          <strong>Found:</strong> {request.foundTorrentTitle}
                        </div>
                      )}
                      {request.downloadProgress !== null && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span>Progress: {request.downloadProgress.toFixed(1)}%</span>
                            {request.downloadSpeed && <span>{request.downloadSpeed}</span>}
                          </div>
                          {request.downloadEta && (
                            <div className="text-sm text-muted-foreground">
                              ETA: {request.downloadEta}
                            </div>
                          )}
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
    </div>
  )
}
