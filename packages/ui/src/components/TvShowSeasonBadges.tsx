import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  CheckCircle,
  Download,
  Clock,
  Search,
  XCircle
} from 'lucide-react'
import { TorrentRequest } from '@/services/api'

interface TvShowSeasonBadgesProps {
  request: TorrentRequest
  onSeasonClick?: (seasonNumber: number) => void
  className?: string
}

interface SeasonSummary {
  seasonNumber: number
  totalEpisodes: number
  completedEpisodes: number
  downloadingEpisodes: number
  status: string
}

export function TvShowSeasonBadges({ request, onSeasonClick, className }: TvShowSeasonBadgesProps) {
  if (request.contentType !== 'TV_SHOW') {
    return null
  }

  // If no tvShowSeasons data is available but this is an ongoing request, show a placeholder
  if (!request.tvShowSeasons || request.tvShowSeasons.length === 0) {
    if (request.isOngoing) {
      return (
        <div className={`space-y-2 ${className}`}>
          <Badge variant="secondary" className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Ongoing Series
          </Badge>
          <p className="text-xs text-muted-foreground">
            Seasons will appear as episodes are discovered
          </p>
        </div>
      )
    }
    return null
  }

  const seasons: SeasonSummary[] = request.tvShowSeasons.map(season => ({
    seasonNumber: season.seasonNumber,
    totalEpisodes: season.totalEpisodes || 0,
    completedEpisodes: season.episodes?.filter(ep => ep.status === 'COMPLETED').length || 0,
    downloadingEpisodes: season.episodes?.filter(ep => ep.status === 'DOWNLOADING').length || 0,
    status: season.status,
  })).sort((a, b) => a.seasonNumber - b.seasonNumber)

  const getSeasonIcon = (season: SeasonSummary) => {
    if (season.completedEpisodes === season.totalEpisodes && season.totalEpisodes > 0) {
      return CheckCircle
    }
    if (season.downloadingEpisodes > 0) {
      return Download
    }
    if (season.completedEpisodes > 0 && season.completedEpisodes < season.totalEpisodes) {
      return Download // Partially downloaded - same icon but different color
    }
    if (season.status === 'SEARCHING') {
      return Search
    }
    if (season.status === 'FAILED') {
      return XCircle
    }
    return Clock
  }

  const getSeasonVariant = (season: SeasonSummary): "default" | "secondary" | "destructive" | "outline" => {
    if (season.completedEpisodes === season.totalEpisodes && season.totalEpisodes > 0) {
      return 'default' // Green for fully downloaded
    }
    if (season.downloadingEpisodes > 0) {
      return 'secondary' // Blue for currently downloading
    }
    if (season.completedEpisodes > 0 && season.completedEpisodes < season.totalEpisodes) {
      return 'outline' // Gray outline for partially downloaded
    }
    if (season.status === 'FAILED') {
      return 'destructive' // Red for failed
    }
    return 'secondary' // Gray for not downloaded/pending
  }

  const getSeasonProgress = (season: SeasonSummary): number => {
    if (season.totalEpisodes === 0) return 0
    return (season.completedEpisodes / season.totalEpisodes) * 100
  }

  const getSeasonText = (season: SeasonSummary): string => {
    if (season.totalEpisodes === 0) {
      return `S${season.seasonNumber}`
    }
    return `S${season.seasonNumber} (${season.completedEpisodes}/${season.totalEpisodes})`
  }

  const overallProgress = {
    totalEpisodes: seasons.reduce((sum, s) => sum + s.totalEpisodes, 0),
    completedEpisodes: seasons.reduce((sum, s) => sum + s.completedEpisodes, 0),
    downloadingEpisodes: seasons.reduce((sum, s) => sum + s.downloadingEpisodes, 0),
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Ongoing Series Progress */}
      {overallProgress.totalEpisodes > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Series Progress</span>
            <span>{overallProgress.completedEpisodes}/{overallProgress.totalEpisodes} episodes</span>
          </div>
          <Progress 
            value={(overallProgress.completedEpisodes / overallProgress.totalEpisodes) * 100} 
            className="h-1"
          />
        </div>
      )}

      {/* Season Badges */}
      <div className="flex flex-wrap gap-1">
        {seasons.map((season) => {
          const Icon = getSeasonIcon(season)
          const progress = getSeasonProgress(season)
          
          return (
            <div key={season.seasonNumber} className="relative">
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-1 hover:bg-muted"
                onClick={() => onSeasonClick?.(season.seasonNumber)}
              >
                <Badge 
                  variant={getSeasonVariant(season)}
                  className="flex items-center gap-1 cursor-pointer"
                >
                  <Icon className="h-3 w-3" />
                  {getSeasonText(season)}
                </Badge>
              </Button>
              
              {/* Mini progress bar for individual season */}
              {season.totalEpisodes > 0 && progress > 0 && progress < 100 && (
                <div className="absolute bottom-0 left-1 right-1 h-0.5 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}
            </div>
          )
        })}
        
        {/* Ongoing indicator */}
        {request.isOngoing && (
          <Badge variant="outline" className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Ongoing
          </Badge>
        )}
      </div>

      {/* Summary text for mobile */}
      <div className="md:hidden text-xs text-muted-foreground">
        {seasons.length} season{seasons.length !== 1 ? 's' : ''}
        {overallProgress.totalEpisodes > 0 && (
          <> • {overallProgress.completedEpisodes}/{overallProgress.totalEpisodes} episodes</>
        )}
        {overallProgress.downloadingEpisodes > 0 && (
          <> • {overallProgress.downloadingEpisodes} downloading</>
        )}
      </div>
    </div>
  )
}
