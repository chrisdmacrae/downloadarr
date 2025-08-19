import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'
import { SearchResult } from '@/services/api'

interface MovieCardProps {
  movie: SearchResult
  onClick?: (movie: SearchResult) => void
  onDownloadRequest?: (movie: SearchResult) => void
  size?: 'small' | 'medium' | 'large'
  showOverview?: boolean
  showDownloadButton?: boolean
}

export function MovieCard({
  movie,
  onClick,
  onDownloadRequest,
  size = 'medium',
  showOverview = false,
  showDownloadButton = false
}: MovieCardProps) {
  const sizeClasses = {
    small: {
      container: 'w-32',
      aspect: 'aspect-[2/3]',
      title: 'text-xs',
      year: 'text-xs'
    },
    medium: {
      container: 'w-48',
      aspect: 'aspect-[2/3]',
      title: 'text-sm',
      year: 'text-xs'
    },
    large: {
      container: 'w-64',
      aspect: 'aspect-[2/3]',
      title: 'text-base',
      year: 'text-sm'
    }
  }

  const classes = sizeClasses[size]

  return (
    <Card 
      className={`${classes.container} overflow-hidden hover:shadow-lg transition-all duration-200 cursor-pointer hover:scale-105`}
      onClick={() => onClick?.(movie)}
    >
      <div className={`${classes.aspect} bg-muted relative`}>
        {movie.poster ? (
          <img
            src={movie.poster}
            alt={movie.title}
            className="w-full h-full object-cover"
            onError={(e) => {
              const target = e.target as HTMLImageElement
              target.style.display = 'none'
              target.nextElementSibling?.classList.remove('hidden')
            }}
          />
        ) : null}
        <div className={`absolute inset-0 flex items-center justify-center text-muted-foreground ${movie.poster ? 'hidden' : ''}`}>
          <div className="text-center p-2">
            <div className="text-xs">No Image</div>
          </div>
        </div>
        <Badge className="absolute top-2 right-2 capitalize text-xs">
          {movie.type === 'tv' ? 'TV' : 'Movie'}
        </Badge>
      </div>
      <CardHeader className="pb-2 px-3 pt-3">
        <CardTitle className={`${classes.title} line-clamp-2 leading-tight`} title={movie.title}>
          {movie.title}
        </CardTitle>
        <CardDescription className={`${classes.year} flex items-center justify-between`}>
          <span>{movie.year || 'Unknown'}</span>
        </CardDescription>
      </CardHeader>
      {showOverview && movie.overview && (
        <CardContent className="pt-0 px-3 pb-3">
          <p className="text-xs text-muted-foreground line-clamp-3">
            {movie.overview}
          </p>
        </CardContent>
      )}
    </Card>
  )
}
