import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Activity, Download, HardDrive, Play, Wifi, Info } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { HeroBanner } from '@/components/ds/HeroBanner'
import { MediaCard, MediaCardSkeleton } from '@/components/ds/MediaCard'
import { Page, PageSection, EmptyState } from '@/components/ds/Page'
import { Rail } from '@/components/ds/Rail'
import { StatTile } from '@/components/ds/StatTile'
import { StatusBadge } from '@/components/ds/StatusBadge'
import {
  useAggregatedRequests,
  useAria2Stats,
  useDownloads,
  useQueueStats,
  useVpnStatus,
} from '@/hooks/useApi'
import {
  contentTypeTone,
  formatEta,
  formatFileSize,
  formatPercent,
  formatSpeed,
  normalizeStatus,
} from '@/lib/status'
import type { DownloadJob } from '@/services/api'

const IN_FLIGHT_CARD_WIDTH = 340

function etaSeconds(download: DownloadJob): number | null {
  if (!download.downloadSpeed || download.downloadSpeed <= 0) return null
  return (download.totalSize - download.completedSize) / download.downloadSpeed
}

export default function Dashboard() {
  const navigate = useNavigate()

  const { data: queueStats, isLoading: queueLoading, error: queueError } = useQueueStats()
  const { data: vpnStatus, isLoading: vpnLoading, error: vpnError } = useVpnStatus()
  const { data: aria2Stats, isLoading: aria2Loading, error: aria2Error } = useAria2Stats()
  const { data: downloads, isLoading: downloadsLoading } = useDownloads()
  const { data: requestsPage } = useAggregatedRequests({
    limit: 12,
    sortBy: 'updatedAt',
    sortOrder: 'desc',
  })

  const inFlight = useMemo(
    () =>
      (downloads ?? []).filter((d) => {
        const status = normalizeStatus(d.status)
        return status === 'DOWNLOADING' || status === 'QUEUED' || status === 'PAUSED'
      }),
    [downloads]
  )

  // The hero features the most recently touched request that has artwork.
  const featured = useMemo(() => {
    const requests = requestsPage?.data ?? []
    return requests.find((r) => r.backdropUrl || r.posterUrl) ?? requests[0]
  }, [requestsPage])

  const speed = aria2Stats ? formatSpeed(parseInt(aria2Stats.downloadSpeed, 10)) : '0 MB/s'

  const vpnLabel = vpnStatus?.connected
    ? 'Connected'
    : vpnStatus?.containerRunning
      ? 'Container up'
      : vpnStatus?.enabled
        ? 'Disconnected'
        : 'Disabled'

  const vpnTone = vpnStatus?.connected
    ? 'var(--status-completed)'
    : vpnStatus?.enabled
      ? 'var(--status-failed)'
      : 'var(--status-idle)'

  return (
    <Page>
      {featured ? (
        <HeroBanner
          eyebrow="In your library"
          title={featured.title ?? featured.filename ?? 'Untitled request'}
          backdrop={featured.backdropUrl || featured.posterUrl}
          meta={[
            featured.year ?? '—',
            contentTypeTone(featured.contentType).label,
            featured.type === 'http' ? 'Direct URL' : 'Torrent',
          ]}
          badges={<StatusBadge status={featured.status} />}
          description={
            featured.foundTorrentTitle ??
            featured.filename ??
            'Downloadarr keeps searching your indexers until this one lands, then files it into your library.'
          }
          actions={
            <>
              <Button size="lg" onClick={() => navigate('/requests')}>
                <Play className="h-5 w-5" />
                Manage requests
              </Button>
              <Button size="lg" variant="glass" onClick={() => navigate('/downloads')}>
                <Info className="h-5 w-5" />
                View downloads
              </Button>
            </>
          }
        />
      ) : (
        <HeroBanner
          eyebrow="Dashboard"
          title="Nothing in flight"
          description="Request a movie, TV show or game and Downloadarr will search your indexers on a loop until it finds a match."
          actions={
            <>
              <Button size="lg" onClick={() => navigate('/search')}>
                <Play className="h-5 w-5" />
                Find something
              </Button>
              <Button size="lg" variant="glass" onClick={() => navigate('/movies')}>
                <Info className="h-5 w-5" />
                Browse movies
              </Button>
            </>
          }
        />
      )}

      <PageSection bleedRails>
        <div>
          <h1 className="text-3xl font-bold leading-tight tracking-tight text-fg-primary">Dashboard</h1>
          <p className="text-sm text-fg-secondary">Overview of your download system</p>
        </div>

        {/* Four stat tiles, each with its own loading and error state. */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Active downloads"
            icon={<Download className="h-4 w-4" />}
            value={aria2Stats?.numActive ?? queueStats?.active ?? 0}
            hint="Currently downloading"
            isLoading={queueLoading}
            isError={!!queueError}
          />
          <StatTile
            label="Queue size"
            icon={<Activity className="h-4 w-4" />}
            tone="var(--ink-300)"
            value={queueStats?.waiting ?? 0}
            hint="Pending downloads"
            isLoading={queueLoading}
            isError={!!queueError}
          />
          <StatTile
            label="Download speed"
            icon={<HardDrive className="h-4 w-4" />}
            tone="var(--ink-100)"
            value={speed}
            hint="Current speed"
            isLoading={aria2Loading}
            isError={!!aria2Error}
          />
          <StatTile
            label="VPN status"
            icon={<Wifi className="h-4 w-4" />}
            tone={vpnTone}
            word
            value={vpnLabel}
            hint={vpnStatus?.publicIP ? `IP ${vpnStatus.publicIP}` : vpnStatus?.message || 'Status unknown'}
            isLoading={vpnLoading}
            isError={!!vpnError}
          />
        </div>

        {/* In flight — a paged carousel, not a grid. */}
        <Rail
          title="In flight"
          count={inFlight.length || undefined}
          moreLabel="All downloads"
          onMore={() => navigate('/downloads')}
        >
          {downloadsLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <MediaCardSkeleton key={i} width={IN_FLIGHT_CARD_WIDTH} />
            ))
          ) : inFlight.length === 0 ? (
            <div style={{ width: '100%' }}>
              <EmptyState
                icon={<Download />}
                title="Nothing downloading right now"
                description="Requests move here the moment a torrent is picked up."
                action={
                  <Button variant="secondary" size="sm" onClick={() => navigate('/requests')}>
                    Open requests
                  </Button>
                }
              />
            </div>
          ) : (
            inFlight.map((download) => {
              const tone = contentTypeTone(download.mediaType)
              const eta = etaSeconds(download)
              return (
                <MediaCard
                  key={download.id}
                  width={IN_FLIGHT_CARD_WIDTH}
                  title={download.mediaTitle || download.name}
                  backdrop={download.mediaPoster}
                  meta={[download.mediaYear ?? '—', tone.label]}
                  subtitle={download.name}
                  status={<StatusBadge status={download.status} onArtwork size="sm" />}
                  typeBadge={
                    <Badge variant="glass" size="sm">
                      {tone.short}
                    </Badge>
                  }
                  progress={download.progress}
                  stats={[
                    formatPercent(download.progress),
                    `${formatFileSize(download.completedSize)} / ${formatFileSize(download.totalSize)}`,
                    formatSpeed(download.downloadSpeed),
                    `ETA ${eta == null ? '∞' : formatEta(eta)}`,
                  ]}
                  onClick={() => navigate('/downloads')}
                />
              )
            })
          )}
        </Rail>

        {/* System status */}
        <Card>
          <CardHeader>
            <CardTitle>System status</CardTitle>
            <CardDescription>Current download system overview</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <SystemRow
              label="Download queue"
              detail={
                queueLoading
                  ? 'Loading…'
                  : queueError
                    ? 'Failed to load queue status'
                    : `${queueStats?.active || 0} active, ${queueStats?.waiting || 0} waiting, ${queueStats?.completed || 0} completed`
              }
              status={queueError ? 'FAILED' : queueStats?.active ? 'DOWNLOADING' : 'PENDING'}
            />
            <SystemRow
              label={`VPN ${vpnStatus?.enabled ? 'connection' : '(disabled)'}`}
              detail={
                vpnLoading
                  ? 'Checking…'
                  : vpnError
                    ? 'Failed to check VPN status'
                    : vpnStatus?.message || 'Status unknown'
              }
              status={
                vpnError || (vpnStatus?.enabled && !vpnStatus?.connected)
                  ? 'FAILED'
                  : vpnStatus?.connected
                    ? 'COMPLETED'
                    : 'CANCELLED'
              }
            />
            <SystemRow
              label="Download engine"
              detail={
                aria2Loading
                  ? 'Connecting…'
                  : aria2Error
                    ? 'aria2 connection failed'
                    : `Connected — ${aria2Stats?.numActive || 0} active downloads`
              }
              status={aria2Error ? 'FAILED' : aria2Stats ? 'COMPLETED' : 'PENDING'}
            />
          </CardContent>
        </Card>
      </PageSection>
    </Page>
  )
}

function SystemRow({
  label,
  detail,
  status,
}: {
  label: string
  detail: string
  status: string
}) {
  return (
    <div className="flex items-center gap-4">
      <StatusBadge status={status} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-fg-primary">{label}</p>
        <p className="text-xs text-fg-muted">{detail}</p>
      </div>
      <span className="font-mono text-xs text-fg-muted">Live</span>
    </div>
  )
}
