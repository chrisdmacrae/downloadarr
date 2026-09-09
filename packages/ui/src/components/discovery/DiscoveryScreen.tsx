import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { Info, Play, Search as SearchIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { HeroBanner, HeroBannerSkeleton } from '@/components/ds/HeroBanner'
import { EmptyState, Page, PageSection } from '@/components/ds/Page'
import { PosterCard, PosterCardSkeleton, type PosterDetails } from '@/components/ds/PosterCard'
import { Rail } from '@/components/ds/Rail'
import { StatusBadge } from '@/components/ds/StatusBadge'
import { NavPill } from '@/components/ds/TopNav'
import { useSubnav } from '@/components/ds/Subnav'
import { useTorrentRequests } from '@/hooks/useTorrentRequests'
import type { SearchResult, TorrentRequest } from '@/services/api'
import { formatRating } from '@/lib/status'

export interface DiscoveryRail {
  id: string
  title: string
  items: SearchResult[]
}

interface DiscoveryScreenProps {
  kind: 'movie' | 'tv' | 'game'
  eyebrow: string
  title: string
  description: string
  searchPlaceholder: string
  /** Tab id used when handing a query to /search. */
  searchTab: 'movies' | 'tv' | 'anime' | 'games'
  featured: SearchResult[]
  popular: SearchResult[]
  popularTitle: string
  genreRails: DiscoveryRail[]
  isLoading: boolean
  onItemClick: (item: SearchResult) => void
  onRequest?: (item: SearchResult) => void
  /** Label for the hero's primary action. */
  requestLabel?: string
  /** Optional view switch above the rails — the games screen's PC / ROM tabs. */
  tabs?: Array<{ id: string; label: string }>
  activeTab?: string
  onTabChange?: (id: string) => void
}

/** Maps a SearchResult onto the facts the poster hover panel shows. */
export function posterDetails(item: SearchResult): PosterDetails {
  return {
    rating: item.rating,
    year: item.year,
    runtime: item.runtime,
    seasons: item.seasons,
    episodeRuntime: item.episodeRuntime,
    platform: item.platforms?.[0],
    description: item.overview,
    categories: item.genres,
  }
}

/** Discovery screens are hero-then-rails. */
export function DiscoveryScreen({
  kind,
  eyebrow,
  title,
  description,
  searchPlaceholder,
  searchTab,
  featured,
  popular,
  popularTitle,
  genreRails,
  isLoading,
  onItemClick,
  onRequest,
  requestLabel = 'Request',
  tabs,
  activeTab,
  onTabChange,
}: DiscoveryScreenProps) {
  const navigate = useNavigate()
  const [query, setQuery] = React.useState('')
  const [activeRail, setActiveRail] = React.useState<string>('all')
  const { getRequestForItem, getRequestForShow, getRequestForGame } = useTorrentRequests()

  const requestFor = React.useCallback(
    (item: SearchResult): TorrentRequest | undefined => {
      if (kind === 'tv') return getRequestForShow(item.title, item.year)
      if (kind === 'game') return getRequestForGame(item.title, item.year)
      return getRequestForItem(item.title, item.year, undefined, undefined, 'MOVIE')
    },
    [kind, getRequestForItem, getRequestForShow, getRequestForGame]
  )

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = query.trim()
    if (!trimmed) return
    navigate(`/search?q=${encodeURIComponent(trimmed)}&tab=${searchTab}`)
  }

  // Genre pills ride in the top nav's second row.
  const railFilters = React.useMemo(
    () => [{ id: 'all', title: 'All' }, ...genreRails.map((r) => ({ id: r.id, title: r.title }))],
    [genreRails]
  )

  useSubnav(
    genreRails.length > 0 || tabs ? (
      <>
        {tabs?.map((tab) => (
          <NavPill key={tab.id} active={activeTab === tab.id} onClick={() => onTabChange?.(tab.id)}>
            {tab.label}
          </NavPill>
        ))}
        {tabs && genreRails.length > 0 && (
          <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-[color:var(--border-hairline)]" />
        )}
        {railFilters.map((filter) => (
          <NavPill
            key={filter.id}
            active={activeRail === filter.id}
            onClick={() => {
              setActiveRail(filter.id)
              if (filter.id !== 'all') {
                document
                  .getElementById(`rail-${filter.id}`)
                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              } else {
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }
            }}
          >
            {filter.title}
          </NavPill>
        ))}
      </>
    ) : null,
    [railFilters, activeRail, tabs, activeTab]
  )

  const hero = featured.find((item) => item.backdrop) ?? featured[0]

  const renderCard = (item: SearchResult, index: number, total: number) => {
    const request = requestFor(item)
    return (
      <PosterCard
        key={item.id}
        title={item.title}
        type={kind}
        poster={item.poster}
        year={item.year}
        details={posterDetails(item)}
        anchor={index === 0 ? 'start' : index === total - 1 ? 'end' : 'center'}
        status={request ? <StatusBadge status={request.status} onArtwork size="sm" /> : undefined}
        onClick={() => onItemClick(item)}
        actions={
          onRequest ? (
            <>
              <Button
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  onRequest(item)
                }}
              >
                {requestLabel}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  onItemClick(item)
                }}
              >
                Details
              </Button>
            </>
          ) : undefined
        }
      />
    )
  }

  if (isLoading) {
    return (
      <Page>
        <HeroBannerSkeleton />
        <PageSection bleedRails>
          {Array.from({ length: 3 }).map((_, i) => (
            <Rail key={i} title="Loading">
              {Array.from({ length: 8 }).map((_, j) => (
                <PosterCardSkeleton key={j} game={kind === 'game'} />
              ))}
            </Rail>
          ))}
        </PageSection>
      </Page>
    )
  }

  return (
    <Page>
      {hero ? (
        <HeroBanner
          eyebrow={eyebrow}
          title={hero.title}
          backdrop={hero.backdrop || hero.poster}
          meta={[
            hero.year ?? '—',
            ...(formatRating(hero.rating) ? [`★ ${formatRating(hero.rating)}`] : []),
            ...(hero.genres?.slice(0, 2) ?? []),
          ]}
          description={hero.overview}
          actions={
            <>
              {onRequest && (
                <Button size="lg" onClick={() => onRequest(hero)}>
                  <Play className="h-5 w-5" />
                  {requestLabel}
                </Button>
              )}
              <Button size="lg" variant="glass" onClick={() => onItemClick(hero)}>
                <Info className="h-5 w-5" />
                More info
              </Button>
            </>
          }
        />
      ) : (
        <HeroBanner eyebrow={eyebrow} title={title} description={description} />
      )}

      <PageSection bleedRails>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold leading-tight tracking-tight text-fg-primary">{title}</h1>
            <p className="text-sm text-fg-secondary">{description}</p>
          </div>
          <form onSubmit={submitSearch} className="flex w-full max-w-md gap-2">
            <div className="relative flex-1">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="pl-10"
              />
            </div>
            <Button type="submit" disabled={!query.trim()}>
              Search
            </Button>
          </form>
        </div>

        {featured.length > 0 && (
          <Rail title="Featured" count={featured.length}>
            {featured.map((item, i) => renderCard(item, i, featured.length))}
          </Rail>
        )}

        {popular.length > 0 && (
          <Rail title={popularTitle} count={popular.length}>
            {popular.map((item, i) => renderCard(item, i, popular.length))}
          </Rail>
        )}

        {genreRails.map((rail) => (
          <div key={rail.id} id={`rail-${rail.id}`}>
            <Rail title={rail.title} count={rail.items.length}>
              {rail.items.map((item, i) => renderCard(item, i, rail.items.length))}
            </Rail>
          </div>
        ))}

        {featured.length === 0 && popular.length === 0 && genreRails.length === 0 && (
          <EmptyState
            icon={<SearchIcon />}
            title="Nothing to show yet"
            description="Check your discovery API keys in Settings, then reload this page."
            action={
              <Button variant="secondary" onClick={() => navigate('/settings/discovery')}>
                Open discovery keys
              </Button>
            }
          />
        )}
      </PageSection>
    </Page>
  )
}
