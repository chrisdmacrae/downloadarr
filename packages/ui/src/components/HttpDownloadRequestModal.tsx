import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Download, Loader2, Link, AlertCircle, Search, Film, Tv, Gamepad2, ArrowLeft, ArrowRight } from 'lucide-react'
import { apiService, CreateHttpDownloadRequestDto, MatchMetadataDto, SearchResult, GamePlatform } from '@/services/api'
import { useToast } from '@/hooks/use-toast'

interface HttpDownloadRequestModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onRequestCreated?: (request: any) => void
}

type Step = 'url' | 'metadata'

export function HttpDownloadRequestModal({ open, onOpenChange, onRequestCreated }: HttpDownloadRequestModalProps) {
  const [currentStep, setCurrentStep] = useState<Step>('url')
  const [isLoading, setIsLoading] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [createdRequest, setCreatedRequest] = useState<any>(null)

  // Step 1: URL form data
  const [formData, setFormData] = useState({
    url: '',
    filename: '',
    destination: '',
    priority: 5,
  })
  const [urlError, setUrlError] = useState<string | null>(null)

  // Step 2: Metadata form data
  const [contentType, setContentType] = useState<'MOVIE' | 'TV_SHOW' | 'GAME'>('MOVIE')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null)
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
    if (open) {
      // Reset form when modal opens
      setCurrentStep('url')
      setFormData({ url: '', filename: '', destination: '', priority: 5 })
      setUrlError(null)
      setCreatedRequest(null)
      setSearchQuery('')
      setSearchResults([])
      setSelectedResult(null)
      setUseCustomMetadata(false)
      setCustomMetadata({ title: '', year: '', season: '', episode: '' })
    }
  }, [open])

  useEffect(() => {
    if (currentStep === 'metadata' && createdRequest) {
      // Try to extract a search query from the filename or URL
      const filename = createdRequest.filename || createdRequest.url.split('/').pop() || ''
      const cleanedFilename = filename
        .replace(/\.[^/.]+$/, '') // Remove file extension
        .replace(/[._-]/g, ' ') // Replace separators with spaces
        .replace(/\b(1080p|720p|480p|4k|x264|x265|hevc|web|dl|bluray|dvdrip|cam|ts|hdrip)\b/gi, '') // Remove quality indicators
        .trim()

      setSearchQuery(cleanedFilename)
    }
  }, [currentStep, createdRequest])

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

  const validateUrl = (url: string): boolean => {
    if (!url.trim()) {
      setUrlError('URL is required')
      return false
    }

    try {
      const urlObj = new URL(url)
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        setUrlError('URL must be HTTP or HTTPS')
        return false
      }
      setUrlError(null)
      return true
    } catch (error) {
      setUrlError('Please enter a valid URL')
      return false
    }
  }

  const extractFilenameFromUrl = (url: string): string => {
    try {
      const urlObj = new URL(url)
      const pathname = urlObj.pathname
      const filename = pathname.split('/').pop() || ''
      return filename
    } catch (error) {
      return ''
    }
  }

  const handleUrlChange = (url: string) => {
    setFormData(prev => ({
      ...prev,
      url,
      // Auto-extract filename if not manually set
      filename: prev.filename || extractFilenameFromUrl(url)
    }))
    
    if (url.trim()) {
      validateUrl(url)
    } else {
      setUrlError(null)
    }
  }

  const handleUrlSubmit = async () => {
    if (!validateUrl(formData.url)) {
      return
    }

    setIsLoading(true)

    try {
      const requestDto: CreateHttpDownloadRequestDto = {
        url: formData.url.trim(),
        filename: formData.filename.trim() || undefined,
        destination: formData.destination.trim() || undefined,
        priority: formData.priority,
      }

      const response = await apiService.createHttpDownloadRequest(requestDto)

      if (response.success) {
        setCreatedRequest(response.data)
        setCurrentStep('metadata')
      } else {
        toast({
          title: "Request Failed",
          description: "Failed to create HTTP download request",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Error creating HTTP download request:', error)
      toast({
        title: "Request Failed",
        description: "An error occurred while creating the HTTP download request",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
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

  const handleMetadataSubmit = async () => {
    if (!createdRequest) return

    setIsLoading(true)

    try {
      let matchDto: MatchMetadataDto

      if (useCustomMetadata) {
        // Use custom metadata
        matchDto = {
          contentType,
          title: customMetadata.title,
          year: customMetadata.year ? parseInt(customMetadata.year) : undefined,
          season: customMetadata.season ? parseInt(customMetadata.season) : undefined,
          episode: customMetadata.episode ? parseInt(customMetadata.episode) : undefined,
          platform: contentType === 'GAME' ? selectedPlatform : undefined,
        }
      } else if (selectedResult) {
        // Use selected search result
        matchDto = {
          contentType,
          title: selectedResult.title,
          year: selectedResult.year,
          season: contentType === 'TV_SHOW' && customMetadata.season ? parseInt(customMetadata.season) : undefined,
          episode: contentType === 'TV_SHOW' && customMetadata.episode ? parseInt(customMetadata.episode) : undefined,
          platform: contentType === 'GAME' ? selectedPlatform : undefined,
          imdbId: (selectedResult as any).imdbId,
          tmdbId: (selectedResult as any).tmdbId,
          igdbId: (selectedResult as any).igdbId,
        }
      } else {
        toast({
          title: "Selection Required",
          description: "Please select a search result or use custom metadata",
          variant: "destructive",
        })
        return
      }

      const response = await apiService.matchHttpDownloadMetadata(createdRequest.id, matchDto)

      if (response.success) {
        toast({
          title: "Metadata Matched",
          description: `Successfully matched metadata for "${matchDto.title}". You can now start the download.`,
        })
        onRequestCreated?.(response.data)
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

  const handleBack = () => {
    setCurrentStep('url')
  }

  const handleCancel = () => {
    setFormData({
      url: '',
      filename: '',
      destination: '',
      priority: 5,
    })
    setUrlError(null)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {currentStep === 'url' ? (
              <>
                <Link className="h-5 w-5" />
                Add HTTP Download
              </>
            ) : (
              <>
                <Search className="h-5 w-5" />
                Match Metadata
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        {currentStep === 'url' ? (
          // Step 1: URL Input
          <>
            <div className="space-y-6">
              {/* URL Input */}
              <div className="space-y-2">
                <Label htmlFor="url">Download URL *</Label>
                <Textarea
                  id="url"
                  placeholder="https://example.com/file.zip"
                  value={formData.url}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  className={urlError ? 'border-red-500' : ''}
                  rows={3}
                />
                {urlError && (
                  <div className="flex items-center space-x-2 text-destructive text-sm">
                    <AlertCircle className="h-4 w-4" />
                    <span>{urlError}</span>
                  </div>
                )}
                <p className="text-sm text-muted-foreground">
                  Paste the direct HTTP or HTTPS download URL
                </p>
              </div>

              <Separator />

              {/* Optional Settings */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="filename">Custom Filename</Label>
                  <Input
                    id="filename"
                    placeholder="Leave empty to auto-detect"
                    value={formData.filename}
                    onChange={(e) => setFormData(prev => ({ ...prev, filename: e.target.value }))}
                  />
                  <p className="text-sm text-muted-foreground">
                    Override the detected filename
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="destination">Destination Path</Label>
                  <Input
                    id="destination"
                    placeholder="Leave empty for default"
                    value={formData.destination}
                    onChange={(e) => setFormData(prev => ({ ...prev, destination: e.target.value }))}
                  />
                  <p className="text-sm text-muted-foreground">
                    Custom download destination
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select
                  value={formData.priority.toString()}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, priority: parseInt(value) }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 (Highest)</SelectItem>
                    <SelectItem value="2">2 (High)</SelectItem>
                    <SelectItem value="3">3 (Above Normal)</SelectItem>
                    <SelectItem value="4">4 (Normal)</SelectItem>
                    <SelectItem value="5">5 (Below Normal)</SelectItem>
                    <SelectItem value="6">6 (Low)</SelectItem>
                    <SelectItem value="7">7 (Lowest)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Download priority (1 = highest, 7 = lowest)
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleCancel} disabled={isLoading}>
                Cancel
              </Button>
              <Button onClick={handleUrlSubmit} disabled={isLoading || !!urlError || !formData.url.trim()}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <ArrowRight className="mr-2 h-4 w-4" />
                    Next: Match Metadata
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        ) : (
          // Step 2: Metadata Matching
          <>
            <div className="space-y-6">
              {/* Content Type Selection */}
              <div className="space-y-3">
                <Label>Content Type</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={contentType === 'MOVIE' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setContentType('MOVIE')}
                    className="flex items-center gap-2"
                  >
                    <Film className="h-4 w-4" />
                    Movie
                  </Button>
                  <Button
                    type="button"
                    variant={contentType === 'TV_SHOW' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setContentType('TV_SHOW')}
                    className="flex items-center gap-2"
                  >
                    <Tv className="h-4 w-4" />
                    TV Show
                  </Button>
                  <Button
                    type="button"
                    variant={contentType === 'GAME' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setContentType('GAME')}
                    className="flex items-center gap-2"
                  >
                    <Gamepad2 className="h-4 w-4" />
                    Game
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Search Section */}
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder={`Search for ${contentType.toLowerCase().replace('_', ' ')}...`}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    className="flex-1"
                  />
                  <Button onClick={handleSearch} disabled={isSearching}>
                    {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    Search
                  </Button>
                </div>

                {/* Search Results */}
                {searchResults.length > 0 && (
                  <ScrollArea className="h-96">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {searchResults.map((result, index) => (
                        <Card
                          key={index}
                          className={`cursor-pointer transition-all hover:shadow-md ${
                            selectedResult === result ? 'ring-2 ring-primary' : ''
                          }`}
                          onClick={() => setSelectedResult(result)}
                        >
                          <CardContent className="p-3">
                            {result.poster && (
                              <img
                                src={result.poster}
                                alt={result.title}
                                className="w-full h-32 object-cover rounded mb-2"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none'
                                }}
                              />
                            )}
                            <h4 className="font-medium text-sm line-clamp-2 mb-1">{result.title}</h4>
                            {result.year && (
                              <Badge variant="outline" className="text-xs">
                                {result.year}
                              </Badge>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>

              {/* Custom Metadata Toggle */}
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="useCustom"
                  checked={useCustomMetadata}
                  onChange={(e) => setUseCustomMetadata(e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="useCustom">Use custom metadata instead</Label>
              </div>

              {/* Custom Metadata Form */}
              {useCustomMetadata && (
                <div className="space-y-4 p-4 border rounded-lg">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="customTitle">Title *</Label>
                      <Input
                        id="customTitle"
                        value={customMetadata.title}
                        onChange={(e) => setCustomMetadata(prev => ({ ...prev, title: e.target.value }))}
                        placeholder="Enter title"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="customYear">Year</Label>
                      <Input
                        id="customYear"
                        type="number"
                        value={customMetadata.year}
                        onChange={(e) => setCustomMetadata(prev => ({ ...prev, year: e.target.value }))}
                        placeholder="2024"
                      />
                    </div>
                  </div>

                  {contentType === 'TV_SHOW' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="customSeason">Season</Label>
                        <Input
                          id="customSeason"
                          type="number"
                          value={customMetadata.season}
                          onChange={(e) => setCustomMetadata(prev => ({ ...prev, season: e.target.value }))}
                          placeholder="1"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="customEpisode">Episode</Label>
                        <Input
                          id="customEpisode"
                          type="number"
                          value={customMetadata.episode}
                          onChange={(e) => setCustomMetadata(prev => ({ ...prev, episode: e.target.value }))}
                          placeholder="1"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TV Show Season/Episode for Search Results */}
              {!useCustomMetadata && selectedResult && contentType === 'TV_SHOW' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-lg">
                  <div className="space-y-2">
                    <Label htmlFor="season">Season</Label>
                    <Input
                      id="season"
                      type="number"
                      value={customMetadata.season}
                      onChange={(e) => setCustomMetadata(prev => ({ ...prev, season: e.target.value }))}
                      placeholder="1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="episode">Episode</Label>
                    <Input
                      id="episode"
                      type="number"
                      value={customMetadata.episode}
                      onChange={(e) => setCustomMetadata(prev => ({ ...prev, episode: e.target.value }))}
                      placeholder="1"
                    />
                  </div>
                </div>
              )}

              {/* Game Platform Selection */}
              {contentType === 'GAME' && (
                <div className="space-y-2">
                  <Label htmlFor="platform">Platform</Label>
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

            <DialogFooter>
              <Button variant="outline" onClick={handleBack} disabled={isLoading}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button
                onClick={handleMetadataSubmit}
                disabled={
                  isLoading ||
                  (!useCustomMetadata && !selectedResult) ||
                  (useCustomMetadata && !customMetadata.title.trim())
                }
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Matching...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Create & Match
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
