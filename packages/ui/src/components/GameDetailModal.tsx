import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Download, Calendar, Star, User, Building, Gamepad2 } from 'lucide-react'
import { SearchResult, GameDetails, apiService } from '@/services/api'
import { useToast } from '@/hooks/use-toast'

interface GameDetailModalProps {
  game: SearchResult | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function GameDetailModal({ game, open, onOpenChange }: GameDetailModalProps) {
  const [gameDetails, setGameDetails] = useState<GameDetails | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (game && open) {
      fetchGameDetails()
    }
  }, [game, open])

  const fetchGameDetails = async () => {
    if (!game) return

    setIsLoading(true)
    try {
      const response = await apiService.getGameDetails(game.id)
      if (response.success && response.data) {
        setGameDetails(response.data)
      } else {
        // Fallback to basic game data
        setGameDetails({
          ...game,
          type: 'game',
          igdbId: parseInt(game.id),
          platforms: undefined,
          genre: undefined,
          developer: undefined,
          publisher: undefined,
          releaseDate: undefined,
          rating: undefined,
          screenshots: undefined,
        } as GameDetails)
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load game details",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDownload = async () => {
    if (!gameDetails) return

    setIsDownloading(true)
    try {
      // TODO: Implement actual download functionality
      // This would typically create a download job
      toast({
        title: "Download Started",
        description: `Added "${gameDetails.title}" to download queue`,
      })
      onOpenChange(false)
    } catch (error) {
      toast({
        title: "Download Failed",
        description: "Failed to start download",
      })
    } finally {
      setIsDownloading(false)
    }
  }

  if (!game) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">{game.title}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Cover Art */}
          <div className="md:col-span-1">
            <div className="aspect-[2/3] bg-muted rounded-lg overflow-hidden">
              {game.poster ? (
                <img
                  src={game.poster}
                  alt={game.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  <Gamepad2 className="h-16 w-16" />
                </div>
              )}
            </div>
          </div>

          {/* Details */}
          <div className="md:col-span-2 space-y-4">
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ) : (
              <>
                {/* Basic Info */}
                <div className="flex flex-wrap gap-2 items-center">
                  <Badge variant="secondary">Game</Badge>
                  {game.year && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      {game.year}
                    </div>
                  )}
                  {gameDetails?.rating && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Star className="h-4 w-4" />
                      {gameDetails.rating}/10
                    </div>
                  )}
                </div>

                {/* Platforms */}
                {gameDetails?.platforms && (
                  <div className="flex flex-wrap gap-1">
                    {gameDetails.platforms.map((platform) => (
                      <Badge key={platform} variant="outline" className="text-xs">
                        {platform}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Genres */}
                {gameDetails?.genre && (
                  <div className="flex flex-wrap gap-1">
                    {gameDetails.genre.map((genre) => (
                      <Badge key={genre} variant="outline" className="text-xs">
                        {genre}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Overview */}
                {game.overview && (
                  <div>
                    <h3 className="font-semibold mb-2">Overview</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {game.overview}
                    </p>
                  </div>
                )}

                {/* Developer & Publisher */}
                {(gameDetails?.developer || gameDetails?.publisher) && (
                  <div className="space-y-2">
                    {gameDetails.developer && (
                      <div className="flex items-start gap-2">
                        <User className="h-4 w-4 mt-0.5 text-muted-foreground" />
                        <div>
                          <span className="text-sm font-medium">Developer: </span>
                          <span className="text-sm text-muted-foreground">
                            {gameDetails.developer}
                          </span>
                        </div>
                      </div>
                    )}
                    {gameDetails.publisher && (
                      <div className="flex items-start gap-2">
                        <Building className="h-4 w-4 mt-0.5 text-muted-foreground" />
                        <div>
                          <span className="text-sm font-medium">Publisher: </span>
                          <span className="text-sm text-muted-foreground">
                            {gameDetails.publisher}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Screenshots */}
                {gameDetails?.screenshots && gameDetails.screenshots.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-2">Screenshots</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {gameDetails.screenshots.slice(0, 4).map((screenshot, index) => (
                        <div key={index} className="aspect-video bg-muted rounded overflow-hidden">
                          <img
                            src={screenshot}
                            alt={`${gameDetails.title} screenshot ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Download Button */}
                <div className="pt-4">
                  <Button 
                    onClick={handleDownload} 
                    disabled={isDownloading}
                    className="w-full md:w-auto"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {isDownloading ? 'Adding to Queue...' : 'Download'}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
