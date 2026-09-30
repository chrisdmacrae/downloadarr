import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AlertCircle, Loader2, Search as SearchIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EmptyState, Page, PageHeader, PageSection } from '@/components/ds/Page'
import { PosterCard, PosterCardSkeleton } from '@/components/ds/PosterCard'
import { Rail } from '@/components/ds/Rail'
import { StatusBadge } from '@/components/ds/StatusBadge'
import { posterDetails } from '@/components/discovery/DiscoveryScreen'
import { MovieDetailModal } from '@/components/MovieDetailModal'
import { GameDetailModal } from '@/components/GameDetailModal'
import { DownloadRequestModal } from '@/components/DownloadRequestModal'
import { AlbumCard, AlbumCardSkeleton } from '@/components/music/AlbumCard'
import { PreviewPlayerProvider } from '@/components/music/PreviewPlayer'
import { apiService, SearchResult } from '@/services/api'
import { musicApi, type MusicSearchAlbum } from '@/services/music'
import { useTorrentRequests } from '@/hooks/useTorrentRequests'
import { useToast } from '@/hooks/use-toast'

type SearchTab = 'movies' | 'tv' | 'anime' | 'games' | 'music'

const TABS: Array<{ id: SearchTab; label: string; noun: string; kind: 'movie' | 'tv' | 'game' | 'music' }> = [
  { id: 'movies', label: 'Movies', noun: 'movies', kind: 'movie' },
  // TV excludes anime and anime excludes everything else, so the two tabs
  // never return the same title.
  { id: 'tv', label: 'TV shows', noun: 'TV shows', kind: 'tv' },
  { id: 'anime', label: 'Anime', noun: 'anime', kind: 'tv' },
  { id: 'games', label: 'Games', noun: 'games', kind: 'game' },
  { id: 'music', label: 'Music', noun: 'albums', kind: 'music' },
]

type DiscoveryResponse = { success: boolean; data?: SearchResult[]; error?: string }

/**
 * The anime tab spans both content types, so series and films are fetched
 * together and interleaved. Each item keeps its own `type`, which is what the
 * cards and detail modals key off.
 */
function mergeAnime(series: DiscoveryResponse, films: DiscoveryResponse): DiscoveryResponse {
  if (!series.success && !films.success) {
    return { success: false, error: series.error || films.error }
  }

  const merged: SearchResult[] = []
  const seriesItems = series.data ?? []
  const filmItems = films.data ?? []

  for (let i = 0; i < Math.max(seriesItems.length, filmItems.length); i++) {
    if (seriesItems[i]) merged.push(seriesItems[i])
    if (filmItems[i]) merged.push(filmItems[i])
  }

  return { success: true, data: merged }
}

async function searchAllAnime(query: string): Promise<DiscoveryResponse> {
  const [series, films] = await Promise.all([
    apiService.searchAnime(query),
    apiService.searchAnimeMovies(query),
  ])
  return mergeAnime(series, films)
}

async function popularAllAnime(): Promise<DiscoveryResponse> {
  const [series, films] = await Promise.all([
    apiService.getPopularAnime(1),
    apiService.getPopularAnimeMovies(1),
  ])
  return mergeAnime(series, films)
}

const RECORD_TYPES: Record<string, string> = { ep: 'EP', single: 'Single', compile: 'Compilation' }

/** Flags anything that isn't a studio album, the year, and albums only Spotify has. */
function albumCaption(album: MusicSearchAlbum) {
  const parts = [
    album.recordType && RECORD_TYPES[album.recordType],
    album.releaseDate?.slice(0, 4),
    album.source === 'spotify' && 'From Spotify',
  ]
  return parts.filter(Boolean).join(' · ') || undefined
}

export default function Search() {
  // Music results play previews through the docked player.
  return (
    <PreviewPlayerProvider>
      <SearchContent />
    </PreviewPlayerProvider>
  )
}

function SearchContent() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState<SearchTab>('movies')
  const [searchQuery, setSearchQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [albums, setAlbums] = useState<MusicSearchAlbum[]>([])
  const [requestingAlbum, setRequestingAlbum] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedItem, setSelectedItem] = useState<SearchResult | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [requestItem, setRequestItem] = useState<SearchResult | null>(null)

  const { getRequestForItem, getRequestForShow, getRequestForGame, getRequestForAlbum, refreshRequests } =
    useTorrentRequests()
  const { toast } = useToast()

  const tabConfig = TABS.find((t) => t.id === activeTab)!
  const activeQuery = searchParams.get('q')?.trim() || ''

  // Initialize from URL parameters.
  useEffect(() => {
    const query = searchParams.get('q')
    const tab = searchParams.get('tab') as SearchTab | null
    if (query) setSearchQuery(query)
    if (tab && TABS.some((t) => t.id === tab)) setActiveTab(tab)
  }, [searchParams])

  // A query searches; no query shows the tab's popular content.
  useEffect(() => {
    let cancelled = false

    const run = async () => {
      setIsLoading(true)
      setError(null)
      try {
        // Albums aren't SearchResults: they come from Deezer, not the discovery APIs.
        if (activeTab === 'music') {
          const found = activeQuery ? await musicApi.searchAlbums(activeQuery) : await musicApi.getChartAlbums()
          if (cancelled) return
          setAlbums(found)
          if (activeQuery && found.length === 0) {
            toast({ title: 'No results found', description: `No albums found for “${activeQuery}”.` })
          }
          return
        }

        let response
        if (activeQuery) {
          response =
            activeTab === 'movies'
              ? await apiService.searchMovies(activeQuery)
              : activeTab === 'tv'
                ? await apiService.searchTvShows(activeQuery)
                : activeTab === 'anime'
                  ? await searchAllAnime(activeQuery)
                  : await apiService.searchGames(activeQuery)
        } else {
          response =
            activeTab === 'movies'
              ? await apiService.getPopularMovies(1)
              : activeTab === 'tv'
                ? await apiService.getPopularTvShows(1)
                : activeTab === 'anime'
                  ? await popularAllAnime()
                  : await apiService.getPopularGames(20)
        }

        if (cancelled) return

        if (response.success && response.data) {
          setResults(response.data)
          if (activeQuery && response.data.length === 0) {
            toast({
              title: 'No results found',
              description: `No ${tabConfig.noun} found for “${activeQuery}”.`,
            })
          }
        } else {
          setError(response.error || (activeQuery ? 'Search failed' : 'Failed to load content'))
        }
      } catch (err) {
        if (cancelled) return
        console.error('Search error:', err)
        setError(activeQuery ? 'Search failed' : 'Failed to load content')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeQuery, activeTab])

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = searchQuery.trim()
    if (!trimmed) {
      toast({ title: 'Search query required', description: 'Enter a search term to continue.' })
      return
    }
    const next = new URLSearchParams(searchParams)
    next.set('q', trimmed)
    next.set('tab', activeTab)
    setSearchParams(next)
  }

  const changeTab = (tab: SearchTab) => {
    setActiveTab(tab)
    const next = new URLSearchParams(searchParams)
    if (searchQuery.trim()) next.set('q', searchQuery.trim())
    next.set('tab', tab)
    setSearchParams(next)
  }

  const requestAlbum = async (album: MusicSearchAlbum) => {
    setRequestingAlbum(album.id)
    try {
      await apiService.requestMusicDownload({
        title: album.albumTitle,
        artist: album.artistName,
        year: album.releaseDate ? Number(album.releaseDate.slice(0, 4)) || undefined : undefined,
        posterUrl: album.coverUrl,
      })
      toast({ title: 'Album requested', description: `${album.albumTitle} by ${album.artistName}` })
      refreshRequests()
    } catch (err: any) {
      toast({
        title: 'Couldn’t request album',
        description: err?.response?.data?.message ?? err?.message,
        variant: 'destructive',
      })
    } finally {
      setRequestingAlbum(null)
    }
  }

  const railTitle = activeQuery
    ? `Results for “${activeQuery}”`
    : activeTab === 'music'
      ? 'Top albums on Deezer'
      : `Popular ${tabConfig.noun}`
  const resultCount = activeTab === 'music' ? albums.length : results.length

  const requestFor = (item: SearchResult) => {
    if (item.type === 'tv') return getRequestForShow(item.title, item.year)
    if (item.type === 'game') return getRequestForGame(item.title, item.year)
    return getRequestForItem(item.title, item.year, undefined, undefined, 'MOVIE')
  }

  return (
    <Page className="pt-8">
      <PageSection bleedRails className="gap-6">
        <PageHeader
          eyebrow="Find"
          title="Search"
          description="Discover and download movies, TV shows, music and ROMs you own"
        />

        <form onSubmit={submitSearch} className="flex max-w-2xl gap-2">
          <div className="relative flex-1">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search for ${tabConfig.noun}…`}
              className="pl-10"
            />
          </div>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
          </Button>
        </form>

        <Tabs value={activeTab} onValueChange={(value) => changeTab(value as SearchTab)}>
          <TabsList>
            {TABS.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {error ? (
          <EmptyState icon={<AlertCircle />} title="Search unavailable" description={error} />
        ) : isLoading ? (
          <Rail title={railTitle}>
            {Array.from({ length: 8 }).map((_, i) =>
              activeTab === 'music' ? (
                <AlbumCardSkeleton key={i} />
              ) : (
                <PosterCardSkeleton key={i} game={activeTab === 'games'} />
              )
            )}
          </Rail>
        ) : resultCount === 0 ? (
          <EmptyState
            icon={<SearchIcon />}
            title={activeQuery ? `No results for “${activeQuery}”` : 'Nothing to show yet'}
            description={
              activeQuery
                ? 'Try a different spelling, or switch tabs to search another content type.'
                : activeTab === 'music'
                  ? 'Deezer’s charts didn’t load. Reload this page to try again.'
                  : 'Check your discovery API keys in Settings, then reload this page.'
            }
          />
        ) : activeTab === 'music' ? (
          <Rail title={railTitle} count={albums.length}>
            {albums.map((album) => (
              <AlbumCard
                key={album.id}
                album={album}
                caption={albumCaption(album)}
                request={getRequestForAlbum(album.artistName, album.albumTitle)}
                onRequest={() => requestAlbum(album)}
                requesting={requestingAlbum === album.id}
              />
            ))}
          </Rail>
        ) : (
          <Rail title={railTitle} count={results.length}>
            {results.map((item, index) => {
              const request = requestFor(item)
              return (
                <PosterCard
                  key={item.id}
                  title={item.title}
                  type={item.type}
                  poster={item.poster}
                  year={item.year}
                  details={posterDetails(item)}
                  anchor={index === 0 ? 'start' : index === results.length - 1 ? 'end' : 'center'}
                  status={
                    request ? <StatusBadge status={request.status} onArtwork size="sm" /> : undefined
                  }
                  onClick={() => {
                    setSelectedItem(item)
                    setShowDetailModal(true)
                  }}
                  actions={
                    <>
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (item.type === 'game') {
                            setSelectedItem(item)
                            setShowDetailModal(true)
                          } else {
                            setRequestItem(item)
                          }
                        }}
                      >
                        {item.type === 'game' ? 'View details' : 'Request'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedItem(item)
                          setShowDetailModal(true)
                        }}
                      >
                        Details
                      </Button>
                    </>
                  }
                />
              )
            })}
          </Rail>
        )}

        {/* Room for the preview player docked at the bottom. */}
        {activeTab === 'music' && <div aria-hidden className="h-20" />}
      </PageSection>

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

      <DownloadRequestModal
        item={requestItem}
        open={!!requestItem}
        onOpenChange={(open) => !open && setRequestItem(null)}
      />
    </Page>
  )
}
