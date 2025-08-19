import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Download,
  Zap,
  HardDrive,
  Calendar,
  Star,
  CheckCircle,
  Loader2,
  AlertCircle,
  Users,
} from 'lucide-react'
import { apiService, TorrentSearchResult, TorrentRequest } from '@/services/api'
import { useToast } from '@/hooks/use-toast'

interface TorrentSelectionModalProps {
  isOpen: boolean
  onClose: () => void
  request: TorrentRequest | null
  onTorrentSelected?: () => void
}

export function TorrentSelectionModal({
  isOpen,
  onClose,
  request,
  onTorrentSelected,
}: TorrentSelectionModalProps) {
  const [searchResults, setSearchResults] = useState<TorrentSearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSelecting, setIsSelecting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    if (isOpen && request) {
      fetchSearchResults()
    }
  }, [isOpen, request])

  const fetchSearchResults = async () => {
    if (!request) return

    setIsLoading(true)
    setError(null)

    try {
      const response = await apiService.getSearchResults(request.id)
      if (response.success && response.data) {
        setSearchResults(response.data)
      } else {
        setError(response.error || 'Failed to fetch search results')
      }
    } catch (err) {
      setError('Failed to fetch search results')
      console.error('Error fetching search results:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectTorrent = async (result: TorrentSearchResult) => {
    if (!request) return

    setIsSelecting(result.id)

    try {
      const response = await apiService.selectTorrent(request.id, result.id)
      if (response.success) {
        toast({
          title: "Torrent Selected",
          description: `Download started for "${result.title}"`,
        })
        onTorrentSelected?.()
        onClose()
      } else {
        toast({
          title: "Selection Failed",
          description: response.error || "Failed to select torrent",
        })
      }
    } catch (error) {
      console.error('Error selecting torrent:', error)
      toast({
        title: "Selection Failed",
        description: "An error occurred while selecting the torrent",
      })
    } finally {
      setIsSelecting(null)
    }
  }

  const formatSize = (size: string) => {
    return size
  }

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString()
    } catch {
      return dateString
    }
  }

  const getQualityColor = (quality?: string) => {
    if (!quality) return 'secondary'
    const q = quality.toLowerCase()
    if (q.includes('2160p') || q.includes('4k')) return 'default'
    if (q.includes('1080p')) return 'default'
    if (q.includes('720p')) return 'secondary'
    return 'outline'
  }

  const getSeedersColor = (seeders: number) => {
    if (seeders >= 50) return 'text-green-600'
    if (seeders >= 10) return 'text-yellow-600'
    return 'text-red-600'
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Select Torrent</DialogTitle>
          <DialogDescription>
            {request && `Choose a torrent for "${request.title}"`}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          {isLoading && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          )}

          {error && (
            <Card className="border-destructive">
              <CardContent className="pt-6">
                <div className="flex items-center space-x-2 text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <span>{error}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {!isLoading && !error && searchResults.length === 0 && (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No search results found</p>
                <p className="text-sm">Try searching again or adjusting your criteria</p>
              </CardContent>
            </Card>
          )}

          {!isLoading && !error && searchResults.length > 0 && (
            <div className="space-y-4">
              {searchResults.map((result) => (
                <Card key={result.id} className={`${result.isSelected ? 'ring-2 ring-primary' : ''}`}>
                  <CardContent className="pt-4">
                    <div className="space-y-3">
                      {/* Title and Selection Status */}
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-medium text-sm leading-tight">{result.title}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {result.indexer}
                            </Badge>
                            {result.isSelected && (
                              <Badge variant="default" className="text-xs">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                {result.isAutoSelected ? 'Auto-Selected' : 'Selected'}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleSelectTorrent(result)}
                          disabled={isSelecting === result.id}
                          className="ml-4"
                        >
                          {isSelecting === result.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4" />
                          )}
                          {isSelecting === result.id ? 'Selecting...' : 'Select'}
                        </Button>
                      </div>

                      <Separator />

                      {/* Details Grid */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <HardDrive className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{formatSize(result.size)}</span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Zap className={`h-4 w-4 ${getSeedersColor(result.seeders)}`} />
                          <span className={getSeedersColor(result.seeders)}>
                            {result.seeders} seeders
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span>{result.leechers} leechers</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>{formatDate(result.publishDate)}</span>
                        </div>
                      </div>

                      {/* Quality and Format Badges */}
                      {(result.quality || result.format) && (
                        <div className="flex gap-2">
                          {result.quality && (
                            <Badge variant={getQualityColor(result.quality)} className="text-xs">
                              {result.quality}
                            </Badge>
                          )}
                          {result.format && (
                            <Badge variant="outline" className="text-xs">
                              {result.format}
                            </Badge>
                          )}
                        </div>
                      )}

                      {/* Ranking Score */}
                      {result.rankingScore > 0 && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Star className="h-3 w-3" />
                          <span>Score: {result.rankingScore.toFixed(1)}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
