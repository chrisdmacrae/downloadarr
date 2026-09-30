import { useNavigate } from 'react-router-dom'
import { Loader2, Music, RefreshCw, Settings as SettingsIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { EmptyState, Page, PageHeader, PageSection } from '@/components/ds/Page'
import { Rail } from '@/components/ds/Rail'
import { AlbumCard, AlbumCardSkeleton } from '@/components/music/AlbumCard'
import { PreviewPlayerProvider } from '@/components/music/PreviewPlayer'
import { useToast } from '@/hooks/use-toast'
import {
  useDismissMusic,
  useMusicDiscover,
  useMusicSources,
  useMusicSyncStatus,
  useStartMusicSync,
} from '@/hooks/useMusic'
import type { MusicList, MusicRecommendation } from '@/services/music'

const RAILS: Array<{ list: MusicList; title: string; caption: (album: MusicRecommendation) => string | undefined }> = [
  {
    list: 'NEW_ARTISTS',
    title: 'New artists for you',
    caption: (album) => (album.reasons.length ? `Because you listen to ${joinNames(album.reasons)}` : undefined),
  },
  {
    list: 'FRESH_RELEASES',
    title: 'New from artists you love',
    caption: (album) => (album.releaseDate ? `Released ${formatDate(album.releaseDate)}` : undefined),
  },
  {
    list: 'WEEKLY_PICKS',
    title: 'Your weekly exploration',
    caption: () => 'From ListenBrainz',
  },
  {
    list: 'FLOW',
    title: 'From your Deezer Flow',
    caption: () => 'From Deezer',
  },
  {
    list: 'MOST_PLAYED',
    title: 'Your most played albums',
    caption: (album) => (album.sources.length === 1 && album.sources[0] === 'deezer' ? 'Deezer charts' : 'Past year'),
  },
  {
    list: 'SAVED_ALBUMS',
    title: 'Saved on Deezer',
    caption: (album) => (album.releaseDate ? album.releaseDate.slice(0, 4) : undefined),
  },
]

function joinNames(names: string[]) {
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

function formatDate(isoDate: string) {
  const date = new Date(`${isoDate}T00:00:00`)
  return Number.isNaN(date.getTime())
    ? isoDate
    : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatAgo(iso: string | null | undefined) {
  if (!iso) return null
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  return hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`
}

export default function MusicDiscovery() {
  return (
    <PreviewPlayerProvider>
      <MusicDiscoveryContent />
    </PreviewPlayerProvider>
  )
}

function MusicDiscoveryContent() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { data: sources, isLoading: sourcesLoading } = useMusicSources()
  const { data: discover, isLoading: discoverLoading } = useMusicDiscover()
  const { data: syncStatus } = useMusicSyncStatus()
  const startSync = useStartMusicSync()
  const dismiss = useDismissMusic()

  const syncing = Boolean(syncStatus?.running) || startSync.isPending
  const connected = (sources ?? []).filter((s) => s.enabled)
  const lastSynced = connected
    .map((s) => s.lastSyncedAt)
    .filter(Boolean)
    .sort()
    .pop()
  const hasAny = RAILS.some(({ list }) => (discover?.lists[list]?.length ?? 0) > 0)

  const onDismiss = (album: MusicRecommendation, scope: 'album' | 'artist') => {
    dismiss.mutate(
      { artistName: album.artistName, albumTitle: scope === 'album' ? album.albumTitle : undefined },
      {
        onSuccess: () =>
          toast({
            title: scope === 'album' ? 'Album hidden' : `${album.artistName} hidden`,
            description: 'Undo this in Settings › Music.',
          }),
      }
    )
  }

  const header = (
    <PageHeader
      eyebrow="Find"
      title="Discover music"
      description={
        discover?.topArtists.length
          ? `Built from your listening to ${joinNames(discover.topArtists.slice(0, 4).map((a) => a.name))} and more`
          : 'Recommendations built from your ListenBrainz, Last.fm and Deezer listening'
      }
      actions={
        connected.length > 0 && (
          <>
            {lastSynced && !syncing && (
              <span className="font-mono text-xs text-fg-muted">Updated {formatAgo(lastSynced)}</span>
            )}
            <Button variant="outline" size="sm" disabled={syncing} onClick={() => startSync.mutate()}>
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {syncing ? 'Updating…' : 'Refresh'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate('/settings/music')}>
              <SettingsIcon className="h-4 w-4" />
              Sources
            </Button>
          </>
        )
      }
    />
  )

  if (sourcesLoading || discoverLoading) {
    return (
      <Page className="pt-8">
        <PageSection bleedRails>
          {header}
          <SkeletonRails />
        </PageSection>
      </Page>
    )
  }

  return (
    <Page className="pt-8">
      <PageSection bleedRails>
        {header}

        {connected.length === 0 ? (
          <EmptyState
            icon={<Music />}
            title="Connect your listening history"
            description="Connect ListenBrainz, Last.fm or a public Deezer profile and Downloadarr will recommend new artists and albums based on what you play."
            action={<Button onClick={() => navigate('/settings/music')}>Connect a source</Button>}
          />
        ) : !hasAny && syncing ? (
          <>
            <p className="text-sm text-fg-secondary">
              Reading your listening history and finding similar artists. The first run takes a minute or two.
            </p>
            <SkeletonRails />
          </>
        ) : !hasAny ? (
          <EmptyState
            icon={<Music />}
            title="No recommendations yet"
            description={
              syncStatus?.error ??
              connected.find((s) => s.lastSyncError)?.lastSyncError ??
              'Refresh to build recommendations from your listening history.'
            }
            action={
              <Button onClick={() => startSync.mutate()} disabled={syncing}>
                Refresh
              </Button>
            }
          />
        ) : (
          RAILS.map(({ list, title, caption }) => {
            const albums = discover?.lists[list] ?? []
            if (albums.length === 0) return null
            return (
              <Rail key={list} title={title} count={albums.length}>
                {albums.map((album) => (
                  <AlbumCard
                    key={album.id}
                    album={album}
                    caption={caption(album)}
                    onDismiss={(scope) => onDismiss(album, scope)}
                  />
                ))}
              </Rail>
            )
          })
        )}

        {/* Room for the preview player docked at the bottom. */}
        <div aria-hidden className="h-20" />
      </PageSection>
    </Page>
  )
}

function SkeletonRails() {
  return (
    <>
      {Array.from({ length: 3 }).map((_, i) => (
        <Rail key={i} title="Loading">
          {Array.from({ length: 8 }).map((_, j) => (
            <AlbumCardSkeleton key={j} />
          ))}
        </Rail>
      ))}
    </>
  )
}
