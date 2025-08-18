import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Download, Calendar, Clock, Star, User, Film } from 'lucide-react'
import { SearchResult, MovieDetails } from '@/services/api'
import { useToast } from '@/hooks/use-toast'

interface MovieDetailModalProps {
  movie: SearchResult | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MovieDetailModal({ movie, open, onOpenChange }: MovieDetailModalProps) {
  const [movieDetails, setMovieDetails] = useState<MovieDetails | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (movie && open) {
      fetchMovieDetails()
    }
  }, [movie, open])

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

  const handleDownload = async () => {
    if (!movieDetails) return

    setIsDownloading(true)
    try {
      // TODO: Implement actual download functionality
      // This would typically create a download job
      toast({
        title: "Download Started",
        description: `Added "${movieDetails.title}" to download queue`,
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
