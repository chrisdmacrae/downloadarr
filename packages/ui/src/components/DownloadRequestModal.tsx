import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Download, Loader2, Settings, Film, Tv } from 'lucide-react'
import { SearchResult, CreateTorrentRequestDto, GamePlatform, apiService } from '@/services/api'
import { useToast } from '@/hooks/use-toast'

interface DownloadRequestModalProps {
  item: SearchResult | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onRequestCreated?: (request: any) => void
}

const QUALITY_OPTIONS = [
  { value: 'SD', label: 'SD (480p)' },
  { value: 'HD_720P', label: 'HD (720p)' },
  { value: 'HD_1080P', label: 'Full HD (1080p)' },
  { value: 'UHD_4K', label: '4K (2160p)' },
]

const FORMAT_OPTIONS = [
  { value: 'X264', label: 'x264 (H.264)' },
  { value: 'X265', label: 'x265 (H.265/HEVC)' },
  { value: 'AV1', label: 'AV1' },
  { value: 'XVID', label: 'XviD' },
]

export function DownloadRequestModal({ item, open, onOpenChange, onRequestCreated }: DownloadRequestModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [platformOptions, setPlatformOptions] = useState<GamePlatform[]>([])
  const [loadingPlatforms, setLoadingPlatforms] = useState<boolean>(false)
  const [formData, setFormData] = useState({
    season: '',
    episode: '',
    platform: '',
    genre: '',
    preferredQualities: ['HD_1080P'],
    preferredFormats: ['X265'],
    minSeeders: 5,
    maxSizeGB: 20,
    priority: 5,
    searchIntervalMins: 30,
    maxSearchAttempts: 50,
  })
  const { toast } = useToast()

  const isMovie = item?.type === 'movie'
  const isTvShow = item?.type === 'tv'
  const isGame = item?.type === 'game'

  // Set appropriate defaults based on content type when modal opens
  useEffect(() => {
    if (open && item) {
      setFormData(prev => ({
        ...prev,
        preferredQualities: isGame ? [] : ['HD_1080P'],
        preferredFormats: isGame ? [] : ['X265'],
        minSeeders: isGame ? 1 : 5, // Games often have lower seeder counts
      }))
    }
  }, [open, item, isGame])

  // Load platform options for games
  useEffect(() => {
    if (open && isGame && platformOptions.length === 0) {
      setLoadingPlatforms(true)
      apiService.getGamePlatforms()
        .then(response => {
          if (response.success) {
            setPlatformOptions(response.data)
          }
        })
        .catch(error => {
          console.error('Failed to load platform options:', error)
        })
        .finally(() => {
          setLoadingPlatforms(false)
        })
    }
  }, [open, isGame, platformOptions.length])

  const handleQualityChange = (quality: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      preferredQualities: checked
        ? [...prev.preferredQualities, quality]
        : prev.preferredQualities.filter(q => q !== quality)
    }))
  }

  const handleFormatChange = (format: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      preferredFormats: checked
        ? [...prev.preferredFormats, format]
        : prev.preferredFormats.filter(f => f !== format)
    }))
  }

  const handleSubmit = async () => {
    if (!item) return

    // Skip quality validation for games
    if (!isGame && formData.preferredQualities.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please select at least one quality preference",
      })
      return
    }

    // Skip format validation for games
    if (!isGame && formData.preferredFormats.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please select at least one format preference",
      })
      return
    }

    setIsLoading(true)

    try {
      const requestDto: CreateTorrentRequestDto = {
        title: item.title,
        year: item.year,
        tmdbId: parseInt(item.id),
        minSeeders: formData.minSeeders,
        maxSizeGB: formData.maxSizeGB,
        priority: formData.priority,
        searchIntervalMins: formData.searchIntervalMins,
        maxSearchAttempts: formData.maxSearchAttempts,
        // Only include quality/format preferences for movies and TV shows
        ...(isGame ? {} : {
          preferredQualities: formData.preferredQualities,
          preferredFormats: formData.preferredFormats,
        }),
      }

      // Add TV show specific fields
      if (isTvShow) {
        if (formData.season) {
          requestDto.season = parseInt(formData.season)
        }
        if (formData.episode) {
          requestDto.episode = parseInt(formData.episode)
        }
      }

      // Add game specific fields
      if (isGame) {
        if (formData.platform && formData.platform !== 'any') {
          requestDto.platform = formData.platform
        }
        if (formData.genre) {
          requestDto.genre = formData.genre
        }
        if (parseInt(item.id)) {
          requestDto.igdbId = parseInt(item.id)
        }
      }

      const response = isMovie
        ? await apiService.requestMovieDownload(requestDto)
        : isTvShow
          ? await apiService.requestTvShowDownload(requestDto)
          : await apiService.requestGameDownload(requestDto)

      if (response.success) {
        toast({
          title: "Download Requested",
          description: `${item.title} has been added to the download queue`,
        })
        onRequestCreated?.(response.data)
        onOpenChange(false)
        
        // Reset form
        setFormData({
          season: '',
          episode: '',
          platform: '',
          genre: '',
          preferredQualities: isGame ? [] : ['HD_1080P'],
          preferredFormats: isGame ? [] : ['X265'],
          minSeeders: isGame ? 1 : 5, // Games often have lower seeder counts
          maxSizeGB: 20,
          priority: 5,
          searchIntervalMins: 30,
          maxSearchAttempts: 50,
        })
      } else {
        toast({
          title: "Request Failed",
          description: response.error || "Failed to create download request",
        })
      }
    } catch (error) {
      console.error('Error creating download request:', error)
      toast({
        title: "Request Failed",
        description: "An error occurred while creating the download request",
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (!item) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isMovie ? <Film className="h-5 w-5" /> : <Tv className="h-5 w-5" />}
            Request Download: {item.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Item Info */}
          <div className="flex gap-4">
            <div className="w-20 h-28 bg-muted rounded overflow-hidden flex-shrink-0">
              {item.poster ? (
                <img
                  src={item.poster}
                  alt={item.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  {isMovie ? <Film className="h-8 w-8" /> : isTvShow ? <Tv className="h-8 w-8" /> : <Download className="h-8 w-8" />}
                </div>
              )}
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">{item.title}</h3>
              <p className="text-sm text-muted-foreground">{item.year}</p>
              <Badge variant="secondary" className="mt-1">
                {isMovie ? 'Movie' : isTvShow ? 'TV Show' : 'Game'}
              </Badge>
              {item.overview && (
                <p className="text-xs text-muted-foreground mt-2 line-clamp-3">
                  {item.overview}
                </p>
              )}
            </div>
          </div>

          <Separator />

          {/* TV Show Specific Options */}
          {isTvShow && (
            <>
              <div className="space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <Tv className="h-4 w-4" />
                  TV Show Options
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="season">Season (optional)</Label>
                    <Input
                      id="season"
                      type="number"
                      min="1"
                      placeholder="e.g., 1"
                      value={formData.season}
                      onChange={(e) => setFormData(prev => ({ ...prev, season: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="episode">Episode (optional)</Label>
                    <Input
                      id="episode"
                      type="number"
                      min="1"
                      placeholder="e.g., 5"
                      value={formData.episode}
                      onChange={(e) => setFormData(prev => ({ ...prev, episode: e.target.value }))}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Leave empty to download the entire series. Specify season only to download a full season.
                </p>
              </div>
              <Separator />
            </>
          )}

          {/* Game Specific Options */}
          {isGame && (
            <>
              <div className="space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  Game Options
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="platform">Platform (optional)</Label>
                    <Select value={formData.platform} onValueChange={(value) => setFormData(prev => ({ ...prev, platform: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select platform" />
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
                  <div className="space-y-2">
                    <Label htmlFor="genre">Genre (optional)</Label>
                    <Input
                      id="genre"
                      type="text"
                      placeholder="e.g., Action, RPG"
                      value={formData.genre}
                      onChange={(e) => setFormData(prev => ({ ...prev, genre: e.target.value }))}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Platform and genre help narrow down search results for better matches.
                </p>
              </div>
              <Separator />
            </>
          )}

          {/* Quality and Format Preferences - Not applicable for games */}
          {!isGame && (
            <>
              {/* Quality Preferences */}
              <div className="space-y-4">
                <h4 className="font-medium">Quality Preferences</h4>
                <div className="grid grid-cols-2 gap-3">
                  {QUALITY_OPTIONS.map((quality) => (
                    <div key={quality.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`quality-${quality.value}`}
                        checked={formData.preferredQualities.includes(quality.value)}
                        onCheckedChange={(checked) => handleQualityChange(quality.value, checked as boolean)}
                      />
                      <Label htmlFor={`quality-${quality.value}`} className="text-sm">
                        {quality.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Format Preferences */}
              <div className="space-y-4">
                <h4 className="font-medium">Format Preferences</h4>
                <div className="grid grid-cols-2 gap-3">
                  {FORMAT_OPTIONS.map((format) => (
                    <div key={format.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`format-${format.value}`}
                        checked={formData.preferredFormats.includes(format.value)}
                        onCheckedChange={(checked) => handleFormatChange(format.value, checked as boolean)}
                      />
                      <Label htmlFor={`format-${format.value}`} className="text-sm">
                        {format.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
              <Separator />
            </>
          )}


          {/* Advanced Options */}
          <div className="space-y-4">
            <h4 className="font-medium flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Advanced Options
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="minSeeders">Minimum Seeders</Label>
                <Input
                  id="minSeeders"
                  type="number"
                  min="0"
                  value={formData.minSeeders}
                  onChange={(e) => setFormData(prev => ({ ...prev, minSeeders: parseInt(e.target.value) || 0 }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxSize">Max Size (GB)</Label>
                <Input
                  id="maxSize"
                  type="number"
                  min="1"
                  value={formData.maxSizeGB}
                  onChange={(e) => setFormData(prev => ({ ...prev, maxSizeGB: parseInt(e.target.value) || 1 }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="priority">Priority (1-10)</Label>
                <Select
                  value={formData.priority.toString()}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, priority: parseInt(value) }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((num) => (
                      <SelectItem key={num} value={num.toString()}>
                        {num} {num === 10 ? '(Highest)' : num === 1 ? '(Lowest)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="searchInterval">Search Interval (min)</Label>
                <Select
                  value={formData.searchIntervalMins.toString()}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, searchIntervalMins: parseInt(value) }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15 minutes</SelectItem>
                    <SelectItem value="30">30 minutes</SelectItem>
                    <SelectItem value="60">1 hour</SelectItem>
                    <SelectItem value="120">2 hours</SelectItem>
                    <SelectItem value="360">6 hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Requesting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Request Download
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
