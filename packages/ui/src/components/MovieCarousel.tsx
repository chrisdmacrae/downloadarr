import { Carousel, CarouselItem } from '@/components/ui/carousel'
import { MovieCard } from '@/components/MovieCard'
import { SearchResult } from '@/services/api'
import { Skeleton } from '@/components/ui/skeleton'

interface MovieCarouselProps {
  title: string
  movies: SearchResult[]
  onMovieClick?: (movie: SearchResult) => void
  isLoading?: boolean
  cardSize?: 'small' | 'medium' | 'large'
  showOverview?: boolean
}

export function MovieCarousel({ 
  title, 
  movies, 
  onMovieClick, 
  isLoading = false, 
  cardSize = 'medium',
  showOverview = false 
}: MovieCarouselProps) {
  const cardWidths = {
    small: 128,
    medium: 192,
    large: 256
  }

  const cardWidth = cardWidths[cardSize]

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">{title}</h2>
        <div className="flex space-x-4 overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex-shrink-0" style={{ width: `${cardWidth}px` }}>
              <Skeleton className="aspect-[2/3] w-full" />
              <div className="mt-2 space-y-1">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!movies || movies.length === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">{title}</h2>
        <div className="text-muted-foreground text-center py-8">
          No movies found
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">{title}</h2>
      <Carousel itemWidth={cardWidth} gap={16}>
        {movies.map((movie) => (
          <CarouselItem key={movie.id} width={cardWidth}>
            <MovieCard 
              movie={movie} 
              onClick={onMovieClick}
              size={cardSize}
              showOverview={showOverview}
            />
          </CarouselItem>
        ))}
      </Carousel>
    </div>
  )
}
