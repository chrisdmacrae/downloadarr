import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Search, Loader2, Film, Tv, Gamepad2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { apiService, HttpDownloadRequest, MatchMetadataDto, SearchResult, GamePlatform } from '@/services/api'
import { useToast } from '@/hooks/use-toast'

interface HttpMetadataMatchModalProps {
  request: HttpDownloadRequest | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onMetadataMatched?: (request: HttpDownloadRequest) => void
}

export function HttpMetadataMatchModal({ request, open, onOpenChange, onMetadataMatched }: HttpMetadataMatchModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null)
  const [contentType, setContentType] = useState<'MOVIE' | 'TV_SHOW' | 'GAME'>('MOVIE')
  const [searchQuery, setSearchQuery] = useState('')
  const [platformOptions, setPlatformOptions] = useState<GamePlatform[]>([])
  const [selectedPlatform, setSelectedPlatform] = useState<string>('')
  const [customMetadata, setCustomMetadata] = useState({
    title: '',
    year: '',
    season: '',
    episode: '',
  })
  const [useCustomMetadata, setUseCustomMetadata] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (open && request) {
      // Try to extract a search query from the filename or URL
      const filename = request.filename || request.url.split('/').pop() || ''
      const cleanedFilename = filename
        .replace(/\.[^/.]+$/, '') // Remove file extension
        .replace(/[._-]/g, ' ') // Replace separators with spaces
        .replace(/\b(1080p|720p|480p|4k|x264|x265|hevc|web|dl|bluray|dvdrip|cam|ts|hdrip)\b/gi, '') // Remove quality indicators
        .trim()
      
      setSearchQuery(cleanedFilename)
      setSearchResults([])
      setSelectedResult(null)
      setUseCustomMetadata(false)
      setCustomMetadata({ title: '', year: '', season: '', episode: '' })
    }
  }, [open, request])

  useEffect(() => {
    if (contentType === 'GAME') {
      loadPlatformOptions()
    }
  }, [contentType])

  const loadPlatformOptions = async () => {
    try {
      const response = await apiService.getGamePlatforms()
      setPlatformOptions(response.data || [])
    } catch (error) {
      console.error('Error loading platforms:', error)
    }
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast({
        title: "Search query required",
        description: "Please enter a search term",
        variant: "destructive",
      })
      return
    }

    setIsSearching(true)
    setSearchResults([])

    try {
      let results: SearchResult[] = []

      if (contentType === 'MOVIE') {
        const response = await apiService.searchMovies(searchQuery)
        results = response.data || []
      } else if (contentType === 'TV_SHOW') {
        const response = await apiService.searchTvShows(searchQuery)
        results = response.data || []
      } else if (contentType === 'GAME') {
        const response = await apiService.searchGames(searchQuery)
        results = response.data || []
      }

      setSearchResults(results)

      if (results.length === 0) {
        toast({
          title: "No results found",
          description: "Try a different search term or use custom metadata",
        })
      }
    } catch (error) {
      console.error('Error searching:', error)
      toast({
        title: "Search failed",
        description: "An error occurred while searching. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSearching(false)
    }
  }

  const handleMatchMetadata = async () => {
    if (!request) return

    if (!useCustomMetadata && !selectedResult) {
      toast({
        title: "No selection made",
        description: "Please select a search result or use custom metadata",
        variant: "destructive",
      })
      return
    }

    if (useCustomMetadata && !customMetadata.title.trim()) {
      toast({
        title: "Title required",
        description: "Please enter a title for custom metadata",
        variant: "destructive",
      })
      return
    }

    if (contentType === 'GAME' && !useCustomMetadata && !selectedPlatform) {
      toast({
        title: "Platform required",
        description: "Please select a platform for the game",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)

    try {
      let matchDto: MatchMetadataDto

      if (useCustomMetadata) {
        matchDto = {
          contentType,
          title: customMetadata.title.trim(),
          year: customMetadata.year ? parseInt(customMetadata.year) : undefined,
          season: customMetadata.season ? parseInt(customMetadata.season) : undefined,
          episode: customMetadata.episode ? parseInt(customMetadata.episode) : undefined,
          platform: contentType === 'GAME' ? selectedPlatform : undefined,
        }
      } else if (selectedResult) {
        matchDto = {
          contentType,
          title: selectedResult.title,
          year: selectedResult.year,
          tmdbId: selectedResult.type !== 'game' ? parseInt(selectedResult.id) : undefined,
          igdbId: selectedResult.type === 'game' ? parseInt(selectedResult.id) : undefined,
          platform: contentType === 'GAME' ? selectedPlatform : undefined,
        }
      } else {
        return
      }

      const response = await apiService.matchHttpDownloadMetadata(request.id, matchDto)

      if (response.success) {
        toast({
          title: "Metadata Matched",
          description: `Successfully matched metadata for "${matchDto.title}". You can now start the download.`,
        })
        onMetadataMatched?.(response.data)
        onOpenChange(false)
      } else {
        toast({
          title: "Matching Failed",
          description: "Failed to match metadata",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Error matching metadata:', error)
      toast({
        title: "Matching Failed",
        description: "An error occurred while matching metadata",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (!request) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Match Metadata for HTTP Download
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Request Info */}
          <div className="space-y-2">
            <Label>Download Request</Label>
            <div className="p-3 bg-muted rounded-lg">
              <p className="font-medium">{request.filename || 'Unknown filename'}</p>
              <p className="text-sm text-muted-foreground truncate">{request.url}</p>
            </div>
          </div>

          <Separator />

          {/* Content Type Selection */}
          <div className="space-y-2">
            <Label>Content Type</Label>
            <Select value={contentType} onValueChange={(value: any) => setContentType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MOVIE">
                  <div className="flex items-center gap-2">
                    <Film className="h-4 w-4" />
                    Movie
                  </div>
                </SelectItem>
                <SelectItem value="TV_SHOW">
                  <div className="flex items-center gap-2">
                    <Tv className="h-4 w-4" />
                    TV Show
                  </div>
                </SelectItem>
                <SelectItem value="GAME">
                  <div className="flex items-center gap-2">
                    <Gamepad2 className="h-4 w-4" />
                    Game
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Search Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <Label htmlFor="search">Search Query</Label>
                <Input
                  id="search"
                  placeholder="Enter title to search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
              </div>
              <Button onClick={handleSearch} disabled={isSearching || !searchQuery.trim()}>
                {isSearching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="space-y-2">
                <Label>Search Results</Label>
                <ScrollArea className="h-48 border rounded-lg">
                  <div className="p-2 space-y-2">
                    {searchResults.map((result) => (
                      <Card
                        key={result.id}
                        className={`cursor-pointer transition-colors ${
                          selectedResult?.id === result.id ? 'ring-2 ring-primary' : 'hover:bg-muted'
                        }`}
                        onClick={() => setSelectedResult(result)}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{result.title}</p>
                              {result.year && <p className="text-sm text-muted-foreground">{result.year}</p>}
                            </div>
                            <Badge variant="outline">{result.type}</Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Platform Selection for Games */}
            {contentType === 'GAME' && selectedResult && (
              <div className="space-y-2">
                <Label>Platform</Label>
                <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select platform" />
                  </SelectTrigger>
                  <SelectContent>
                    {platformOptions.map((platform) => (
                      <SelectItem key={platform.id} value={platform.name}>
                        {platform.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <Separator />

          {/* Custom Metadata Option */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="useCustom"
                checked={useCustomMetadata}
                onChange={(e) => setUseCustomMetadata(e.target.checked)}
              />
              <Label htmlFor="useCustom">Use custom metadata instead</Label>
            </div>

            {useCustomMetadata && (
              <div className="space-y-4 p-4 border rounded-lg">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="customTitle">Title *</Label>
                    <Input
                      id="customTitle"
                      placeholder="Enter title"
                      value={customMetadata.title}
                      onChange={(e) => setCustomMetadata(prev => ({ ...prev, title: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="customYear">Year</Label>
                    <Input
                      id="customYear"
                      placeholder="2023"
                      value={customMetadata.year}
                      onChange={(e) => setCustomMetadata(prev => ({ ...prev, year: e.target.value }))}
                    />
                  </div>
                </div>

                {contentType === 'TV_SHOW' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="customSeason">Season</Label>
                      <Input
                        id="customSeason"
                        placeholder="1"
                        value={customMetadata.season}
                        onChange={(e) => setCustomMetadata(prev => ({ ...prev, season: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="customEpisode">Episode</Label>
                      <Input
                        id="customEpisode"
                        placeholder="1"
                        value={customMetadata.episode}
                        onChange={(e) => setCustomMetadata(prev => ({ ...prev, episode: e.target.value }))}
                      />
                    </div>
                  </div>
                )}

                {contentType === 'GAME' && (
                  <div className="space-y-2">
                    <Label>Platform</Label>
                    <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select platform" />
                      </SelectTrigger>
                      <SelectContent>
                        {platformOptions.map((platform) => (
                          <SelectItem key={platform.id} value={platform.name}>
                            {platform.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleMatchMetadata} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Matching...
              </>
            ) : (
              'Match Metadata'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
