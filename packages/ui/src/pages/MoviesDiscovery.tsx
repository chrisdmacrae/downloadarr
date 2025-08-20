import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { SearchResultCarousel } from '@/components/SearchResultCarousel'
import { SearchResultCard } from '@/components/SearchResultCard'
import { MovieDetailModal } from '@/components/MovieDetailModal'
import { DownloadStatusBadge } from '@/components/DownloadStatusBadge'
import { SearchResult, apiService } from '@/services/api'
import { useToast } from '@/hooks/use-toast'
import { useTorrentRequests } from '@/hooks/useTorrentRequests'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search as SearchIcon } from 'lucide-react'

interface Genre {
  id: number
  name: string
}

export default function MoviesDiscovery() {
  const [featuredMovies, setFeaturedMovies] = useState<SearchResult[]>([])
  const [popularMovies, setPopularMovies] = useState<SearchResult[]>([])
  const [genres, setGenres] = useState<Genre[]>([])
  const [genreMovies, setGenreMovies] = useState<Record<number, SearchResult[]>>({})
  const [selectedMovie, setSelectedMovie] = useState<SearchResult | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const { toast } = useToast()
  const navigate = useNavigate()
  const { getRequestForItem } = useTorrentRequests()

  // Predefined genres based on the spec
  const targetGenres = [
    'Action', 'Adventure', 'Comedy', 'Drama', 'Horror', 'Romance', 'Science Fiction', 'Thriller'
  ]

  useEffect(() => {
    loadDiscoveryData()
  }, [])

  const loadDiscoveryData = async () => {
    setIsLoading(true)
    try {
      // Load popular movies first
      const popularResponse = await apiService.getPopularMovies(1)
      if (popularResponse.success && popularResponse.data) {
        const movies = popularResponse.data
        setFeaturedMovies(movies.slice(0, 5)) // Top 5 for featured
        setPopularMovies(movies.slice(5)) // Rest for carousel
      }

      // Load genres
      const genresResponse = await apiService.getMovieGenres()
      if (genresResponse.success && genresResponse.data) {
        // Filter to only include the genres we want
        const filteredGenres = genresResponse.data.filter(genre => 
          targetGenres.some(targetGenre => 
            genre.name.toLowerCase().includes(targetGenre.toLowerCase()) ||
            targetGenre.toLowerCase().includes(genre.name.toLowerCase())
          )
        )
        setGenres(filteredGenres)

        // Load movies for each genre
        const genreMoviesData: Record<number, SearchResult[]> = {}
        for (const genre of filteredGenres) {
          try {
            const genreResponse = await apiService.getMoviesByGenre(genre.id, 1)
            if (genreResponse.success && genreResponse.data) {
              genreMoviesData[genre.id] = genreResponse.data.slice(0, 20) // Limit to 20 per genre
            }
          } catch (error) {
            console.error(`Failed to load movies for genre ${genre.name}:`, error)
          }
        }
        setGenreMovies(genreMoviesData)
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load movie discovery data",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleMovieClick = (movie: SearchResult) => {
    setSelectedMovie(movie)
    setIsModalOpen(true)
  }

  const handleSearch = () => {
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}&tab=movies`)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  const getStatusBadge = (item: SearchResult) => {
    const torrentRequest = getRequestForItem(item.title, item.year, undefined, undefined, 'MOVIE')
    return torrentRequest ? <DownloadStatusBadge request={torrentRequest} variant="compact" /> : undefined
  }

  if (isLoading) {
    return (
      <div className="space-y-8 p-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Discover Movies</h1>
          <p className="text-muted-foreground">Find your next favorite movie</p>
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
    <div className="space-y-4 md:space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">Discover Movies</h1>
        <p className="text-muted-foreground">Find your next favorite movie</p>
      </div>

      {/* Search Bar */}
      <div className="max-w-2xl">
        <div className="flex space-x-2">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search for movies..."
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
      {featuredMovies.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold">Featured</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {featuredMovies.map((movie) => (
              <SearchResultCard
                key={movie.id}
                item={movie}
                onClick={handleMovieClick}
                size="medium"
                showOverview={false}
                statusBadge={getStatusBadge(movie)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Popular Movies Carousel */}
      {popularMovies.length > 0 && (
        <SearchResultCarousel
          title="Popular Movies"
          items={popularMovies}
          onItemClick={handleMovieClick}
          cardSize="medium"
          getStatusBadge={getStatusBadge}
        />
      )}

      {/* Genre Carousels */}
      {genres.map((genre) => {
        const movies = genreMovies[genre.id]
        if (!movies || movies.length === 0) return null

        return (
          <SearchResultCarousel
            key={genre.id}
            title={genre.name}
            items={movies}
            onItemClick={handleMovieClick}
            cardSize="medium"
            getStatusBadge={getStatusBadge}
          />
        )
      })}

      {/* Movie Detail Modal */}
      <MovieDetailModal
        movie={selectedMovie}
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
      />
    </div>
  )
}
