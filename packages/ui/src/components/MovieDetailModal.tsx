import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Download, Calendar, Clock, Star, User, Film, Search } from 'lucide-react'
import { MovieDetails, apiService } from '@/services/api'
import { useCreateDownload } from '@/hooks/useApi'
import { DownloadRequestModal } from './DownloadRequestModal'
import { TorrentSearchModal } from './TorrentSearchModal'
import { DownloadStatusBadge } from './DownloadStatusBadge'
import { useTorrentRequests } from '@/hooks/useTorrentRequests'
import { useToast } from '@/hooks/use-toast'

interface MovieDetailModalProps {
  contentType: 'movie' | 'tv'
  contentId: string
  title: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MovieDetailModal({ contentType, contentId, title, open, onOpenChange }: MovieDetailModalProps) {
  const [movieDetails, setMovieDetails] = useState<MovieDetails | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showDownloadModal, setShowDownloadModal] = useState(false)
  const [showTorrentSearchModal, setShowTorrentSearchModal] = useState(false)
  const { toast } = useToast()
  const createDownloadMutation = useCreateDownload()
  const { getRequestForItem, getRequestForShow, refreshRequests, requests } = useTorrentRequests()

  useEffect(() => {
    if (contentId && open) {
      fetchMovieDetails()
    }
  }, [contentId, open])

  // Force re-render when requests change to update the status display
  useEffect(() => {
    // This effect will trigger a re-render when requests change
  }, [requests])

  const fetchMovieDetails = async () => {
    if (!contentId) return

    setIsLoading(true)
    try {
      // Fetch complete details from the appropriate API
      if (contentType === 'movie') {
        const response = await apiService.getMovieDetails(contentId);
        if (response.success && response.data) {
          setMovieDetails(response.data);
          return;
        } else {
          console.log('Failed to fetch movie details from API:', response.error);
        }
      } else if (contentType === 'tv') {
        const response = await apiService.getTvShowDetails(contentId);
        if (response.success && response.data) {
          // Convert TvShowDetails to MovieDetails for compatibility with the modal
          const tvShowAsMovie: MovieDetails = {
            ...response.data,
            type: 'movie', // Override type for modal compatibility
            runtime: undefined, // TV shows don't have runtime like movies
            director: response.data.creator, // Use creator as director
            actors: undefined, // TV shows don't have the same actor structure
            plot: response.data.overview,
            released: response.data.year?.toString(),
          };
          setMovieDetails(tvShowAsMovie);
          return;
        } else {
          console.log('Failed to fetch TV show details from API:', response.error);
        }
      }

      // Fallback: Create basic movie details if API calls fail
      const tmdbId = parseInt(contentId);
      setMovieDetails({
        id: contentId,
        title: title,
        year: undefined,
        poster: undefined,
        overview: undefined,
        type: 'movie',
        tmdbId: isNaN(tmdbId) ? undefined : tmdbId,
        runtime: undefined,
        genre: undefined,
        director: undefined,
        actors: undefined,
        plot: undefined,
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
      description: `${title} has been added to the download queue`,
    })
    // Refresh the torrent requests to show the new status
    refreshRequests()
  }

  if (!contentId) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">{movieDetails?.title || title}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Poster */}
          <div className="md:col-span-1">
            <div className="aspect-[2/3] bg-muted rounded-lg overflow-hidden">
              {movieDetails?.poster ? (
                <img
                  src={movieDetails.poster}
                  alt={movieDetails.title || title}
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
                    {contentType === 'tv' ? 'TV Show' : 'Movie'}
                  </Badge>
                  {movieDetails?.year && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      {movieDetails.year}
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
                {(movieDetails?.overview || movieDetails?.plot) && (
                  <div>
                    <h3 className="font-semibold mb-2">Overview</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {movieDetails.overview || movieDetails.plot}
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
                    const existingRequest = contentType === 'tv'
                      ? getRequestForShow(movieDetails?.title || title, movieDetails?.year)
                      : getRequestForItem(movieDetails?.title || title, movieDetails?.year, undefined, undefined, 'MOVIE')

                    if (existingRequest) {
                      return (
                        <div className="space-y-3">
                          <div className="flex mb-4">
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
        item={movieDetails}
        open={showDownloadModal}
        onOpenChange={setShowDownloadModal}
        onRequestCreated={handleDownloadRequestCreated}
      />

      {/* Torrent Search Modal */}
      <TorrentSearchModal
        searchItem={movieDetails}
        isOpen={showTorrentSearchModal}
        onClose={() => setShowTorrentSearchModal(false)}
        onTorrentDownload={async (torrent) => {
          try {
            // Determine existing request based on content type
            const existingRequest = contentType === 'tv'
              ? getRequestForShow(movieDetails?.title || title, movieDetails?.year)
              : getRequestForItem(movieDetails?.title || title, movieDetails?.year, undefined, undefined, 'MOVIE')

            let requestId = existingRequest?.id

            // First, create a torrent request if one doesn't exist
            if (!existingRequest) {
              const movieDetailsData = movieDetails as MovieDetails
              const requestDto = {
                title: movieDetails?.title || title,
                year: movieDetails?.year,
                imdbId: movieDetailsData?.imdbId || undefined,
                tmdbId: movieDetailsData?.tmdbId || undefined,
                preferredQualities: ['HD_1080P', 'UHD_4K'],
                preferredFormats: ['X264', 'X265'],
                minSeeders: 5,
                maxSizeGB: contentType === 'tv' ? 15 : 20, // Smaller default for TV shows
                priority: 5,
              }

              // Create appropriate request type
              let response
              if (contentType === 'tv') {
                response = await apiService.requestTvShowDownload(requestDto)
              } else {
                response = await apiService.requestMovieDownload(requestDto)
              }
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
