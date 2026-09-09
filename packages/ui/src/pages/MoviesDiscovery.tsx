import { useEffect, useState } from 'react'

import { DiscoveryScreen, type DiscoveryRail } from '@/components/discovery/DiscoveryScreen'
import { MovieDetailModal } from '@/components/MovieDetailModal'
import { DownloadRequestModal } from '@/components/DownloadRequestModal'
import { SearchResult, apiService } from '@/services/api'
import { useToast } from '@/hooks/use-toast'

/** The genres this screen builds rails from. */
const TARGET_GENRES = [
  'Action',
  'Adventure',
  'Comedy',
  'Drama',
  'Horror',
  'Romance',
  'Science Fiction',
  'Thriller',
]

export default function MoviesDiscovery() {
  const [featured, setFeatured] = useState<SearchResult[]>([])
  const [popular, setPopular] = useState<SearchResult[]>([])
  const [genreRails, setGenreRails] = useState<DiscoveryRail[]>([])
  const [selectedMovie, setSelectedMovie] = useState<{ id: string; title: string } | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [requestItem, setRequestItem] = useState<SearchResult | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setIsLoading(true)
      try {
        const popularResponse = await apiService.getPopularMovies(1)
        if (!cancelled && popularResponse.success && popularResponse.data) {
          setFeatured(popularResponse.data.slice(0, 5))
          setPopular(popularResponse.data.slice(5))
        }

        const genresResponse = await apiService.getMovieGenres()
        if (!cancelled && genresResponse.success && genresResponse.data) {
          const genres = genresResponse.data.filter((genre) =>
            TARGET_GENRES.some(
              (target) =>
                genre.name.toLowerCase().includes(target.toLowerCase()) ||
                target.toLowerCase().includes(genre.name.toLowerCase())
            )
          )

          const rails: DiscoveryRail[] = []
          for (const genre of genres) {
            try {
              const response = await apiService.getMoviesByGenre(genre.id, 1)
              if (response.success && response.data?.length) {
                rails.push({
                  id: String(genre.id),
                  title: genre.name,
                  items: response.data.slice(0, 20),
                })
              }
            } catch (err) {
              console.error(`Failed to load movies for genre ${genre.name}:`, err)
            }
          }
          if (!cancelled) setGenreRails(rails)
        }
      } catch {
        if (!cancelled) {
          toast({
            title: 'Discovery unavailable',
            description: 'Failed to load movie discovery data. Check your TMDB key in Settings.',
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
  }, [])

  return (
    <>
      <DiscoveryScreen
        kind="movie"
        eyebrow="Find"
        title="Discover movies"
        description="Find your next favorite movie"
        searchPlaceholder="Search for movies…"
        searchTab="movies"
        featured={featured}
        popular={popular}
        popularTitle="Popular movies"
        genreRails={genreRails}
        isLoading={isLoading}
        onItemClick={(item) => {
          setSelectedMovie({ id: item.id, title: item.title })
          setIsModalOpen(true)
        }}
        onRequest={(item) => setRequestItem(item)}
      />

      {selectedMovie && (
        <MovieDetailModal
          contentType="movie"
          contentId={selectedMovie.id}
          title={selectedMovie.title}
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
