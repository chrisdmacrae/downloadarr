import { Carousel, CarouselItem } from '@/components/ui/carousel'
import { SearchResultCard } from '@/components/SearchResultCard'
import { SearchResult } from '@/services/api'
import { Skeleton } from '@/components/ui/skeleton'

interface SearchResultCarouselProps {
  title: string
  items: SearchResult[]
  onItemClick?: (item: SearchResult) => void
  isLoading?: boolean
  cardSize?: 'small' | 'medium' | 'large'
  showOverview?: boolean
  getStatusBadge?: (item: SearchResult) => React.ReactNode
}

export function SearchResultCarousel({
  title,
  items,
  onItemClick,
  isLoading = false,
  cardSize = 'medium',
  showOverview = false,
  getStatusBadge
}: SearchResultCarouselProps) {
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

  if (!items || items.length === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">{title}</h2>
        <div className="text-muted-foreground text-center py-8">
          No results found
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">{title}</h2>
      <Carousel itemWidth={cardWidth} gap={16}>
        {items.map((item) => (
          <CarouselItem key={item.id} width={cardWidth}>
            <SearchResultCard
              item={item}
              onClick={onItemClick}
              size={cardSize}
              showOverview={showOverview}
              statusBadge={getStatusBadge?.(item)}
            />
          </CarouselItem>
        ))}
      </Carousel>
    </div>
  )
}
