import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Download, Calendar, Star, User, Building, Gamepad2, Search } from 'lucide-react'
import { SearchResult, GameDetails, apiService } from '@/services/api'
import { useCreateDownload } from '@/hooks/useApi'
import { DownloadRequestModal } from './DownloadRequestModal'
import { TorrentSearchModal } from './TorrentSearchModal'
import { DownloadStatusBadge } from './DownloadStatusBadge'
import { useTorrentRequests } from '@/hooks/useTorrentRequests'
import { useToast } from '@/hooks/use-toast'

interface GameDetailModalProps {
  game: SearchResult | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function GameDetailModal({ game, open, onOpenChange }: GameDetailModalProps) {
  const [gameDetails, setGameDetails] = useState<GameDetails | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showDownloadModal, setShowDownloadModal] = useState(false)
  const [showTorrentSearchModal, setShowTorrentSearchModal] = useState(false)
  const { getRequestForItem, refreshRequests } = useTorrentRequests()
  const { toast } = useToast()
  const createDownloadMutation = useCreateDownload()

  const existingRequest = game ? getRequestForItem(game.title, game.year, undefined, undefined, 'GAME' as any) : undefined

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

  const handleDownload = () => {
    setShowDownloadModal(true)
  }

  const handleTorrentSearch = () => {
    setShowTorrentSearchModal(true)
  }

  const handleDownloadRequestCreated = () => {
    toast({
      title: "Download Requested",
      description: `${game?.title} has been added to the download queue`,
    })
    // Refresh the torrent requests to show the new status
    refreshRequests()
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

                {/* Download Actions */}
                <div className="pt-4">
                  {(() => {
                    if (existingRequest) {
                      return (
                        <div className="space-y-2 mb-4">
                          <DownloadStatusBadge
                            request={existingRequest}
                            className="w-full justify-center"
                          />
                          <Button
                            onClick={handleTorrentSearch}
                            variant="outline"
                            className="w-full"
                          >
                            <Search className="h-4 w-4 mr-2" />
                            View Torrents
                          </Button>
                        </div>
                      )
                    } else {
                      return (
                        <div className="flex flex-col sm:flex-row gap-2">
                          <Button
                            onClick={handleDownload}
                            className="flex-1 sm:flex-none"
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Request Download
                          </Button>
                          <Button
                            onClick={handleTorrentSearch}
                            variant="outline"
                            className="flex-1 sm:flex-none"
                          >
                            <Search className="h-4 w-4 mr-2" />
                            View Torrents
                          </Button>
                        </div>
                      )
                    }
                  })()}
                </div>
              </>
            )}
          </div>
        </div>
      </DialogContent>

      {/* Download Request Modal */}
      <DownloadRequestModal
        item={game}
        open={showDownloadModal}
        onOpenChange={setShowDownloadModal}
        onRequestCreated={handleDownloadRequestCreated}
      />

      {/* Torrent Search Modal */}
      <TorrentSearchModal
        isOpen={showTorrentSearchModal}
        onClose={() => setShowTorrentSearchModal(false)}
        searchItem={game}
        onTorrentDownload={async (torrent) => {
          try {
            let requestId = existingRequest?.id

            // First, create a torrent request if one doesn't exist
            if (!existingRequest) {
              const gameDetails = gameDetail as GameDetails
              const requestDto = {
                title: game.title,
                year: game.year,
                igdbId: parseInt(game.id),
                platform: gameDetails?.platforms?.[0] || undefined,
                genre: gameDetails?.genre?.[0] || undefined,
                preferredQualities: ['HD_1080P'],
                preferredFormats: ['X265'],
                minSeeders: 1,
                maxSizeGB: 50,
                priority: 5,
              }

              const response = await apiService.requestGameDownload(requestDto)
              if (response.data) {
                requestId = response.data.id
              }

              // Refresh requests to get the new request
              refreshRequests()
            }

            // Determine download type and URL
            const downloadUrl = torrent.magnetUri || torrent.link
            const downloadType = torrent.magnetUri ? 'magnet' : 'torrent'

            // Create download job using the mutation
            const downloadResult = await createDownloadMutation.mutateAsync({
              url: downloadUrl,
              type: downloadType,
              name: torrent.title,
              destination: undefined // Use default destination
            })

            // If we have a request ID, explicitly link the download to the request
            if (requestId && downloadResult.id) {
              try {
                await apiService.linkDownloadToRequest(requestId, downloadResult.id.toString(), downloadResult.aria2Gid, torrent.title)
              } catch (linkError) {
                console.warn('Failed to link download to request:', linkError)
                // Don't fail the whole operation if linking fails
              }
            }

            toast({
              title: "Download Started",
              description: `Successfully started downloading "${torrent.title}"`,
            })

            setShowTorrentSearchModal(false)
          } catch (error) {
            console.error('Failed to start download:', error)
            toast({
              title: "Download Failed",
              description: "Failed to start the download. Please try again.",
            })
          }
        }}
      />
    </Dialog>
  )
}
