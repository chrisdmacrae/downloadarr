import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { DiscoveryScreen, type DiscoveryRail } from '@/components/discovery/DiscoveryScreen'
import { MovieDetailModal } from '@/components/MovieDetailModal'
import { DownloadRequestModal } from '@/components/DownloadRequestModal'
import { SearchResult, apiService } from '@/services/api'
import { useToast } from '@/hooks/use-toast'

type AnimeTab = 'series' | 'films'

/**
 * Genres each view builds rails from. Animation is deliberately absent — every
 * anime carries it, so a rail for it would duplicate the popular one.
 */
const SERIES_GENRES = ['Action & Adventure', 'Comedy', 'Drama', 'Mystery', 'Sci-Fi & Fantasy', 'Kids']
const FILM_GENRES = ['Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Romance']

export default function AnimeDiscovery() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState<AnimeTab>('series')
  const [featured, setFeatured] = useState<SearchResult[]>([])
  const [popular, setPopular] = useState<SearchResult[]>([])
  const [genreRails, setGenreRails] = useState<DiscoveryRail[]>([])
  const [selected, setSelected] = useState<{ id: string; title: string } | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [requestItem, setRequestItem] = useState<SearchResult | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()

  const isFilms = activeTab === 'films'

  useEffect(() => {
    const tab = searchParams.get('tab') as AnimeTab | null
    if (tab && ['series', 'films'].includes(tab)) setActiveTab(tab)
  }, [searchParams])

  const handleTabChange = (tab: string) => {
    setActiveTab(tab as AnimeTab)
    const next = new URLSearchParams(searchParams)
    next.set('tab', tab)
    setSearchParams(next)
  }

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setIsLoading(true)
      setGenreRails([])
      try {
        const popularResponse = isFilms
          ? await apiService.getPopularAnimeMovies(1)
          : await apiService.getPopularAnime(1)

        if (!cancelled && popularResponse.success && popularResponse.data) {
          setFeatured(popularResponse.data.slice(0, 5))
          setPopular(popularResponse.data.slice(5))
        }

        const genresResponse = isFilms
          ? await apiService.getAnimeMovieGenres()
          : await apiService.getAnimeGenres()

        if (!cancelled && genresResponse.success && genresResponse.data) {
          const targets = isFilms ? FILM_GENRES : SERIES_GENRES
          const genres = genresResponse.data.filter((genre) =>
            targets.some(
              (target) =>
                genre.name.toLowerCase().includes(target.toLowerCase()) ||
                target.toLowerCase().includes(genre.name.toLowerCase())
            )
          )

          const rails: DiscoveryRail[] = []
          for (const genre of genres) {
            try {
              const response = isFilms
                ? await apiService.getAnimeMoviesByGenre(genre.id, 1)
                : await apiService.getAnimeByGenre(genre.id, 1)
              if (response.success && response.data?.length) {
                rails.push({
                  id: String(genre.id),
                  title: genre.name,
                  items: response.data.slice(0, 20),
                })
              }
            } catch (err) {
              console.error(`Failed to load anime for genre ${genre.name}:`, err)
            }
          }
          if (!cancelled) setGenreRails(rails)
        }
      } catch {
        if (!cancelled) {
          toast({
            title: 'Discovery unavailable',
            description: 'Failed to load anime discovery data. Check your TMDB key in Settings.',
            variant: 'destructive',
          })
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFilms])

  return (
    <>
      <DiscoveryScreen
        // Anime is a filter over the existing content types, not a new one:
        // series are TV shows and films are movies, with the same cards,
        // modals and request flow.
        kind={isFilms ? 'movie' : 'tv'}
        eyebrow="Find"
        title="Discover anime"
        description={isFilms ? 'Find your next film' : 'Find your next series'}
        searchPlaceholder="Search for anime…"
        searchTab="anime"
        featured={featured}
        popular={popular}
        popularTitle={isFilms ? 'Popular anime films' : 'Popular anime'}
        genreRails={genreRails}
        isLoading={isLoading}
        tabs={[
          { id: 'series', label: 'Series' },
          { id: 'films', label: 'Films' },
        ]}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onItemClick={(item) => {
          setSelected({ id: item.id, title: item.title })
          setIsModalOpen(true)
        }}
        onRequest={(item) => setRequestItem(item)}
      />

      {selected && (
        <MovieDetailModal
          contentType={isFilms ? 'movie' : 'tv'}
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
    </>
  )
}
