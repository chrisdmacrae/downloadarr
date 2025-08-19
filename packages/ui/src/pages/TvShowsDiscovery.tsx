import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { SearchResultCarousel } from '@/components/SearchResultCarousel'
import { SearchResultCard } from '@/components/SearchResultCard'
import { MovieDetailModal } from '@/components/MovieDetailModal'
import { SearchResult, apiService } from '@/services/api'
import { useToast } from '@/hooks/use-toast'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search as SearchIcon } from 'lucide-react'

interface Genre {
  id: number
  name: string
}

export default function TvShowsDiscovery() {
  const [featuredShows, setFeaturedShows] = useState<SearchResult[]>([])
  const [popularShows, setPopularShows] = useState<SearchResult[]>([])
  const [genres, setGenres] = useState<Genre[]>([])
  const [genreShows, setGenreShows] = useState<Record<number, SearchResult[]>>({})
  const [selectedShow, setSelectedShow] = useState<SearchResult | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const { toast } = useToast()
  const navigate = useNavigate()

  // Predefined genres based on common TV show genres
  const targetGenres = [
    'Action & Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary', 'Drama', 'Family', 'Mystery', 'Sci-Fi & Fantasy'
  ]

  useEffect(() => {
    loadDiscoveryData()
  }, [])

  const loadDiscoveryData = async () => {
    setIsLoading(true)
    try {
      // Load popular TV shows first
      const popularResponse = await apiService.getPopularTvShows(1)
      if (popularResponse.success && popularResponse.data) {
        const shows = popularResponse.data
        setFeaturedShows(shows.slice(0, 5)) // Top 5 for featured
        setPopularShows(shows.slice(5)) // Rest for carousel
      }

      // Load genres
      const genresResponse = await apiService.getTvGenres()
      if (genresResponse.success && genresResponse.data) {
        // Filter to only include the genres we want
        const filteredGenres = genresResponse.data.filter(genre => 
          targetGenres.some(targetGenre => 
            genre.name.toLowerCase().includes(targetGenre.toLowerCase()) ||
            targetGenre.toLowerCase().includes(genre.name.toLowerCase())
          )
        )
        setGenres(filteredGenres)

        // Load shows for each genre
        const genreShowsData: Record<number, SearchResult[]> = {}
        for (const genre of filteredGenres) {
          try {
            const genreResponse = await apiService.getTvShowsByGenre(genre.id, 1)
            if (genreResponse.success && genreResponse.data) {
              genreShowsData[genre.id] = genreResponse.data.slice(0, 20) // Limit to 20 per genre
            }
          } catch (error) {
            console.error(`Failed to load TV shows for genre ${genre.name}:`, error)
          }
        }
        setGenreShows(genreShowsData)
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load TV show discovery data",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleShowClick = (show: SearchResult) => {
    setSelectedShow(show)
    setIsModalOpen(true)
  }

  const handleSearch = () => {
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}&tab=tv`)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-8 p-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Discover TV Shows</h1>
          <p className="text-muted-foreground">Find your next binge-worthy series</p>
        </div>

        {/* Featured Section Skeleton */}
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="aspect-[2/3] w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        </div>

        {/* Carousels Skeleton */}
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-4">
            <Skeleton className="h-6 w-32" />
            <div className="flex space-x-4 overflow-hidden">
              {Array.from({ length: 6 }).map((_, j) => (
                <div key={j} className="flex-shrink-0 w-48 space-y-2">
                  <Skeleton className="aspect-[2/3] w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-8 p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">Discover TV Shows</h1>
        <p className="text-muted-foreground">Find your next binge-worthy series</p>
      </div>

      {/* Search Bar */}
      <div className="max-w-2xl">
        <div className="flex space-x-2">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search for TV shows..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyPress}
              className="pl-10"
            />
          </div>
          <Button onClick={handleSearch} disabled={!searchQuery.trim()}>
            Search
          </Button>
        </div>
      </div>

      {/* Featured Section */}
      {featuredShows.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold">Featured</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {featuredShows.map((show) => (
              <SearchResultCard
                key={show.id}
                item={show}
                onClick={handleShowClick}
                size="medium"
                showOverview={false}
              />
            ))}
          </div>
        </div>
      )}

      {/* Popular TV Shows Carousel */}
      {popularShows.length > 0 && (
        <SearchResultCarousel
          title="Popular TV Shows"
          items={popularShows}
          onItemClick={handleShowClick}
          cardSize="medium"
        />
      )}

      {/* Genre Carousels */}
      {genres.map((genre) => {
        const shows = genreShows[genre.id]
        if (!shows || shows.length === 0) return null

        return (
          <SearchResultCarousel
            key={genre.id}
            title={genre.name}
            items={shows}
            onItemClick={handleShowClick}
            cardSize="medium"
          />
        )
      })}

      {/* TV Show Detail Modal */}
      <MovieDetailModal
        movie={selectedShow}
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
      />
    </div>
  )
}
