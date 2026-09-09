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
import { apiService, SearchResult } from '@/services/api'
import { useTorrentRequests } from '@/hooks/useTorrentRequests'
import { useToast } from '@/hooks/use-toast'

type SearchTab = 'movies' | 'tv' | 'games'

const TABS: Array<{ id: SearchTab; label: string; noun: string; kind: 'movie' | 'tv' | 'game' }> = [
  { id: 'movies', label: 'Movies', noun: 'movies', kind: 'movie' },
  { id: 'tv', label: 'TV shows', noun: 'TV shows', kind: 'tv' },
  { id: 'games', label: 'Games', noun: 'games', kind: 'game' },
]

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState<SearchTab>('movies')
  const [searchQuery, setSearchQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedItem, setSelectedItem] = useState<SearchResult | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [requestItem, setRequestItem] = useState<SearchResult | null>(null)

  const { getRequestForItem, getRequestForShow, getRequestForGame } = useTorrentRequests()
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
        let response
        if (activeQuery) {
          response =
            activeTab === 'movies'
              ? await apiService.searchMovies(activeQuery)
              : activeTab === 'tv'
                ? await apiService.searchTvShows(activeQuery)
                : await apiService.searchGames(activeQuery)
        } else {
          response =
            activeTab === 'movies'
              ? await apiService.getPopularMovies(1)
              : activeTab === 'tv'
                ? await apiService.getPopularTvShows(1)
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
          description="Discover and download movies, TV shows and ROMs you own"
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
          <Rail title={activeQuery ? `Results for “${activeQuery}”` : `Popular ${tabConfig.noun}`}>
            {Array.from({ length: 8 }).map((_, i) => (
              <PosterCardSkeleton key={i} game={activeTab === 'games'} />
            ))}
          </Rail>
        ) : results.length === 0 ? (
          <EmptyState
            icon={<SearchIcon />}
            title={activeQuery ? `No results for “${activeQuery}”` : 'Nothing to show yet'}
            description={
              activeQuery
                ? 'Try a different spelling, or switch tabs to search another content type.'
                : 'Check your discovery API keys in Settings, then reload this page.'
            }
          />
        ) : (
          <Rail
            title={activeQuery ? `Results for “${activeQuery}”` : `Popular ${tabConfig.noun}`}
            count={results.length}
          >
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
