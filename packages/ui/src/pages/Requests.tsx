import { useMemo, useState } from 'react'
import {
  AlertCircle,
  Download,
  Edit,
  ExternalLink,
  Link as LinkIcon,
  Loader2,
  MoreVertical,
  PlayCircle,
  RefreshCw,
  Search,
  SearchIcon,
  Trash2,
  XCircle,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { MediaCard, MediaCardSkeleton } from '@/components/ds/MediaCard'
import { EmptyState, Page, PageHeader, PageSection } from '@/components/ds/Page'
import { Rail } from '@/components/ds/Rail'
import { StatusBadge } from '@/components/ds/StatusBadge'
import { TorrentSelectionModal } from '@/components/TorrentSelectionModal'
import { EditRequestModal } from '@/components/EditRequestModal'
import { TvShowSeasonBadges } from '@/components/TvShowSeasonBadges'
import { TvShowSeasonModal } from '@/components/TvShowSeasonModal'
import { MovieDetailModal } from '@/components/MovieDetailModal'
import { GameDetailModal } from '@/components/GameDetailModal'
import { HttpDownloadRequestModal } from '@/components/HttpDownloadRequestModal'
import { apiService, TorrentRequest, AggregatedRequest } from '@/services/api'
import { useAggregatedRequests, useRequestStats } from '@/hooks/useApi'
import { useToast } from '@/hooks/use-toast'
import { contentTypeTone, formatRelativeTime, normalizeStatus } from '@/lib/status'

const CARD_WIDTH = 320

type StatusFilter = 'all' | TorrentRequest['status'] | 'PENDING_METADATA' | 'METADATA_MATCHED'

/** The full RequestStatus set, plus the two HTTP-only states. */
const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'SEARCHING', label: 'Searching' },
  { value: 'FOUND', label: 'Found' },
  { value: 'DOWNLOADING', label: 'Downloading' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'PENDING_METADATA', label: 'Needs metadata' },
  { value: 'METADATA_MATCHED', label: 'Metadata matched' },
]

/** Order the state groups follow the lifecycle, so a page reads left to right. */
const GROUP_ORDER = [
  'DOWNLOADING',
  'FOUND',
  'SEARCHING',
  'METADATA_MATCHED',
  'PENDING_METADATA',
  'PENDING',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
  'EXPIRED',
] as const

const GROUP_LABELS: Record<string, string> = {
  DOWNLOADING: 'Downloading',
  FOUND: 'Found',
  SEARCHING: 'Searching',
  METADATA_MATCHED: 'Metadata matched',
  PENDING_METADATA: 'Needs metadata',
  PENDING: 'Pending',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled',
  EXPIRED: 'Expired',
}

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
  const statusCounts: Record<string, number> = statsData?.data?.total || {}
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

  const { toast } = useToast()

  const refreshRequests = () => {
    refetch()
  }

  const changePageSize = (size: number) => {
    setPageSize(size)
    setCurrentPage(1)
  }

  const isOngoingTvShow = (request: AggregatedRequest) =>
    request.type === 'torrent' && request.contentType === 'TV_SHOW'

  /** Grouped by state when no single status is selected. */
  const groups = useMemo(() => {
    if (statusFilter !== 'all') {
      return [{ key: statusFilter, label: GROUP_LABELS[statusFilter] ?? 'Requests', items: requests }]
    }
    return GROUP_ORDER.map((key) => ({
      key,
      label: GROUP_LABELS[key],
      items: requests.filter((r) => r.status === key),
    })).filter((group) => group.items.length > 0)
  }, [requests, statusFilter])

  const handleStartHttpDownload = async (request: AggregatedRequest) => {
    if (request.type !== 'http' || request.status !== 'METADATA_MATCHED') return
    setIsStartingDownload(request.id)
    try {
      const response = await apiService.startHttpDownload(request.id)
      if (response.success) {
        toast({ title: 'Download started', description: `${request.title} — transferring now.` })
        refreshRequests()
      } else {
        toast({ title: 'Start failed', description: 'Failed to start download.', variant: 'destructive' })
      }
    } catch (err) {
      console.error('Error starting HTTP download:', err)
      toast({
        title: 'Start failed',
        description: 'An error occurred while starting the download.',
        variant: 'destructive',
      })
    } finally {
      setIsStartingDownload(null)
    }
  }

  const handleCancelRequest = async (request: AggregatedRequest) => {
    setIsCancelling(request.id)
    try {
      const response =
        request.type === 'torrent'
          ? await apiService.cancelTorrentRequest(request.id)
          : await apiService.cancelHttpDownloadRequest(request.id)

      if (response.success) {
        toast({ title: 'Request cancelled', description: `${request.title} has been cancelled.` })
        refreshRequests()
      } else {
        toast({ title: 'Cancel failed', description: 'Failed to cancel request.', variant: 'destructive' })
      }
    } catch (err) {
      console.error('Error cancelling request:', err)
      toast({
        title: 'Cancel failed',
        description: 'An error occurred while cancelling the request.',
        variant: 'destructive',
      })
    } finally {
      setIsCancelling(null)
    }
  }

  const handleDeleteRequest = async (request: AggregatedRequest) => {
    setIsDeleting(request.id)
    try {
      const response =
        request.type === 'torrent'
          ? await apiService.deleteTorrentRequest(request.id)
          : await apiService.deleteHttpDownloadRequest(request.id)

      if (response.success) {
        toast({
          title: 'Request deleted',
          description:
            request.status === 'DOWNLOADING'
              ? `${request.title} has been removed and its download cancelled.`
              : `${request.title} has been removed.`,
        })
        refreshRequests()
      } else {
        toast({ title: 'Delete failed', description: 'Failed to delete request.', variant: 'destructive' })
      }
    } catch (err) {
      console.error('Error deleting request:', err)
      toast({
        title: 'Delete failed',
        description: 'An error occurred while deleting the request.',
        variant: 'destructive',
      })
    } finally {
      setIsDeleting(null)
    }
  }

  const handleSearchRequest = async (request: AggregatedRequest) => {
    if (request.type === 'http') {
      toast({
        title: 'Not available',
        description: 'HTTP requests cannot be re-searched. Create a new request instead.',
        variant: 'destructive',
      })
      return
    }

    setIsSearching(request.id)
    try {
      const response = await apiService.triggerRequestSearch(request.id)
      if (response.success) {
        toast({ title: 'Search triggered', description: `${request.title} — searching indexers now.` })
        refreshRequests()
      } else {
        toast({
          title: 'Search failed',
          description: response.error || 'Failed to trigger search.',
          variant: 'destructive',
        })
      }
    } catch (err) {
      console.error('Error triggering search:', err)
      toast({
        title: 'Search failed',
        description: 'An error occurred while triggering the search.',
        variant: 'destructive',
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
          title: 'Re-search triggered',
          description: response.message || 'Cancelled request reset and search started.',
        })
        refreshRequests()
      } else {
        toast({
          title: 'Re-search failed',
          description: response.error || 'Failed to re-search cancelled request.',
          variant: 'destructive',
        })
      }
    } catch (err) {
      console.error('Error re-searching cancelled request:', err)
      toast({
        title: 'Re-search failed',
        description: 'An error occurred while re-searching the cancelled request.',
        variant: 'destructive',
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
          title: 'Batch search triggered',
          description: `Search started for ${response.searchedCount || 0} requests.`,
        })
        refreshRequests()
      } else {
        toast({
          title: 'Search failed',
          description: response.error || 'Failed to trigger batch search.',
          variant: 'destructive',
        })
      }
    } catch (err) {
      console.error('Error triggering batch search:', err)
      toast({
        title: 'Search failed',
        description: 'An error occurred while triggering the batch search.',
        variant: 'destructive',
      })
    } finally {
      setIsSearchingAll(false)
    }
  }

  const handleEditRequest = (request: AggregatedRequest) => {
    if (request.type === 'torrent' && request.contentType && request.title) {
      const torrentRequest: TorrentRequest = {
        ...request,
        contentType: request.contentType,
        title: request.title,
        year: request.year || undefined,
        status: request.status as TorrentRequest['status'],
        preferredQualities: [],
        preferredFormats: [],
        preferredLanguages: [],
        minSeeders: 0,
        maxSizeGB: 0,
        isOngoing: request.isOngoing ?? false,
        foundTorrentTitle: request.foundTorrentTitle || undefined,
        searchAttempts: 0,
        maxSearchAttempts: 5,
      }
      setEditRequest(torrentRequest)
    }
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
    let id: string
    let type: 'movie' | 'tv' | 'game'

    if (request.contentType === 'GAME' && request.igdbId) {
      id = request.igdbId.toString()
      type = 'game'
    } else if (request.contentType === 'MOVIE' && request.tmdbId) {
      id = request.tmdbId.toString()
      type = 'movie'
    } else if (request.contentType === 'TV_SHOW' && request.tmdbId) {
      id = request.tmdbId.toString()
      type = 'tv'
    } else {
      id = request.id
      type =
        request.contentType === 'MOVIE' ? 'movie' : request.contentType === 'TV_SHOW' ? 'tv' : 'game'
    }

    setSelectedItem({ type, id, title: request.title || 'Unknown' })
    setShowDetailModal(true)
  }

  if (error) {
    return (
      <Page className="pt-8">
        <PageSection>
          <PageHeader title="Requests" description="Manage your torrent and HTTP download requests" />
          <EmptyState
            icon={<AlertCircle />}
            title="Failed to load requests"
            description={(error as Error).message || 'An error occurred.'}
            action={
              <Button onClick={refreshRequests}>
                <RefreshCw className="h-4 w-4" />
                Try again
              </Button>
            }
          />
        </PageSection>
      </Page>
    )
  }

  return (
    <Page className="pt-8">
      <PageSection bleedRails className="gap-6">
        <PageHeader
          eyebrow="Library"
          title="Requests"
          description="Manage your torrent and HTTP download requests"
          actions={
            <>
              <Button onClick={() => setShowHttpRequestModal(true)}>
                <LinkIcon className="h-4 w-4" />
                Add via URL
              </Button>
              <Button variant="outline" onClick={handleSearchAll} disabled={isSearchingAll || isLoading}>
                <PlayCircle className={`h-4 w-4 ${isSearchingAll ? 'animate-spin' : ''}`} />
                {isSearchingAll ? 'Searching…' : 'Search all'}
              </Button>
              <Button variant="secondary" onClick={refreshRequests} disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </>
          }
        />

        {/* Status filter row, doubling as counts. */}
        <div className="flex flex-wrap items-center gap-2">
          {STATUS_FILTERS.map((filter) => {
            const count =
              filter.value === 'all'
                ? Object.values(statusCounts).reduce((sum, n) => sum + n, 0)
                : statusCounts[filter.value] || 0
            const active = statusFilter === filter.value
            return (
              <button
                key={filter.value}
                type="button"
                onClick={() => {
                  setStatusFilter(filter.value)
                  setCurrentPage(1)
                }}
                className={`inline-flex h-8 items-center gap-2 rounded-pill px-3 text-xs font-semibold transition-colors duration-fast ease-standard focus-visible:outline-none focus-visible:shadow-focus ${
                  active
                    ? 'bg-[color:var(--accent-quiet)] text-fg-primary'
                    : 'bg-surface-input text-fg-secondary hover:bg-surface-input-hover hover:text-fg-primary'
                }`}
              >
                {filter.label}
                <span className="font-mono text-[10px] text-fg-muted">{count}</span>
              </button>
            )
          })}
        </div>

        {/* Search and sort */}
        <div className="flex flex-col gap-3 md:flex-row md:gap-4">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted" />
            <Input
              placeholder="Search requests by title…"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setCurrentPage(1)
              }}
              className="pl-10"
            />
          </div>
          <Select
            value={`${sortBy}-${sortOrder}`}
            onValueChange={(value) => {
              const [field, order] = value.split('-')
              setSortBy(field as typeof sortBy)
              setSortOrder(order as typeof sortOrder)
              setCurrentPage(1)
            }}
          >
            <SelectTrigger className="w-full md:w-52">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="createdAt-desc">Newest first</SelectItem>
              <SelectItem value="createdAt-asc">Oldest first</SelectItem>
              <SelectItem value="updatedAt-desc">Recently updated</SelectItem>
              <SelectItem value="priority-desc">High priority</SelectItem>
              <SelectItem value="priority-asc">Low priority</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Requests, grouped by state — one paged carousel per group. */}
        {isLoading ? (
          <Rail title="Loading requests">
            {Array.from({ length: 5 }).map((_, i) => (
              <MediaCardSkeleton key={i} width={CARD_WIDTH} />
            ))}
          </Rail>
        ) : requests.length === 0 ? (
          <EmptyState
            icon={<Download />}
            title="No requests found"
            description={
              searchQuery || statusFilter !== 'all'
                ? 'No requests match your current filters.'
                : "You haven't made any download requests yet."
            }
            action={
              <Button variant="secondary" onClick={() => setShowHttpRequestModal(true)}>
                <LinkIcon className="h-4 w-4" />
                Add via URL
              </Button>
            }
          />
        ) : (
          groups.map((group) => (
            <Rail key={group.key} title={group.label} count={group.items.length}>
              {group.items.map((request) => (
                <RequestCard
                  key={`${request.type}-${request.id}`}
                  request={request}
                  busy={{
                    searching: isSearching === request.id,
                    reSearching: isReSearching === request.id,
                    cancelling: isCancelling === request.id,
                    deleting: isDeleting === request.id,
                    starting: isStartingDownload === request.id,
                  }}
                  onOpen={() => handleItemClick(request)}
                  onSearch={() => handleSearchRequest(request)}
                  onReSearch={() => handleReSearch(request.id)}
                  onStartDownload={() => handleStartHttpDownload(request)}
                  onEdit={() => handleEditRequest(request)}
                  onCancel={() => handleCancelRequest(request)}
                  onDelete={() => handleDeleteRequest(request)}
                  seasonBadges={
                    isOngoingTvShow(request) ? (
                      <TvShowSeasonBadges
                        request={request as unknown as TorrentRequest}
                        onSeasonClick={(seasonNumber) =>
                          handleSeasonClick(request as unknown as TorrentRequest, seasonNumber)
                        }
                      />
                    ) : null
                  }
                />
              ))}
            </Rail>
          ))
        )}

        {/* Pagination */}
        {!isLoading && totalCount > 0 && (
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="font-mono text-xs text-fg-muted">
              {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, totalCount)} of{' '}
              {totalCount} requests
            </p>
            <div className="flex items-center gap-2">
              <Select value={pageSize.toString()} onValueChange={(value) => changePageSize(Number(value))}>
                <SelectTrigger className="w-[84px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <span className="px-1 font-mono text-xs text-fg-muted">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </PageSection>

      <TorrentSelectionModal
        isOpen={!!torrentSelectionRequest}
        onClose={() => setTorrentSelectionRequest(null)}
        request={torrentSelectionRequest}
        onTorrentSelected={refreshRequests}
      />

      <EditRequestModal
        request={editRequest}
        open={!!editRequest}
        onOpenChange={(open) => !open && setEditRequest(null)}
        onRequestUpdated={refreshRequests}
      />

      <TvShowSeasonModal
        isOpen={!!seasonModalRequest}
        onClose={handleSeasonModalClose}
        request={seasonModalRequest}
        seasonNumber={seasonModalSeasonNumber}
      />

      {selectedItem && selectedItem.type !== 'game' && (
        <MovieDetailModal
          contentType={selectedItem.type}
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

      <HttpDownloadRequestModal
        open={showHttpRequestModal}
        onOpenChange={setShowHttpRequestModal}
        onRequestCreated={refreshRequests}
      />
    </Page>
  )
}

interface RequestCardProps {
  request: AggregatedRequest
  busy: {
    searching: boolean
    reSearching: boolean
    cancelling: boolean
    deleting: boolean
    starting: boolean
  }
  onOpen: () => void
  onSearch: () => void
  onReSearch: () => void
  onStartDownload: () => void
  onEdit: () => void
  onCancel: () => void
  onDelete: () => void
  seasonBadges: React.ReactNode
}

function RequestCard({
  request,
  busy,
  onOpen,
  onSearch,
  onReSearch,
  onStartDownload,
  onEdit,
  onCancel,
  onDelete,
  seasonBadges,
}: RequestCardProps) {
  const tone = contentTypeTone(request.contentType)
  const status = normalizeStatus(request.status)

  const canCancel =
    request.type === 'torrent'
      ? ['PENDING', 'SEARCHING', 'DOWNLOADING'].includes(request.status)
      : ['PENDING_METADATA', 'METADATA_MATCHED', 'DOWNLOADING'].includes(request.status)

  const canDelete =
    request.type === 'torrent'
      ? ['FAILED', 'CANCELLED', 'EXPIRED', 'COMPLETED'].includes(request.status)
      : ['FAILED', 'CANCELLED', 'COMPLETED'].includes(request.status)

  const canSearch =
    request.type === 'torrent'
      ? ['PENDING', 'FAILED', 'EXPIRED'].includes(request.status)
      : request.status === 'PENDING_METADATA'

  const canReSearch = request.status === 'CANCELLED'
  const canEdit =
    request.type === 'torrent' &&
    ['PENDING', 'SEARCHING', 'FAILED', 'CANCELLED'].includes(request.status)
  const canStartDownload = request.type === 'http' && request.status === 'METADATA_MATCHED'

  const episodeLabel = [
    request.season ? `S${String(request.season).padStart(2, '0')}` : null,
    request.episode ? `E${String(request.episode).padStart(2, '0')}` : null,
  ]
    .filter(Boolean)
    .join('')

  return (
    <div style={{ width: CARD_WIDTH }} className="flex flex-col gap-2">
      <MediaCard
        width="100%"
        title={request.title || request.filename || 'Untitled request'}
        backdrop={request.backdropUrl || request.posterUrl}
        meta={[
          request.year ?? '—',
          tone.label,
          request.type === 'http' ? 'Direct URL' : 'Torrent',
          ...(episodeLabel ? [episodeLabel] : []),
        ]}
        subtitle={request.foundTorrentTitle || request.filename || request.url}
        status={<StatusBadge status={request.status} onArtwork size="sm" />}
        typeBadge={
          <Badge variant="glass" size="sm">
            {tone.short}
          </Badge>
        }
        stats={[
          `Priority ${request.priority}`,
          `Updated ${formatRelativeTime(request.updatedAt)}`,
        ]}
        onClick={onOpen}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={onOpen}>
              <ExternalLink className="h-3.5 w-3.5" />
              Details
            </Button>
            <div className="ml-auto">
              {/* Radix renders this in a portal, so it escapes the rail's
                  overflow and flips above the trigger when there's no room. */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label="Request actions">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" collisionPadding={12}>
                  {canSearch && (
                    <DropdownMenuItem onClick={onSearch} disabled={busy.searching}>
                      {busy.searching ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <SearchIcon className="h-3.5 w-3.5" />
                      )}
                      {busy.searching ? 'Searching…' : 'Search now'}
                    </DropdownMenuItem>
                  )}
                  {canReSearch && (
                    <DropdownMenuItem onClick={onReSearch} disabled={busy.reSearching}>
                      {busy.reSearching ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5" />
                      )}
                      {busy.reSearching ? 'Re-searching…' : 'Re-search'}
                    </DropdownMenuItem>
                  )}
                  {canStartDownload && (
                    <DropdownMenuItem onClick={onStartDownload} disabled={busy.starting}>
                      {busy.starting ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Download className="h-3.5 w-3.5" />
                      )}
                      {busy.starting ? 'Starting…' : 'Start download'}
                    </DropdownMenuItem>
                  )}
                  {canEdit && (
                    <DropdownMenuItem onClick={onEdit}>
                      <Edit className="h-3.5 w-3.5" />
                      Edit request
                    </DropdownMenuItem>
                  )}
                  {canCancel && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                          <XCircle className="h-3.5 w-3.5" />
                          Cancel request
                        </DropdownMenuItem>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Cancel request</AlertDialogTitle>
                          <AlertDialogDescription>
                            Cancel the download request for “{request.title}”? This cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Keep it</AlertDialogCancel>
                          <AlertDialogAction onClick={onCancel} disabled={busy.cancelling}>
                            {busy.cancelling ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Cancelling…
                              </>
                            ) : (
                              'Cancel request'
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
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete request
                        </DropdownMenuItem>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete request</AlertDialogTitle>
                          <AlertDialogDescription>
                            Permanently delete the request for{' '}
                            <span className="font-semibold text-fg-primary">
                              “{request.title}”
                              {request.year ? ` (${request.year})` : ''}
                              {request.season ? ` Season ${request.season}` : ''}
                              {request.episode ? ` Episode ${request.episode}` : ''}
                            </span>
                            ?{' '}
                            {status === 'DOWNLOADING' && (
                              <span className="font-medium text-status-failed">
                                This also stops the active download.{' '}
                              </span>
                            )}
                            This removes all associated data.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Keep it</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={onDelete}
                            disabled={busy.deleting}
                            className="bg-brand-400 text-fg-accent hover:bg-brand-300"
                          >
                            {busy.deleting ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Deleting…
                              </>
                            ) : (
                              'Delete request'
                            )}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </>
        }
      />
      {seasonBadges}
    </div>
  )
}
