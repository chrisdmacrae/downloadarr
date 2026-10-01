import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { AlertCircle, ChevronLeft, Loader2, Search as SearchIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EmptyState, Page, PageHeader, PageSection } from '@/components/ds/Page'
import { PosterCard, PosterCardSkeleton, type PosterSize } from '@/components/ds/PosterCard'
import { StatusBadge } from '@/components/ds/StatusBadge'
import { NavPill } from '@/components/ds/TopNav'
import { useSubnav } from '@/components/ds/Subnav'
import { posterDetails } from '@/components/discovery/DiscoveryScreen'
import { MovieDetailModal } from '@/components/MovieDetailModal'
import { GameDetailModal } from '@/components/GameDetailModal'
import { DownloadRequestModal } from '@/components/DownloadRequestModal'
import { apiService, type GameDiscoverSort, type SearchResult } from '@/services/api'
import { useTorrentRequests } from '@/hooks/useTorrentRequests'

type BrowseKind = 'movie' | 'tv' | 'game'

const KINDS = {
  movie: {
    label: 'Movies',
    noun: 'movies',
    home: '/movies',
    source: 'TMDB key',
    genres: apiService.getMovieGenres,
    earliestDecade: 1950,
  },
  tv: {
    label: 'TV shows',
    noun: 'TV shows',
    home: '/tv-shows',
    source: 'TMDB key',
    genres: apiService.getTvGenres,
    earliestDecade: 1950,
  },
  game: {
    label: 'Games',
    noun: 'games',
    home: '/games',
    source: 'IGDB keys',
    genres: apiService.getGameGenres,
    earliestDecade: 1980,
  },
} as const

const SORTS: Array<{ id: GameDiscoverSort; label: string; gamesOnly?: boolean }> = [
  { id: 'popular', label: 'Most popular' },
  { id: 'top_rated', label: 'Top rated' },
  { id: 'newest', label: 'Newest first' },
  { id: 'oldest', label: 'Oldest first' },
  // The one order that includes games nobody has rated.
  { id: 'title', label: 'A to Z', gamesOnly: true },
]

interface Decade {
  id: string
  label: string
  /** Shown after the count: "1,204 movies from the 1980s". */
  phrase: string
  from?: number
  to?: number
}

/** This decade back to the earliest worth its own pill, then everything older as one bucket. */
function buildDecades(earliest: number): Decade[] {
  const decades: Decade[] = []
  const current = Math.floor(new Date().getFullYear() / 10) * 10
  for (let start = current; start >= earliest; start -= 10) {
    decades.push({
      id: String(start),
      label: `${start}s`,
      phrase: `from the ${start}s`,
      from: start,
      to: start + 9,
    })
  }
  decades.push({
    id: 'earlier',
    label: `Before ${earliest}`,
    phrase: `from before ${earliest}`,
    to: earliest - 1,
  })
  return decades
}

/** A listing is served 500 pages deep and no further. */
const PAGE_LIMIT = 500

/**
 * Everything in a genre, as a wall of posters that keeps loading as it
 * scrolls. Genre, decade and order live in the URL, so a view can be linked
 * and survives a reload. Each decade is its own listing, which is what reaches
 * older titles the all-time popularity order never gets to.
 *
 * Games add a platform: it takes the top nav's pills, and genres move into
 * the page.
 */
export default function Browse({ kind }: { kind: BrowseKind }) {
  const config = KINDS[kind]
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const decades = useMemo(() => buildDecades(config.earliestDecade), [config.earliestDecade])
  const sorts = SORTS.filter((s) => kind === 'game' || !s.gamesOnly)

  const genreParam = Number(searchParams.get('genre'))
  const genreId = Number.isInteger(genreParam) && genreParam > 0 ? genreParam : undefined
  const decade = decades.find((d) => d.id === searchParams.get('decade'))
  const sort = sorts.find((s) => s.id === searchParams.get('sort'))?.id ?? 'popular'
  const platform = (kind === 'game' && searchParams.get('platform')) || undefined

  const [selected, setSelected] = useState<{ id: string; title: string } | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [requestItem, setRequestItem] = useState<SearchResult | null>(null)
  const { getRequestForItem, getRequestForShow, getRequestForGame } = useTorrentRequests()

  const setFilter = (name: 'genre' | 'platform' | 'decade' | 'sort', value?: string) => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(name, value)
    else next.delete(name)
    // Filters replace rather than push, so Back leaves the listing.
    setSearchParams(next, { replace: true })
  }

  const { data: genres = [] } = useQuery({
    queryKey: ['discover-genres', kind],
    queryFn: async () => (await config.genres()).data ?? [],
    staleTime: Infinity,
  })
  const genre = genres.find((g) => g.id === genreId)

  const { data: platforms = [] } = useQuery({
    queryKey: ['discover-platforms'],
    queryFn: async () => [
      'PC',
      ...((await apiService.getSupportedPlatforms()).data ?? []).map((p) => p.name),
    ],
    staleTime: Infinity,
    enabled: kind === 'game',
  })

  const listing = useInfiniteQuery({
    queryKey: ['discover', kind, platform ?? null, genreId ?? null, decade?.id ?? null, sort],
    queryFn: async ({ pageParam }) => {
      const range = { genreId, yearFrom: decade?.from, yearTo: decade?.to, page: pageParam }
      const response =
        kind === 'game'
          ? await apiService.discoverGames({ ...range, platform, sort })
          : // `sort` is narrowed to the shared orders above for movies and TV.
            await (kind === 'movie' ? apiService.discoverMovies : apiService.discoverTvShows)({
              ...range,
              sort: sort === 'title' ? 'popular' : sort,
            })
      if (!response.success) throw new Error(response.error || `Failed to load ${config.noun}`)
      return response
    },
    initialPageParam: 1,
    getNextPageParam: (last) => {
      const page = last.page ?? 1
      return page < (last.totalPages ?? 1) ? page + 1 : undefined
    },
    staleTime: 5 * 60_000,
  })
  const { hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage } = listing
  const pageCount = listing.data?.pages.length ?? 0

  // Popularity shifts between page requests, so a title can turn up twice.
  const items = useMemo(() => {
    const seen = new Set<string>()
    return (listing.data?.pages ?? [])
      .flatMap((page) => page.data ?? [])
      .filter((item) => (seen.has(item.id) ? false : (seen.add(item.id), true)))
  }, [listing.data])

  const firstPage = listing.data?.pages[0]
  const totalResults = firstPage?.totalResults
  const truncated = (firstPage?.totalPages ?? 0) >= PAGE_LIMIT

  // A new listing starts at the top.
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [kind, platform, genreId, decade?.id, sort])

  // The grid's column count decides which way edge cards expand on hover, and
  // a narrow screen drops to small posters so it still shows two across.
  const gridRef = useRef<HTMLDivElement>(null)
  const [layout, setLayout] = useState<{ size: PosterSize; columns: number }>({ size: 'md', columns: 1 })

  useEffect(() => {
    const grid = gridRef.current
    if (!grid) return

    const measure = () => {
      const styles = getComputedStyle(grid)
      const gap = parseFloat(styles.columnGap) || 0
      const width = grid.clientWidth
      const medium = parseFloat(styles.getPropertyValue('--poster-w-md'))
      const size: PosterSize = width < medium * 2 + gap ? 'sm' : 'md'
      const card = size === 'md' ? medium : parseFloat(styles.getPropertyValue('--poster-w-sm'))
      const columns = Math.max(1, Math.floor((width + gap) / (card + gap)))
      setLayout((current) =>
        current.size === size && current.columns === columns ? current : { size, columns }
      )
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(grid)
    return () => observer.disconnect()
  }, [])

  // Load the next page as the end of the grid nears. The observer is rebuilt
  // after each page so a short page (anime is filtered out) that leaves the
  // sentinel in view still triggers the following one.
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !hasNextPage || isFetchingNextPage || isFetchNextPageError) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) fetchNextPage()
      },
      { rootMargin: '1200px 0px' }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage, pageCount])

  // The games screen is split into PC and ROM tabs; go back to the right one.
  const home = kind === 'game' && platform && platform !== 'PC' ? `${config.home}?tab=rom` : config.home

  const genrePills = (allLabel: string) => (
    <>
      <NavPill active={!genreId} onClick={() => setFilter('genre')}>
        {allLabel}
      </NavPill>
      {genres.map((g) => (
        <NavPill key={g.id} active={g.id === genreId} onClick={() => setFilter('genre', String(g.id))}>
          {g.name}
        </NavPill>
      ))}
    </>
  )

  useSubnav(
    <>
      <NavPill onClick={() => navigate(home)}>
        <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2.5} />
        {config.label}
      </NavPill>
      <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-[color:var(--border-hairline)]" />
      {kind === 'game' ? (
        <>
          <NavPill active={!platform} onClick={() => setFilter('platform')}>
            All
          </NavPill>
          {platforms.map((name) => (
            <NavPill key={name} active={name === platform} onClick={() => setFilter('platform', name)}>
              {name}
            </NavPill>
          ))}
        </>
      ) : (
        genrePills('All')
      )}
    </>,
    [genres, genreId, platforms, platform, searchParams, kind, home]
  )

  const requestFor = (item: SearchResult) =>
    kind === 'tv'
      ? getRequestForShow(item.title, item.year)
      : kind === 'game'
        ? getRequestForGame(item.title, item.year)
        : getRequestForItem(item.title, item.year, undefined, undefined, 'MOVIE')

  const openDetails = (item: SearchResult) => {
    setSelected({ id: item.id, title: item.title })
    setIsModalOpen(true)
  }

  const title =
    genre && platform
      ? `${platform} · ${genre.name}`
      : genre
        ? genre.name
        : platform
          ? `${platform} games`
          : genreId
            ? config.label
            : `All ${config.noun}`
  const description =
    totalResults != null
      ? `${totalResults.toLocaleString()} ${config.noun}${decade ? ` ${decade.phrase}` : ''}`
      : `Every ${genre ? `${genre.name.toLowerCase()} title` : 'title'}${decade ? ` ${decade.phrase}` : ''}`

  const skeletons = (count: number) =>
    Array.from({ length: count }, (_, i) => (
      <PosterCardSkeleton key={`skeleton-${i}`} size={layout.size} game={kind === 'game'} />
    ))

  return (
    <Page className="pt-8">
      <PageSection className="gap-6">
        <PageHeader
          eyebrow={
            <Link to={home} className="hover:text-brand-400">
              {config.label}
            </Link>
          }
          title={title}
          description={description}
          actions={
            <Select value={sort} onValueChange={(value) => setFilter('sort', value === 'popular' ? undefined : value)}>
              <SelectTrigger className="w-44" aria-label="Sort order">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sorts.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        />

        {kind === 'game' && (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Genre">
            {genrePills('All genres')}
          </div>
        )}

        <div className="flex flex-wrap gap-2" role="group" aria-label="Decade">
          <NavPill active={!decade} onClick={() => setFilter('decade')}>
            Any time
          </NavPill>
          {decades.map((d) => (
            <NavPill key={d.id} active={d.id === decade?.id} onClick={() => setFilter('decade', d.id)}>
              {d.label}
            </NavPill>
          ))}
        </div>

        {listing.isError && items.length === 0 ? (
          <EmptyState
            icon={<AlertCircle />}
            title={`Couldn’t load ${config.noun}`}
            description={`Check your ${config.source} in Settings, then try again.`}
            action={
              <Button variant="secondary" onClick={() => listing.refetch()}>
                Try again
              </Button>
            }
          />
        ) : !listing.isPending && items.length === 0 && !hasNextPage ? (
          <EmptyState
            icon={<SearchIcon />}
            title="Nothing here"
            description={`No ${config.noun} match these filters. Try another decade.`}
            action={
              decade ? (
                <Button variant="secondary" onClick={() => setFilter('decade')}>
                  Show any time
                </Button>
              ) : undefined
            }
          />
        ) : null}

        <div
          ref={gridRef}
          className="grid justify-between gap-x-rail gap-y-6"
          style={{ gridTemplateColumns: `repeat(auto-fill, var(--poster-w-${layout.size}))` }}
        >
          {items.map((item, index) => {
            const request = requestFor(item)
            const column = index % layout.columns
            return (
              <PosterCard
                key={item.id}
                title={item.title}
                type={kind}
                poster={item.poster}
                year={item.year}
                size={layout.size}
                details={posterDetails(item)}
                anchor={column === 0 ? 'start' : column === layout.columns - 1 ? 'end' : 'center'}
                status={request ? <StatusBadge status={request.status} onArtwork size="sm" /> : undefined}
                onClick={() => openDetails(item)}
                actions={
                  kind === 'game' ? (
                    // Games pick a platform first, so the detail modal owns the request.
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        openDetails(item)
                      }}
                    >
                      View details
                    </Button>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          setRequestItem(item)
                        }}
                      >
                        Request
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          openDetails(item)
                        }}
                      >
                        Details
                      </Button>
                    </>
                  )
                }
              />
            )
          })}
          {listing.isPending && skeletons(layout.columns * 3)}
          {isFetchingNextPage && skeletons(layout.columns)}
        </div>

        <div ref={sentinelRef} aria-hidden />

        {isFetchNextPageError ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <p className="text-sm text-fg-secondary">Couldn’t load more {config.noun}.</p>
            <Button variant="secondary" onClick={() => fetchNextPage()}>
              Try again
            </Button>
          </div>
        ) : isFetchingNextPage ? (
          <p className="flex items-center justify-center gap-2 text-sm text-fg-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading more
          </p>
        ) : items.length > 0 && !hasNextPage ? (
          <p className="text-center text-sm text-fg-muted">
            {truncated
              ? `That’s as deep as this listing goes. ${
                  decade ? 'Try another order to see the rest.' : 'Pick a decade to go further back.'
                }`
              : `That’s all ${items.length.toLocaleString()}.`}
          </p>
        ) : null}
      </PageSection>

      {selected && kind === 'game' && (
        <GameDetailModal
          gameId={selected.id}
          title={selected.title}
          open={isModalOpen}
          onOpenChange={setIsModalOpen}
        />
      )}

      {selected && kind !== 'game' && (
        <MovieDetailModal
          contentType={kind}
          contentId={selected.id}
          title={selected.title}
          open={isModalOpen}
          onOpenChange={setIsModalOpen}
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
