import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Download, Calendar, Clock, Star, User, Film, Search } from 'lucide-react'
import { SearchResult, MovieDetails } from '@/services/api'
import { useCreateDownload } from '@/hooks/useApi'
import { DownloadRequestModal } from './DownloadRequestModal'
import { TorrentSearchModal } from './TorrentSearchModal'
import { DownloadStatusBadge } from './DownloadStatusBadge'
import { useTorrentRequests } from '@/hooks/useTorrentRequests'
import { useToast } from '@/hooks/use-toast'

interface MovieDetailModalProps {
  movie: SearchResult | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MovieDetailModal({ movie, open, onOpenChange }: MovieDetailModalProps) {
  const [movieDetails, setMovieDetails] = useState<MovieDetails | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showDownloadModal, setShowDownloadModal] = useState(false)
  const [showTorrentSearchModal, setShowTorrentSearchModal] = useState(false)
  const { toast } = useToast()
  const createDownloadMutation = useCreateDownload()
  const { getRequestForItem, getRequestForShow, refreshRequests, requests } = useTorrentRequests()

  useEffect(() => {
    if (movie && open) {
      fetchMovieDetails()
    }
  }, [movie, open])

  // Force re-render when requests change to update the status display
  useEffect(() => {
    // This effect will trigger a re-render when requests change
  }, [requests])

  const fetchMovieDetails = async () => {
    if (!movie) return

    setIsLoading(true)
    try {
      // For now, we'll use the basic movie data since we need IMDb ID for detailed info
      // In a real implementation, you'd need to map TMDB ID to IMDb ID
      setMovieDetails({
        ...movie,
        type: 'movie',
        // Add some mock detailed data for now
        runtime: undefined,
        genre: undefined,
        director: undefined,
        actors: undefined,
        plot: movie.overview,
        rating: undefined,
        released: undefined,
      } as MovieDetails)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load movie details",
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
      description: `${movie?.title} has been added to the download queue`,
    })
    // Refresh the torrent requests to show the new status
    refreshRequests()
  }

  if (!movie) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">{movie.title}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Poster */}
          <div className="md:col-span-1">
            <div className="aspect-[2/3] bg-muted rounded-lg overflow-hidden">
              {movie.poster ? (
                <img
                  src={movie.poster}
                  alt={movie.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  <Film className="h-16 w-16" />
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
                  <Badge variant="secondary">
                    {movie.type === 'tv' ? 'TV Show' : 'Movie'}
                  </Badge>
                  {movie.year && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      {movie.year}
                    </div>
                  )}
                  {movieDetails?.runtime && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      {movieDetails.runtime} min
                    </div>
                  )}
                  {movieDetails?.rating && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Star className="h-4 w-4" />
                      {movieDetails.rating}/10
                    </div>
                  )}
                </div>

                {/* Genres */}
                {movieDetails?.genre && (
                  <div className="flex flex-wrap gap-1">
                    {movieDetails.genre.map((genre) => (
                      <Badge key={genre} variant="outline" className="text-xs">
                        {genre}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Overview */}
                {movie.overview && (
                  <div>
                    <h3 className="font-semibold mb-2">Overview</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {movie.overview}
                    </p>
                  </div>
                )}

                {/* Director & Cast */}
                {(movieDetails?.director || movieDetails?.actors) && (
                  <div className="space-y-2">
                    {movieDetails.director && (
                      <div className="flex items-start gap-2">
                        <User className="h-4 w-4 mt-0.5 text-muted-foreground" />
                        <div>
                          <span className="text-sm font-medium">Director: </span>
                          <span className="text-sm text-muted-foreground">
                            {movieDetails.director}
                          </span>
                        </div>
                      </div>
                    )}
                    {movieDetails.actors && (
                      <div className="flex items-start gap-2">
                        <User className="h-4 w-4 mt-0.5 text-muted-foreground" />
                        <div>
                          <span className="text-sm font-medium">Cast: </span>
                          <span className="text-sm text-muted-foreground">
                            {movieDetails.actors}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="pt-4 space-y-3">
                  {(() => {
                    // For TV shows, check for any existing request for this show (regardless of season/episode)
                    // For movies, check for exact match
                    const existingRequest = movie.type === 'tv'
                      ? getRequestForShow(movie.title, movie.year)
                      : getRequestForItem(movie.title, movie.year, undefined, undefined, 'MOVIE')

                    if (existingRequest) {
                      return (
                        <div className="space-y-3">
                          <div className="flex items-center justify-center">
                            <DownloadStatusBadge request={existingRequest} />
                          </div>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <Button
                              onClick={handleDownload}
                              className="flex-1 sm:flex-none"
                              disabled
                              variant="secondary"
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Already Requested
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
        item={movie}
        open={showDownloadModal}
        onOpenChange={setShowDownloadModal}
        onRequestCreated={handleDownloadRequestCreated}
      />

      {/* Torrent Search Modal */}
      <TorrentSearchModal
        searchItem={movie}
        isOpen={showTorrentSearchModal}
        onClose={() => setShowTorrentSearchModal(false)}
        onTorrentDownload={async (torrent) => {
          try {
            // Determine download type and URL
            const downloadUrl = torrent.magnetUri || torrent.link
            const downloadType = torrent.magnetUri ? 'magnet' : 'torrent'

            // Create download job using the mutation
            await createDownloadMutation.mutateAsync({
              url: downloadUrl,
              type: downloadType,
              name: torrent.title,
              destination: undefined // Use default destination
            })

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
