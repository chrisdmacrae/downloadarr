import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { Edit, Loader2, Settings } from 'lucide-react'
import { TorrentRequest, UpdateTorrentRequestDto, apiService } from '@/services/api'
import { useToast } from '@/hooks/use-toast'

interface EditRequestModalProps {
  request: TorrentRequest | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onRequestUpdated?: (request: TorrentRequest) => void
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

export function EditRequestModal({ request, open, onOpenChange, onRequestUpdated }: EditRequestModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    preferredQualities: [] as string[],
    preferredFormats: [] as string[],
    minSeeders: 5,
    maxSizeGB: 20,
    priority: 5,
    searchIntervalMins: 30,
    maxSearchAttempts: 50,
    blacklistedWords: [] as string[],
    trustedIndexers: [] as string[],
  })
  const { toast } = useToast()

  const isGame = request?.contentType === 'GAME'

  // Initialize form data when modal opens
  useEffect(() => {
    if (open && request) {
      setFormData({
        preferredQualities: request.preferredQualities || [],
        preferredFormats: request.preferredFormats || [],
        minSeeders: request.minSeeders || 5,
        maxSizeGB: request.maxSizeGB || 20,
        priority: request.priority || 5,
        searchIntervalMins: 30, // Default value since it's not in TorrentRequest interface
        maxSearchAttempts: request.maxSearchAttempts || 50,
        blacklistedWords: [], // Default empty since it's not in TorrentRequest interface
        trustedIndexers: [], // Default empty since it's not in TorrentRequest interface
      })
    }
  }, [open, request])

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
    if (!request) return

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
      const updateDto: UpdateTorrentRequestDto = {
        minSeeders: formData.minSeeders,
        maxSizeGB: formData.maxSizeGB,
        priority: formData.priority,
        searchIntervalMins: formData.searchIntervalMins,
        maxSearchAttempts: formData.maxSearchAttempts,
        blacklistedWords: formData.blacklistedWords,
        trustedIndexers: formData.trustedIndexers,
        // Only include quality/format preferences for movies and TV shows
        ...(isGame ? {} : {
          preferredQualities: formData.preferredQualities,
          preferredFormats: formData.preferredFormats,
        }),
      }

      const response = await apiService.updateTorrentRequest(request.id, updateDto)

      if (response.success) {
        toast({
          title: "Request Updated",
          description: `${request.title} has been updated successfully`,
        })
        onRequestUpdated?.(response.data!)
        onOpenChange(false)
      } else {
        toast({
          title: "Update Failed",
          description: response.error || "Failed to update request",
        })
      }
    } catch (error) {
      console.error('Error updating request:', error)
      toast({
        title: "Update Failed",
        description: "An error occurred while updating the request",
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (!request) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5" />
            Edit Request: {request.title}
            {request.year && <span className="text-muted-foreground">({request.year})</span>}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Quality Preferences - Only for movies and TV shows */}
          {!isGame && (
            <div className="space-y-3">
              <Label className="text-base font-medium">Quality Preferences</Label>
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
          )}

          {/* Format Preferences - Only for movies and TV shows */}
          {!isGame && (
            <div className="space-y-3">
              <Label className="text-base font-medium">Format Preferences</Label>
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
          )}

          <Separator />

          {/* Search Settings */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              <Label className="text-base font-medium">Search Settings</Label>
            </div>
            
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
                <Label htmlFor="maxSizeGB">Max Size (GB)</Label>
                <Input
                  id="maxSizeGB"
                  type="number"
                  min="1"
                  value={formData.maxSizeGB}
                  onChange={(e) => setFormData(prev => ({ ...prev, maxSizeGB: parseInt(e.target.value) || 1 }))}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="priority">Priority (1-10)</Label>
                <Input
                  id="priority"
                  type="number"
                  min="1"
                  max="10"
                  value={formData.priority}
                  onChange={(e) => setFormData(prev => ({ ...prev, priority: parseInt(e.target.value) || 5 }))}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="maxSearchAttempts">Max Search Attempts</Label>
                <Input
                  id="maxSearchAttempts"
                  type="number"
                  min="1"
                  max="200"
                  value={formData.maxSearchAttempts}
                  onChange={(e) => setFormData(prev => ({ ...prev, maxSearchAttempts: parseInt(e.target.value) || 50 }))}
                />
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
                Updating...
              </>
            ) : (
              'Update Request'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
