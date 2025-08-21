import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { 
  CheckCircle, 
  Download, 
  Clock, 
  AlertCircle,
  Search,
  XCircle,
  Calendar,
  Play,
  RefreshCw
} from 'lucide-react'
import { apiService, TorrentRequest, TvShowSeason, TvShowEpisode } from '@/services/api'
import { useToast } from '@/hooks/use-toast'

interface TvShowSeasonModalProps {
  isOpen: boolean
  onClose: () => void
  request: TorrentRequest | null
  seasonNumber: number | null
}

export function TvShowSeasonModal({ isOpen, onClose, request, seasonNumber }: TvShowSeasonModalProps) {
  const [season, setSeason] = useState<TvShowSeason | null>(null)
  const [episodes, setEpisodes] = useState<TvShowEpisode[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (isOpen && request && seasonNumber !== null) {
      fetchSeasonData()
    }
  }, [isOpen, request, seasonNumber])

  const fetchSeasonData = async () => {
    if (!request || seasonNumber === null) return

    setIsLoading(true)
    try {
      // Fetch season details
      const seasonResponse = await apiService.getTvShowSeason(request.id, seasonNumber)
      if (seasonResponse.success && seasonResponse.data) {
        setSeason(seasonResponse.data)
      }

      // Fetch episodes
      const episodesResponse = await apiService.getTvShowEpisodes(request.id, seasonNumber)
      if (episodesResponse.success && episodesResponse.data) {
        setEpisodes(episodesResponse.data)
      }
    } catch (error) {
      console.error('Error fetching season data:', error)
      toast({
        title: "Error",
        description: "Failed to load season details",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const getEpisodeIcon = (episode: TvShowEpisode) => {
    switch (episode.status) {
      case 'COMPLETED': return CheckCircle
      case 'SEARCHING': return Search
      case 'FOUND': return AlertCircle
      case 'FAILED': return XCircle
      default: return Clock
    }
  }

  const getEpisodeVariant = (episode: TvShowEpisode): "default" | "secondary" | "destructive" | "outline" => {
    switch (episode.status) {
      case 'COMPLETED': return 'default'
      case 'FAILED': return 'destructive'
      default: return 'secondary'
    }
  }



  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Unknown'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const completedEpisodes = episodes.filter(ep => ep.status === 'COMPLETED').length
  const totalEpisodes = episodes.length
  const progress = totalEpisodes > 0 ? (completedEpisodes / totalEpisodes) * 100 : 0

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" />
            {request?.title} - Season {seasonNumber}
          </DialogTitle>
          <DialogDescription>
            Episode details and completion status
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-20 w-full" />
            <div className="space-y-2">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Season Summary */}
            {season && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant={season.status === 'COMPLETED' ? 'default' : 'secondary'}>
                      {season.status}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {completedEpisodes}/{totalEpisodes} episodes completed
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchSeasonData}
                    disabled={isLoading}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </div>
                
                {totalEpisodes > 0 && (
                  <div className="space-y-1">
                    <Progress value={progress} className="h-2" />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{progress.toFixed(1)}% complete</span>
                      <span>{totalEpisodes} total episodes</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Episodes List */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Episodes</h3>
              
              {episodes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No episodes found for this season</p>
                  <p className="text-sm">Episodes will appear as they become available</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {episodes.map((episode) => {
                    const Icon = getEpisodeIcon(episode)
                    
                    return (
                      <div
                        key={episode.id}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <Badge variant={getEpisodeVariant(episode)} className="flex items-center gap-1">
                            <Icon className="h-3 w-3" />
                            E{episode.episodeNumber}
                          </Badge>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                Episode {episode.episodeNumber}
                              </span>
                              {episode.title && (
                                <span className="text-muted-foreground truncate">
                                  - {episode.title}
                                </span>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                              {episode.airDate && (
                                <div className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {formatDate(episode.airDate)}
                                </div>
                              )}
                              <span>Status: {episode.status}</span>
                            </div>
                          </div>
                        </div>


                      </div>
                    )
                  })}
                </div>
              )}
            </div>


          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
