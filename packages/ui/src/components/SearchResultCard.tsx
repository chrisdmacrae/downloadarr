import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Download, Gamepad2 } from 'lucide-react'
import { SearchResult } from '@/services/api'

interface SearchResultCardProps {
  item: SearchResult
  onClick?: (item: SearchResult) => void
  onDownloadRequest?: (item: SearchResult) => void
  size?: 'small' | 'medium' | 'large'
  showOverview?: boolean
  showDownloadButton?: boolean
  statusBadge?: React.ReactNode
}

export function SearchResultCard({
  item,
  onClick,
  onDownloadRequest,
  size = 'medium',
  showOverview = false,
  showDownloadButton = false,
  statusBadge
}: SearchResultCardProps) {
  const sizeClasses = {
    small: {
      container: 'w-full',
      aspect: item.type === 'game' ? 'aspect-[3/4]' : 'aspect-[2/3]',
      title: 'text-xs',
      year: 'text-xs'
    },
    medium: {
      container: 'w-full',
      aspect: item.type === 'game' ? 'aspect-[3/4]' : 'aspect-[2/3]',
      title: 'text-sm',
      year: 'text-xs'
    },
    large: {
      container: 'w-full',
      aspect: item.type === 'game' ? 'aspect-[3/4]' : 'aspect-[2/3]',
      title: 'text-base',
      year: 'text-sm'
    }
  }

  const classes = sizeClasses[size]

  const getTypeLabel = () => {
    switch (item.type) {
      case 'tv':
        return 'TV'
      case 'movie':
        return 'Movie'
      case 'game':
        return 'Game'
      default:
        return item.type
    }
  }

  const getPlaceholderIcon = () => {
    if (item.type === 'game') {
      return <Gamepad2 className="h-8 w-8" />
    }
    return null
  }

  return (
    <Card 
      className={`${classes.container} overflow-hidden hover:shadow-lg transition-all duration-200 cursor-pointer hover:scale-105`}
      onClick={() => onClick?.(item)}
    >
      <div className={`${classes.aspect} bg-muted relative`}>
        {item.poster ? (
          <img
            src={item.poster}
            alt={item.title}
            className="w-full h-full object-cover"
            onError={(e) => {
              const target = e.target as HTMLImageElement
              target.style.display = 'none'
              target.nextElementSibling?.classList.remove('hidden')
            }}
          />
        ) : null}
        <div className={`absolute inset-0 flex items-center justify-center text-muted-foreground ${item.poster ? 'hidden' : ''}`}>
          <div className="text-center p-2">
            {getPlaceholderIcon()}
            <div className="text-xs mt-1">No Image</div>
          </div>
        </div>
        <Badge className="absolute top-2 right-2 capitalize text-xs">
          {getTypeLabel()}
        </Badge>
        {statusBadge && (
          <div className="absolute top-2 left-2">
            {statusBadge}
          </div>
        )}
      </div>
      <CardHeader className="pb-2 px-3 pt-3">
        <CardTitle className={`${classes.title} line-clamp-2 leading-tight`} title={item.title}>
          {item.title}
        </CardTitle>
        <CardDescription className={`${classes.year} flex items-center justify-between`}>
          <span>{item.year || 'Unknown'}</span>
        </CardDescription>
      </CardHeader>
      {showOverview && item.overview && (
        <CardContent className="pt-0 px-3 pb-3">
          <p className="text-xs text-muted-foreground line-clamp-3">
            {item.overview}
          </p>
        </CardContent>
      )}
      {(showDownloadButton || (statusBadge && item.type !== 'game')) && (
        <CardContent className="pt-0 px-3 pb-3">
          {/* Show request status if exists for non-game items */}
          {item.type !== 'game' && statusBadge && (
            <div className="flex items-center justify-center py-2">
              {statusBadge}
            </div>
          )}
          {showDownloadButton && (
            <Button
              size="sm"
              className="w-full"
              onClick={(e) => {
                e.stopPropagation()
                onDownloadRequest?.(item)
              }}
            >
              <Download className="h-3 w-3 mr-1" />
              {item.type === 'game' ? 'View Details' : 'Download'}
            </Button>
          )}
        </CardContent>
      )}
    </Card>
  )
}
