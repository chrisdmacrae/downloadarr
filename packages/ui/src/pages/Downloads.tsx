import { useMemo, useState } from 'react'
import { AlertCircle, Download as DownloadIcon, Loader2, Pause, Play, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MediaCard, MediaCardSkeleton } from '@/components/ds/MediaCard'
import { EmptyState, Page, PageHeader, PageSection } from '@/components/ds/Page'
import { Rail } from '@/components/ds/Rail'
import { StatusBadge } from '@/components/ds/StatusBadge'
import {
  useCancelDownload,
  useDownloads,
  usePauseDownload,
  useResumeDownload,
} from '@/hooks/useApi'
import { useToast } from '@/hooks/use-toast'
import {
  contentTypeTone,
  formatEta,
  formatFileSize,
  formatPercent,
  formatSpeed,
  normalizeStatus,
  type StatusKey,
} from '@/lib/status'
import type { DownloadJob } from '@/services/api'

const CARD_WIDTH = 340

type TabId = 'active' | 'queued' | 'paused' | 'completed' | 'failed' | 'all'

const TABS: Array<{ id: TabId; label: string; match: (s: StatusKey) => boolean }> = [
  { id: 'active', label: 'Active', match: (s) => s === 'DOWNLOADING' },
  { id: 'queued', label: 'Queued', match: (s) => s === 'QUEUED' },
  { id: 'paused', label: 'Paused', match: (s) => s === 'PAUSED' },
  { id: 'completed', label: 'Completed', match: (s) => s === 'COMPLETED' },
  { id: 'failed', label: 'Failed', match: (s) => s === 'FAILED' || s === 'CANCELLED' },
  { id: 'all', label: 'All', match: () => true },
]

function etaFor(download: DownloadJob): string {
  const status = normalizeStatus(download.status)
  if (status === 'COMPLETED') return 'Complete'
  if (status === 'QUEUED') return 'Queued'
  if (status === 'PAUSED') return 'Paused'
  if (status === 'FAILED') return 'Error'
  if (!download.downloadSpeed || download.downloadSpeed <= 0) return 'Calculating…'
  return formatEta((download.totalSize - download.completedSize) / download.downloadSpeed)
}

export default function Downloads() {
  const { data: downloads, isLoading, error } = useDownloads()
  const { toast } = useToast()
  const [tab, setTab] = useState<TabId>('active')

  const pauseDownload = usePauseDownload()
  const resumeDownload = useResumeDownload()
  const cancelDownload = useCancelDownload()

  const handlePause = async (id: string) => {
    try {
      await pauseDownload.mutateAsync(id)
      toast({ title: 'Download paused', description: 'The download has been paused successfully.' })
    } catch {
      toast({
        title: 'Failed to pause',
        description: 'Could not pause the download. Please try again.',
        variant: 'destructive',
      })
    }
  }

  const handleResume = async (id: string) => {
    try {
      await resumeDownload.mutateAsync(id)
      toast({ title: 'Download resumed', description: 'The download has been resumed successfully.' })
    } catch {
      toast({
        title: 'Failed to resume',
        description: 'Could not resume the download. Please try again.',
        variant: 'destructive',
      })
    }
  }

  const handleCancel = async (id: string) => {
    try {
      await cancelDownload.mutateAsync(id)
      toast({ title: 'Download cancelled', description: 'The download has been cancelled successfully.' })
    } catch {
      toast({
        title: 'Failed to cancel',
        description: 'Could not cancel the download. Please try again.',
        variant: 'destructive',
      })
    }
  }

  const counts = useMemo(() => {
    const result = {} as Record<TabId, number>
    for (const t of TABS) {
      result[t.id] = (downloads ?? []).filter((d) => t.match(normalizeStatus(d.status))).length
    }
    return result
  }, [downloads])

  const visible = useMemo(() => {
    const matcher = TABS.find((t) => t.id === tab)!
    return (downloads ?? []).filter((d) => matcher.match(normalizeStatus(d.status)))
  }, [downloads, tab])

  if (error) {
    return (
      <Page>
        <PageSection>
          <PageHeader title="Downloads" description="Manage your active and queued downloads" />
          <Card>
            <CardContent className="flex items-center gap-3 p-6">
              <AlertCircle className="h-5 w-5 shrink-0 text-status-failed" />
              <p className="text-sm text-fg-secondary">
                Failed to load downloads. Please check if the download service is running.
              </p>
            </CardContent>
          </Card>
        </PageSection>
      </Page>
    )
  }

  return (
    <Page className="pt-8">
      <PageSection bleedRails>
        <PageHeader
          eyebrow="Transfers"
          title="Downloads"
          description="Manage your active and queued downloads"
        />

        <Tabs value={tab} onValueChange={(value) => setTab(value as TabId)}>
          <TabsList className="w-full justify-start overflow-x-auto scrollbar-hide">
            {TABS.map((t) => (
              <TabsTrigger key={t.id} value={t.id}>
                {t.label}
                <span className="font-mono text-2xs font-medium text-fg-muted">{counts[t.id] ?? 0}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Each tab is a paged carousel, not a grid. */}
        <Rail count={visible.length || undefined}>
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <MediaCardSkeleton key={i} width={CARD_WIDTH} />)
          ) : visible.length === 0 ? (
            <div style={{ width: '100%' }}>
              <EmptyState
                icon={<DownloadIcon />}
                title="No downloads found"
                description="Start downloading something to see it here."
              />
            </div>
          ) : (
            visible.map((download) => {
              const status = normalizeStatus(download.status)
              const tone = contentTypeTone(download.mediaType)
              const busy =
                pauseDownload.isPending || resumeDownload.isPending || cancelDownload.isPending

              return (
                <MediaCard
                  key={download.id}
                  width={CARD_WIDTH}
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
                    `ETA ${etaFor(download)}`,
                    `${download.files.length} files`,
                  ]}
                  actions={
                    <>
                      {status === 'DOWNLOADING' && (
                        <Button
                          variant="glass"
                          size="sm"
                          disabled={busy}
                          onClick={(e) => {
                            e.stopPropagation()
                            handlePause(download.id)
                          }}
                        >
                          {pauseDownload.isPending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Pause className="h-3.5 w-3.5" />
                          )}
                          Pause
                        </Button>
                      )}
                      {status === 'PAUSED' && (
                        <Button
                          variant="glass"
                          size="sm"
                          disabled={busy}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleResume(download.id)
                          }}
                        >
                          {resumeDownload.isPending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Play className="h-3.5 w-3.5" />
                          )}
                          Resume
                        </Button>
                      )}
                      <Button
                        variant="glass"
                        size="sm"
                        disabled={busy}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleCancel(download.id)
                        }}
                      >
                        {cancelDownload.isPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <X className="h-3.5 w-3.5" />
                        )}
                        Cancel
                      </Button>
                    </>
                  }
                />
              )
            })
          )}
        </Rail>
      </PageSection>
    </Page>
  )
}
