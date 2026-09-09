import { useEffect, useState } from 'react'

import { DiscoveryScreen, type DiscoveryRail } from '@/components/discovery/DiscoveryScreen'
import { MovieDetailModal } from '@/components/MovieDetailModal'
import { DownloadRequestModal } from '@/components/DownloadRequestModal'
import { SearchResult, apiService } from '@/services/api'
import { useToast } from '@/hooks/use-toast'

const TARGET_GENRES = [
  'Action & Adventure',
  'Animation',
  'Comedy',
  'Crime',
  'Documentary',
  'Drama',
  'Family',
  'Mystery',
  'Sci-Fi & Fantasy',
]

export default function TvShowsDiscovery() {
  const [featured, setFeatured] = useState<SearchResult[]>([])
  const [popular, setPopular] = useState<SearchResult[]>([])
  const [genreRails, setGenreRails] = useState<DiscoveryRail[]>([])
  const [selectedShow, setSelectedShow] = useState<{ id: string; title: string } | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [requestItem, setRequestItem] = useState<SearchResult | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setIsLoading(true)
      try {
        const popularResponse = await apiService.getPopularTvShows(1)
        if (!cancelled && popularResponse.success && popularResponse.data) {
          setFeatured(popularResponse.data.slice(0, 5))
          setPopular(popularResponse.data.slice(5))
        }

        const genresResponse = await apiService.getTvGenres()
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
              const response = await apiService.getTvShowsByGenre(genre.id, 1)
              if (response.success && response.data?.length) {
                rails.push({
                  id: String(genre.id),
                  title: genre.name,
                  items: response.data.slice(0, 20),
                })
              }
            } catch (err) {
              console.error(`Failed to load TV shows for genre ${genre.name}:`, err)
            }
          }
          if (!cancelled) setGenreRails(rails)
        }
      } catch {
        if (!cancelled) {
          toast({
            title: 'Discovery unavailable',
            description: 'Failed to load TV show discovery data. Check your TMDB key in Settings.',
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
        kind="tv"
        eyebrow="Find"
        title="Discover TV shows"
        description="Find your next binge"
        searchPlaceholder="Search for TV shows…"
        searchTab="tv"
        featured={featured}
        popular={popular}
        popularTitle="Popular TV shows"
        genreRails={genreRails}
        isLoading={isLoading}
        onItemClick={(item) => {
          setSelectedShow({ id: item.id, title: item.title })
          setIsModalOpen(true)
        }}
        onRequest={(item) => setRequestItem(item)}
      />

      {selectedShow && (
        <MovieDetailModal
          contentType="tv"
          contentId={selectedShow.id}
          title={selectedShow.title}
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
