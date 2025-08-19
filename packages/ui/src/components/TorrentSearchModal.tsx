import React, { useState, useEffect } from 'react'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Download,
  Zap,
  HardDrive,
  Calendar,
  Star,
  Loader2,
  AlertCircle,
  ExternalLink,
  Users,
  Search,
  Magnet,
} from 'lucide-react'
import { apiService, TorrentResult, SearchResult, GamePlatform } from '@/services/api'
import { useToast } from '@/hooks/use-toast'

interface TorrentSearchModalProps {
  isOpen: boolean
  onClose: () => void
  searchItem: SearchResult | null
  onTorrentDownload?: (torrent: TorrentResult) => void
}

export function TorrentSearchModal({
  isOpen,
  onClose,
  searchItem,
  onTorrentDownload,
}: TorrentSearchModalProps) {
  const [searchResults, setSearchResults] = useState<TorrentResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [minSeeders, setMinSeeders] = useState<number>(5)
  const [maxSize, setMaxSize] = useState<string>('')
  const [quality, setQuality] = useState<string>('')
  const [format, setFormat] = useState<string>('')
  // Game-specific filters
  const [platform, setPlatform] = useState<string>('any')
  const [genre, setGenre] = useState<string>('any')
  const [platformOptions, setPlatformOptions] = useState<GamePlatform[]>([])
  const [loadingPlatforms, setLoadingPlatforms] = useState<boolean>(false)
  const { toast } = useToast()

  const isGame = searchItem?.type === 'game'

  // Set appropriate default minSeeders based on content type
  useEffect(() => {
    if (isGame) {
      setMinSeeders(1) // Games often have lower seeder counts
    } else {
      setMinSeeders(5) // Movies/TV can have higher seeder requirements
    }
  }, [isGame])

  // Load platform options for games
  useEffect(() => {
    if (isOpen && isGame && platformOptions.length === 0) {
      setLoadingPlatforms(true)
      apiService.getGamePlatforms()
        .then(response => {
          if (response.success) {
            setPlatformOptions(response.data)
          }
        })
        .catch(error => {
          console.error('Failed to load platform options:', error)
          toast({
            title: "Error",
            description: "Failed to load platform options",
            variant: "destructive",
          })
        })
        .finally(() => {
          setLoadingPlatforms(false)
        })
    }
  }, [isOpen, isGame, platformOptions.length, toast])

  useEffect(() => {
    if (isOpen && searchItem) {
      // Initialize search query - for games, don't include year as it makes searches too specific
      const initialQuery = isGame
        ? searchItem.title
        : searchItem.year
        ? `${searchItem.title} ${searchItem.year}`
        : searchItem.title
      setSearchQuery(initialQuery)

      // Reset filters
      setMinSeeders(isGame ? 1 : 5)
      setMaxSize('')
      setQuality('')
      setFormat('')
      setPlatform('any')
      setGenre('any')

      // Auto-search when modal opens
      performSearch(initialQuery)
    } else if (!isOpen) {
      // Reset state when modal closes
      setSearchResults([])
      setError(null)
    }
  }, [isOpen, searchItem])

  const performSearch = async (query?: string) => {
    const searchTerm = query || searchQuery
    if (!searchTerm.trim()) {
      toast({
        title: "Search query required",
        description: "Please enter a search term",
      })
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const baseSearchParams = {
        query: searchTerm.trim(),
        minSeeders: minSeeders > 0 ? minSeeders : undefined,
        maxSize: maxSize || undefined,
        limit: 50,
      }

      const searchParams = isGame
        ? baseSearchParams
        : {
            ...baseSearchParams,
            quality: quality && quality !== 'any' ? [quality] : undefined,
            format: format && format !== 'any' ? [format] : undefined,
          }

      let response
      if (searchItem?.type === 'movie') {
        response = await apiService.searchMovieTorrents({
          ...searchParams,
          year: searchItem.year,
          imdbId: searchItem.imdbId,
        })
      } else if (searchItem?.type === 'tv') {
        response = await apiService.searchTvTorrents({
          ...searchParams,
          year: searchItem.year,
          imdbId: searchItem.imdbId,
        })
      } else if (searchItem?.type === 'game') {
        response = await apiService.searchGameTorrents({
          ...searchParams,
          platform: platform && platform !== 'any' ? platform : undefined,
          igdbId: parseInt(searchItem.id),
        })
      } else {
        response = await apiService.searchTorrents(searchParams)
      }

      if (response.success && response.data) {
        setSearchResults(response.data)
        if (response.data.length === 0) {
          toast({
            title: "No torrents found",
            description: `No torrents found for "${searchTerm}"`,
          })
        }
      } else {
        setError(response.error || 'Search failed')
        toast({
          title: "Search failed",
          description: response.error || 'An error occurred while searching for torrents',
          variant: "destructive",
        })
      }
    } catch (err) {
      setError('Search failed')
      toast({
        title: "Search failed",
        description: 'An error occurred while searching for torrents',
        variant: "destructive",
      })
      console.error('Torrent search error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSearch = () => {
    performSearch()
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  const handleDownload = (torrent: TorrentResult) => {
    onTorrentDownload?.(torrent)
    toast({
      title: "Download initiated",
      description: `Starting download for "${torrent.title}"`,
    })
  }

  const formatSize = (size?: string) => {
    return size || 'Unknown'
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
    if (quality.includes('4K') || quality.includes('2160p')) return 'destructive'
    if (quality.includes('1080p')) return 'default'
    if (quality.includes('720p')) return 'outline'
    return 'secondary'
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>
            Search {isGame ? 'Game' : searchItem?.type === 'movie' ? 'Movie' : 'TV'} Torrents
          </DialogTitle>
          <DialogDescription>
            {searchItem && `Find ${isGame ? 'game' : searchItem.type === 'movie' ? 'movie' : 'TV show'} torrents for "${searchItem.title}"`}
          </DialogDescription>
        </DialogHeader>

        {/* Search Controls */}
        <div className="space-y-4 border-b pb-4">
          <div className="flex space-x-2">
            <div className="flex-1">
              <Input
                type="text"
                placeholder="Search for torrents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyPress}
              />
            </div>
            <Button onClick={handleSearch} disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              Search
            </Button>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="minSeeders">Min Seeders</Label>
              <Input
                id="minSeeders"
                type="number"
                value={minSeeders}
                onChange={(e) => setMinSeeders(parseInt(e.target.value) || 0)}
                min="0"
              />
            </div>
            <div>
              <Label htmlFor="maxSize">Max Size</Label>
              <Input
                id="maxSize"
                placeholder="e.g., 2GB"
                value={maxSize}
                onChange={(e) => setMaxSize(e.target.value)}
              />
            </div>
            {isGame ? (
              <>
                <div>
                  <Label htmlFor="platform">Platform</Label>
                  <Select value={platform} onValueChange={setPlatform}>
                    <SelectTrigger>
                      <SelectValue placeholder="Any platform" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any platform</SelectItem>
                      {loadingPlatforms ? (
                        <SelectItem value="loading" disabled>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Loading platforms...
                        </SelectItem>
                      ) : (
                        platformOptions.map((platform) => (
                          <SelectItem key={platform.id} value={platform.id}>
                            {platform.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="genre">Genre</Label>
                  <Select value={genre} onValueChange={setGenre}>
                    <SelectTrigger>
                      <SelectValue placeholder="Any genre" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any genre</SelectItem>
                      <SelectItem value="Action">Action</SelectItem>
                      <SelectItem value="Adventure">Adventure</SelectItem>
                      <SelectItem value="RPG">RPG</SelectItem>
                      <SelectItem value="Strategy">Strategy</SelectItem>
                      <SelectItem value="Shooter">Shooter</SelectItem>
                      <SelectItem value="Simulation">Simulation</SelectItem>
                      <SelectItem value="Sports">Sports</SelectItem>
                      <SelectItem value="Racing">Racing</SelectItem>
                      <SelectItem value="Puzzle">Puzzle</SelectItem>
                      <SelectItem value="Indie">Indie</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : (
              <>
                <div>
                  <Label htmlFor="quality">Quality</Label>
                  <Select value={quality} onValueChange={setQuality}>
                    <SelectTrigger>
                      <SelectValue placeholder="Any quality" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any quality</SelectItem>
                      <SelectItem value="4K">4K</SelectItem>
                      <SelectItem value="1080p">1080p</SelectItem>
                      <SelectItem value="720p">720p</SelectItem>
                      <SelectItem value="SD">SD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="format">Format</Label>
                  <Select value={format} onValueChange={setFormat}>
                    <SelectTrigger>
                      <SelectValue placeholder="Any format" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any format</SelectItem>
                      <SelectItem value="x265">x265</SelectItem>
                      <SelectItem value="x264">x264</SelectItem>
                      <SelectItem value="HEVC">HEVC</SelectItem>
                      <SelectItem value="AV1">AV1</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Results */}
        <ScrollArea className="flex-1 max-h-[60vh]">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">Searching for torrents...</span>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center py-8 text-destructive">
              <AlertCircle className="h-5 w-5 mr-2" />
              <span>{error}</span>
            </div>
          )}

          {!isLoading && !error && searchResults.length === 0 && (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <span>No torrents found. Try adjusting your search criteria.</span>
            </div>
          )}

          {!isLoading && !error && searchResults.length > 0 && (
            <div className="space-y-4">
              {searchResults.map((result) => (
                <Card key={result.id}>
                  <CardContent className="pt-4">
                    <div className="space-y-3">
                      {/* Title and Actions */}
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-medium text-sm leading-tight">{result.title}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {result.indexer}
                            </Badge>
                            {result.quality && (
                              <Badge variant={getQualityColor(result.quality)} className="text-xs">
                                {result.quality}
                              </Badge>
                            )}
                            {result.format && (
                              <Badge variant="secondary" className="text-xs">
                                {result.format}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {result.magnetUri && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => window.open(result.magnetUri, '_blank')}
                            >
                              <Magnet className="h-3 w-3 mr-1" />
                              Magnet
                            </Button>
                          )}
                          <Button
                            size="sm"
                            onClick={() => handleDownload(result)}
                          >
                            <Download className="h-3 w-3 mr-1" />
                            Download
                          </Button>
                        </div>
                      </div>

                      <Separator />

                      {/* Stats */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <HardDrive className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Size:</span>
                          <span className="font-medium">{formatSize(result.size)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Zap className="h-4 w-4 text-green-500" />
                          <span className="text-muted-foreground">Seeders:</span>
                          <span className="font-medium text-green-600">{result.seeders}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-orange-500" />
                          <span className="text-muted-foreground">Leechers:</span>
                          <span className="font-medium text-orange-600">{result.leechers}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Date:</span>
                          <span className="font-medium">{formatDate(result.publishDate)}</span>
                        </div>
                      </div>

                      {result.rankingScore && (
                        <div className="flex items-center gap-2 text-sm">
                          <Star className="h-4 w-4 text-yellow-500" />
                          <span className="text-muted-foreground">Score:</span>
                          <span className="font-medium">{result.rankingScore.toFixed(1)}</span>
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
