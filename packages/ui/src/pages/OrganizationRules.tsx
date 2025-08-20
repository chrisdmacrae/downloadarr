import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

import { useToast } from '@/hooks/use-toast'
import { useOrganizationRules, useUpdateOrganizationRule, useCreateOrganizationRule, useDeleteOrganizationRule, useGamePlatformOptions } from '@/hooks/useApi'
import type { OrganizationRule } from '@/services/api'

interface RuleFormData {
  contentType: 'MOVIE' | 'TV_SHOW' | 'GAME'
  isDefault: boolean
  isActive: boolean
  folderNamePattern: string
  fileNamePattern: string
  seasonFolderPattern?: string
  basePath?: string
  platform?: string // For game rules
}

export default function OrganizationRules() {
  const { toast } = useToast()
  const { data: rules, isLoading } = useOrganizationRules()
  const updateRule = useUpdateOrganizationRule()
  const createRule = useCreateOrganizationRule()
  const deleteRule = useDeleteOrganizationRule()
  const { data: platformOptions, isLoading: loadingPlatforms } = useGamePlatformOptions(false)

  const [editingRule, setEditingRule] = useState<OrganizationRule | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [formData, setFormData] = useState<RuleFormData>({
    contentType: 'MOVIE',
    isDefault: false,
    isActive: true,
    folderNamePattern: '',
    fileNamePattern: '',
  })

  // Path preview tool state
  const [previewData, setPreviewData] = useState({
    contentType: 'MOVIE' as 'MOVIE' | 'TV_SHOW' | 'GAME',
    title: '',
    year: '',
    season: '',
    episode: '',
    platform: '',
    quality: '',
    format: '',
    edition: '',
    filename: '', // Optional: use this instead of generating from metadata
  })

  const [previewResult, setPreviewResult] = useState<{
    folderPath: string;
    fileName: string;
    fullPath: string;
  } | null>(null)

  // Helper function to find the appropriate rule for preview
  const findRuleForPreview = (contentType: string, platform?: string) => {
    if (!rules) return null

    // First try to find a specific rule for the platform (for games)
    if (contentType === 'GAME' && platform) {
      const platformRule = rules.find(rule =>
        rule.contentType === contentType &&
        rule.isActive &&
        (rule as any).platform === platform
      )
      if (platformRule) return platformRule
    }

    // Then try to find a default rule for the content type
    const defaultRule = rules.find(rule =>
      rule.contentType === contentType &&
      rule.isActive &&
      rule.isDefault
    )
    if (defaultRule) return defaultRule

    // Finally, find any active rule for the content type
    return rules.find(rule =>
      rule.contentType === contentType &&
      rule.isActive
    )
  }

  // Helper function to replace pattern variables
  const replacePatternVariables = (pattern: string, data: any) => {
    const isGame = data.contentType === 'GAME'

    return pattern
      .replace(/\{title\}/g, data.title || 'Example Title')
      .replace(/\{year\}/g, data.year || '2023')
      .replace(/\{season\}/g, data.season ? String(data.season).padStart(2, '0') : '01')
      .replace(/\{episode\}/g, data.episode ? String(data.episode).padStart(2, '0') : '01')
      .replace(/\{platform\}/g, data.platform || (isGame ? 'Platform' : ''))
      .replace(/\{quality\}/g, isGame ? '' : (data.quality || '1080p'))
      .replace(/\{format\}/g, data.format || (isGame ? 'NTSC-U' : 'BluRay'))
      .replace(/\{edition\}/g, data.edition || '')
      .replace(/\{codec\}/g, isGame ? '' : 'x265')
      .replace(/\{bitdepth\}/g, isGame ? '' : '10bit')
      // Clean up extra spaces and dashes
      .replace(/\s*-\s*-\s*/g, ' - ')
      .replace(/\s*-\s*$/g, '') // Remove trailing dash
      .replace(/^\s*-\s*/g, '') // Remove leading dash
      .replace(/\s+/g, ' ')
      .trim()
  }

  // Helper function to extract metadata from filename
  const extractMetadataFromFilename = (filename: string, contentType: string) => {
    const extractedData = { ...previewData }

    // Remove file extension
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, '')

    // Common patterns for different content types
    if (contentType === 'MOVIE') {
      // Try to extract year
      const yearMatch = nameWithoutExt.match(/\b(19|20)\d{2}\b/)
      if (yearMatch) extractedData.year = yearMatch[0]

      // Try to extract quality
      const qualityMatch = nameWithoutExt.match(/\b(720p|1080p|2160p|4K)\b/i)
      if (qualityMatch) extractedData.quality = qualityMatch[0]

      // Try to extract format
      const formatMatch = nameWithoutExt.match(/\b(BluRay|BDRip|DVDRip|WEBRip|HDTV)\b/i)
      if (formatMatch) extractedData.format = formatMatch[0]

      // Extract title (everything before year or quality indicators)
      const titleMatch = nameWithoutExt.match(/^([^(]+?)(?:\s*\(?(19|20)\d{2}|\.720p|\.1080p|\.2160p)/i)
      if (titleMatch) {
        extractedData.title = titleMatch[1].replace(/[._]/g, ' ').trim()
      }
    } else if (contentType === 'TV_SHOW') {
      // Try to extract season and episode
      const seasonEpisodeMatch = nameWithoutExt.match(/[Ss](\d+)[Ee](\d+)/)
      if (seasonEpisodeMatch) {
        extractedData.season = seasonEpisodeMatch[1]
        extractedData.episode = seasonEpisodeMatch[2]
      }

      // Try to extract show title (everything before season indicator)
      const titleMatch = nameWithoutExt.match(/^([^-]+?)(?:\s*-\s*[Ss]\d+|[Ss]\d+)/i)
      if (titleMatch) {
        extractedData.title = titleMatch[1].replace(/[._]/g, ' ').trim()
      }
    } else if (contentType === 'GAME') {
      // Try to extract platform from parentheses
      const platformMatch = nameWithoutExt.match(/\(([^)]+)\)/)
      if (platformMatch) {
        const platformText = platformMatch[1].toLowerCase()
        // Map common platform abbreviations
        const platformMap: Record<string, string> = {
          'nes': 'nintendo-nes',
          'snes': 'nintendo-snes',
          'n64': 'nintendo-64',
          'ps1': 'ps1',
          'ps2': 'ps2',
          'ps3': 'ps3',
          'ps4': 'ps4',
          'xbox': 'xbox',
          'xbox360': 'xbox-360',
          'pc': 'pc'
        }
        extractedData.platform = platformMap[platformText] || platformText
      }

      // Extract title (everything before platform parentheses)
      const titleMatch = nameWithoutExt.match(/^([^(]+?)(?:\s*\(|$)/)
      if (titleMatch) {
        extractedData.title = titleMatch[1].replace(/[._]/g, ' ').trim()
      }
    }

    return extractedData
  }

  // Generate preview based on current form data and rules
  const generatePreview = () => {
    const rule = findRuleForPreview(previewData.contentType, previewData.platform)

    if (!rule) {
      toast({
        title: "No Rule Found",
        description: `No active organization rule found for ${previewData.contentType.toLowerCase()}${previewData.platform ? ` (${previewData.platform})` : ''}`,
      })
      return
    }

    // Use provided filename or generate from metadata
    let fileName: string
    let dataForPatterns = previewData

    if (previewData.filename.trim()) {
      // If filename is provided, use it as-is but also extract metadata to fill in folder patterns
      fileName = previewData.filename.trim()

      // Extract metadata from filename to use for folder generation
      if (!previewData.title) {
        dataForPatterns = extractMetadataFromFilename(previewData.filename, previewData.contentType)
      }
    } else {
      // Generate filename from metadata using the rule pattern
      if (!previewData.title) {
        toast({
          title: "Missing Information",
          description: "Please provide either a title or a filename to generate the preview",
        })
        return
      }

      const getFileExtension = (contentType: string) => {
        switch (contentType) {
          case 'GAME':
            return '.zip' // or could be .iso, .rom, etc.
          case 'MOVIE':
          case 'TV_SHOW':
          default:
            return '.mkv'
        }
      }

      fileName = replacePatternVariables(rule.fileNamePattern, previewData) + getFileExtension(previewData.contentType)
    }

    // Generate folder path using the data (either provided or extracted)
    let folderPath = replacePatternVariables(rule.folderNamePattern, dataForPatterns)

    // Add season folder for TV shows if pattern exists
    if (previewData.contentType === 'TV_SHOW' && rule.seasonFolderPattern) {
      const seasonFolder = replacePatternVariables(rule.seasonFolderPattern, dataForPatterns)
      folderPath = `${folderPath}/${seasonFolder}`
    }

    // Use base path if specified, otherwise use default library path
    const basePath = rule.basePath || '/library'
    const fullFolderPath = `${basePath}/${folderPath}`

    setPreviewResult({
      folderPath: fullFolderPath,
      fileName,
      fullPath: `${fullFolderPath}/${fileName}`
    })

    toast({
      title: "Preview Generated",
      description: previewData.filename.trim()
        ? "Path preview generated using your provided filename"
        : "Path preview generated from metadata using organization rules",
    })
  }

  const handleToggleRule = async (rule: OrganizationRule) => {
    try {
      await updateRule.mutateAsync({
        id: rule.id,
        rule: { isActive: !rule.isActive }
      })
      toast({
        title: "Rule updated",
        description: `${getContentTypeLabel(rule.contentType)} rule ${rule.isActive ? 'disabled' : 'enabled'}.`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update rule. Please try again.",
      })
    }
  }

  const handleEditRule = (rule: OrganizationRule) => {
    setEditingRule(rule)
    setFormData({
      contentType: rule.contentType,
      isDefault: rule.isDefault,
      isActive: rule.isActive,
      folderNamePattern: rule.folderNamePattern,
      fileNamePattern: rule.fileNamePattern,
      seasonFolderPattern: rule.seasonFolderPattern || '',
      basePath: rule.basePath || '',
      platform: (rule as any).platform || '', // Type assertion needed until we update the type
    })
    setIsEditDialogOpen(true)
  }

  const handleCreateRule = () => {
    const defaultPatterns = getDefaultPatterns('MOVIE')
    setFormData({
      contentType: 'MOVIE',
      isDefault: false,
      isActive: true,
      folderNamePattern: defaultPatterns.folderNamePattern,
      fileNamePattern: defaultPatterns.fileNamePattern,
      seasonFolderPattern: defaultPatterns.seasonFolderPattern || '',
    })
    setIsCreateDialogOpen(true)
  }

  const handleSaveRule = async () => {
    try {
      if (editingRule) {
        // For updates, send allowed fields (exclude contentType but include isDefault)
        const updateData = {
          isDefault: formData.isDefault,
          isActive: formData.isActive,
          folderNamePattern: formData.folderNamePattern,
          fileNamePattern: formData.fileNamePattern,
          seasonFolderPattern: formData.seasonFolderPattern || undefined,
          basePath: formData.basePath || undefined,
          platform: formData.platform || undefined,
        }

        await updateRule.mutateAsync({
          id: editingRule.id,
          rule: updateData
        })
        toast({
          title: "Rule updated",
          description: "Organization rule has been updated successfully.",
        })
        setIsEditDialogOpen(false)
      } else {
        // For creation, include all fields
        const createData = {
          contentType: formData.contentType,
          isDefault: formData.isDefault,
          isActive: formData.isActive,
          folderNamePattern: formData.folderNamePattern,
          fileNamePattern: formData.fileNamePattern,
          seasonFolderPattern: formData.seasonFolderPattern || undefined,
          basePath: formData.basePath || undefined,
          platform: formData.platform || undefined,
        }

        await createRule.mutateAsync(createData)
        toast({
          title: "Rule created",
          description: "New organization rule has been created successfully.",
        })
        setIsCreateDialogOpen(false)
      }

      setEditingRule(null)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save rule. Please try again.",
      })
    }
  }

  const handleDeleteRule = async (rule: OrganizationRule) => {
    if (rule.isDefault) {
      toast({
        title: "Cannot delete",
        description: "Default rules cannot be deleted.",
      })
      return
    }

    try {
      await deleteRule.mutateAsync(rule.id)
      toast({
        title: "Rule deleted",
        description: "Organization rule has been deleted successfully.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete rule. Please try again.",
      })
    }
  }

  const getDefaultPatterns = (contentType: 'MOVIE' | 'TV_SHOW' | 'GAME') => {
    switch (contentType) {
      case 'MOVIE':
        return {
          folderNamePattern: '{title} ({year})',
          fileNamePattern: '{filename}',
        }
      case 'TV_SHOW':
        return {
          folderNamePattern: '{title} ({year})',
          fileNamePattern: '{filename}',
          seasonFolderPattern: 'Season {seasonNumber}',
        }
      case 'GAME':
        return {
          folderNamePattern: '{title} ({platform})',
          fileNamePattern: '{filename}',
        }
    }
  }

  const handleContentTypeChange = (contentType: 'MOVIE' | 'TV_SHOW' | 'GAME') => {
    const patterns = getDefaultPatterns(contentType)
    setFormData(prev => ({
      ...prev,
      contentType,
      ...patterns,
    }))
  }

  const getContentTypeColor = (contentType: string) => {
    switch (contentType) {
      case 'MOVIE': return 'bg-blue-100 text-blue-800'
      case 'TV_SHOW': return 'bg-green-100 text-green-800'
      case 'GAME': return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getContentTypeLabel = (contentType: string) => {
    switch (contentType) {
      case 'MOVIE': return 'Movie'
      case 'TV_SHOW': return 'TV Show'
      case 'GAME': return 'Game'
      default: return contentType
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Organization Rules</h1>
            <p className="text-muted-foreground">
              Configure how files are organized and renamed for different content types
            </p>
          </div>
          <Skeleton className="h-10 w-32" />
        </div>

        {/* Pattern Examples Skeleton */}
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
              {[1, 2, 3].map((i) => (
                <div key={i}>
                  <Skeleton className="h-5 w-20 mb-2" />
                  <div className="space-y-1">
                    {[1, 2, 3, 4, 5].map((j) => (
                      <Skeleton key={j} className="h-4 w-full" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Rules List Skeleton */}
        <div className="space-y-4">
          {/* Movie Rule Skeleton */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-6 w-16 rounded-full bg-blue-100" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-6 w-11 rounded-full" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-8 w-20" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Skeleton className="h-4 w-32 mb-1" />
                <Skeleton className="h-8 w-full" />
              </div>

              <div>
                <Skeleton className="h-4 w-28 mb-1" />
                <Skeleton className="h-8 w-full" />
              </div>

              <div className="pt-2 border-t">
                <Skeleton className="h-4 w-20 mb-1" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-80" />
                  <Skeleton className="h-4 w-96" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* TV Show Rule Skeleton */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-6 w-20 rounded-full bg-green-100" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-6 w-11 rounded-full" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-8 w-20" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Skeleton className="h-4 w-32 mb-1" />
                <Skeleton className="h-8 w-full" />
              </div>

              <div>
                <Skeleton className="h-4 w-28 mb-1" />
                <Skeleton className="h-8 w-full" />
              </div>

              <div>
                <Skeleton className="h-4 w-40 mb-1" />
                <Skeleton className="h-8 w-full" />
              </div>

              <div className="pt-2 border-t">
                <Skeleton className="h-4 w-20 mb-1" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-80" />
                  <Skeleton className="h-4 w-96" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Game Rule Skeleton */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-6 w-16 rounded-full bg-purple-100" />
                  <Skeleton className="h-6 w-24 rounded-full bg-gray-200" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-6 w-11 rounded-full" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-8 w-20" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Skeleton className="h-4 w-32 mb-1" />
                <Skeleton className="h-8 w-full" />
              </div>

              <div>
                <Skeleton className="h-4 w-28 mb-1" />
                <Skeleton className="h-8 w-full" />
              </div>

              <div className="pt-2 border-t">
                <Skeleton className="h-4 w-20 mb-1" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-80" />
                  <Skeleton className="h-4 w-96" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Path Preview Tool Skeleton */}
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-80" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ))}
            </div>

            <Skeleton className="h-10 w-32" />

            <div className="p-4 bg-muted rounded">
              <div className="space-y-1">
                <Skeleton className="h-4 w-80" />
                <Skeleton className="h-4 w-96" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Organization Rules</h1>
          <p className="text-muted-foreground">
            Configure how files are organized and renamed for different content types
          </p>
        </div>
        <Button onClick={handleCreateRule}>Add New Rule</Button>
      </div>

      {/* Pattern Examples */}
      <Card>
        <CardHeader>
          <CardTitle>Pattern Variables</CardTitle>
          <CardDescription>
            Available variables for naming patterns
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div>
              <h4 className="font-medium mb-2">General</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li><code>{'{title}'}</code> - Content title</li>
                <li><code>{'{year}'}</code> - Release year</li>
                <li><code>{'{filename}'}</code> - Original filename (no ext)</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Movies & TV Shows</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li><code>{'{quality}'}</code> - Video quality (1080p, 720p)</li>
                <li><code>{'{format}'}</code> - Video format (x265, x264)</li>
                <li><code>{'{edition}'}</code> - Release type (BluRay, WEBRip)</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">TV Shows</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li><code>{'{season}'}</code> - Season number</li>
                <li><code>{'{seasonNumber}'}</code> - Season (padded)</li>
                <li><code>{'{episode}'}</code> - Episode number</li>
                <li><code>{'{episodeNumber}'}</code> - Episode (padded)</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Games</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li><code>{'{platform}'}</code> - Game platform</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rules List */}
      <div className="space-y-4">
        {rules?.map((rule) => (
          <Card key={rule.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <Badge className={getContentTypeColor(rule.contentType)}>
                    {getContentTypeLabel(rule.contentType)}
                  </Badge>
                  {rule.platform && (
                    <Badge variant="secondary">{rule.platform}</Badge>
                  )}
                  {rule.isDefault && (
                    <Badge variant="outline">Default</Badge>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Active:</span>
                    <Switch
                      checked={rule.isActive}
                      onCheckedChange={() => handleToggleRule(rule)}
                      disabled={updateRule.isPending}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleEditRule(rule)}>
                    Edit
                  </Button>
                  {!rule.isDefault && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteRule(rule)}
                      disabled={deleteRule.isPending}
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-sm font-medium">Folder Pattern:</label>
                <code className="block mt-1 p-2 bg-muted rounded text-sm">
                  {rule.folderNamePattern}
                </code>
              </div>
              
              <div>
                <label className="text-sm font-medium">File Pattern:</label>
                <code className="block mt-1 p-2 bg-muted rounded text-sm">
                  {rule.fileNamePattern}
                </code>
              </div>
              
              {rule.seasonFolderPattern && (
                <div>
                  <label className="text-sm font-medium">Season Folder Pattern:</label>
                  <code className="block mt-1 p-2 bg-muted rounded text-sm">
                    {rule.seasonFolderPattern}
                  </code>
                </div>
              )}
              
              {rule.basePath && (
                <div>
                  <label className="text-sm font-medium">Base Path Override:</label>
                  <code className="block mt-1 p-2 bg-muted rounded text-sm">
                    {rule.basePath}
                  </code>
                </div>
              )}

              {/* Preview */}
              <div className="pt-2 border-t">
                <label className="text-sm font-medium">Preview:</label>
                <div className="mt-1 text-sm text-muted-foreground">
                  {rule.contentType === 'MOVIE' && (
                    <>
                      <div>Folder: <code>The Matrix (1999)</code></div>
                      <div>File: <code>The Matrix (1999) - 1080p BluRay - x265 - 10bit.mkv</code></div>
                    </>
                  )}
                  {rule.contentType === 'TV_SHOW' && (
                    <>
                      <div>Folder: <code>Breaking Bad (2008)/Season 01</code></div>
                      <div>File: <code>Breaking Bad - S01E01 - 1080p BluRay - x265 - 10bit.mkv</code></div>
                    </>
                  )}
                  {rule.contentType === 'GAME' && (
                    <>
                      <div>Folder: <code>Super Mario Bros. (NES)</code></div>
                      <div>File: <code>Super Mario Bros. (NES) - NTSC-U.nes</code></div>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Path Preview Tool */}
      <Card>
        <CardHeader>
          <CardTitle>Path Preview Tool</CardTitle>
          <CardDescription>
            Test how your organization rules will format file paths
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Content Type</label>
              <select
                className="w-full px-3 py-2 border border-input rounded-md bg-background"
                value={previewData.contentType}
                onChange={(e) => setPreviewData(prev => ({
                  ...prev,
                  contentType: e.target.value as 'MOVIE' | 'TV_SHOW' | 'GAME',
                  // Reset platform when changing content type
                  platform: e.target.value === 'GAME' ? prev.platform : ''
                }))}
              >
                <option value="MOVIE">Movie</option>
                <option value="TV_SHOW">TV Show</option>
                <option value="GAME">Game</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Title</label>
              <input
                type="text"
                placeholder="The Matrix"
                className="w-full px-3 py-2 border border-input rounded-md bg-background"
                value={previewData.title}
                onChange={(e) => setPreviewData(prev => ({ ...prev, title: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Filename (Optional)
                <span className="text-xs text-muted-foreground ml-1">
                  - Leave empty to generate from metadata
                </span>
              </label>
              <input
                type="text"
                placeholder="The.Matrix.1999.1080p.BluRay.x265.10bit.mkv"
                className="w-full px-3 py-2 border border-input rounded-md bg-background"
                value={previewData.filename}
                onChange={(e) => setPreviewData(prev => ({ ...prev, filename: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Year</label>
              <input
                type="number"
                placeholder="1999"
                className="w-full px-3 py-2 border border-input rounded-md bg-background"
                value={previewData.year}
                onChange={(e) => setPreviewData(prev => ({ ...prev, year: e.target.value }))}
              />
            </div>

            {previewData.contentType !== 'GAME' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Quality</label>
                <input
                  type="text"
                  placeholder="1080p"
                  className="w-full px-3 py-2 border border-input rounded-md bg-background"
                  value={previewData.quality}
                  onChange={(e) => setPreviewData(prev => ({ ...prev, quality: e.target.value }))}
                />
              </div>
            )}

            {previewData.contentType === 'TV_SHOW' && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Season</label>
                  <input
                    type="number"
                    placeholder="1"
                    className="w-full px-3 py-2 border border-input rounded-md bg-background"
                    value={previewData.season}
                    onChange={(e) => setPreviewData(prev => ({ ...prev, season: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Episode</label>
                  <input
                    type="number"
                    placeholder="1"
                    className="w-full px-3 py-2 border border-input rounded-md bg-background"
                    value={previewData.episode}
                    onChange={(e) => setPreviewData(prev => ({ ...prev, episode: e.target.value }))}
                  />
                </div>
              </>
            )}

            {previewData.contentType === 'GAME' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Platform</label>
                <select
                  className="w-full px-3 py-2 border border-input rounded-md bg-background"
                  value={previewData.platform}
                  onChange={(e) => setPreviewData(prev => ({ ...prev, platform: e.target.value }))}
                >
                  <option value="">Any Platform</option>
                  {platformOptions?.data?.map((option: any) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">
                {previewData.contentType === 'GAME' ? 'Region/Version' : 'Format'}
              </label>
              <input
                type="text"
                placeholder={previewData.contentType === 'GAME' ? 'NTSC-U' : 'BluRay'}
                className="w-full px-3 py-2 border border-input rounded-md bg-background"
                value={previewData.format}
                onChange={(e) => setPreviewData(prev => ({ ...prev, format: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Edition (Optional)</label>
              <input
                type="text"
                placeholder="Director's Cut"
                className="w-full px-3 py-2 border border-input rounded-md bg-background"
                value={previewData.edition}
                onChange={(e) => setPreviewData(prev => ({ ...prev, edition: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={generatePreview} disabled={!previewData.title && !previewData.filename.trim()}>
              Generate Preview
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                // Fill with example data based on content type
                const examples = {
                  MOVIE: {
                    title: 'The Matrix',
                    year: '1999',
                    quality: '1080p',
                    format: 'BluRay',
                    edition: 'Remastered',
                    filename: 'The.Matrix.1999.1080p.BluRay.x265.10bit.mkv'
                  },
                  TV_SHOW: {
                    title: 'Breaking Bad',
                    year: '2008',
                    season: '1',
                    episode: '1',
                    quality: '1080p',
                    format: 'BluRay',
                    filename: 'Breaking.Bad.S01E01.1080p.BluRay.x265.10bit.mkv'
                  },
                  GAME: {
                    title: 'Super Mario Bros',
                    year: '1985',
                    platform: 'nintendo-nes',
                    format: 'NTSC-U',
                    filename: 'Super Mario Bros (NES).zip'
                  }
                }

                const example = examples[previewData.contentType]
                setPreviewData(prev => ({ ...prev, ...example }))
              }}
            >
              Fill Example
            </Button>
          </div>

          {previewResult && (
            <div className="p-4 bg-muted rounded">
              <div className="text-sm space-y-1">
                <div><strong>Folder:</strong> <code>{previewResult.folderPath}</code></div>
                <div><strong>File:</strong> <code>{previewResult.fileName}</code></div>
                <div className="pt-2 border-t border-muted-foreground/20">
                  <strong>Full Path:</strong> <code className="text-xs break-all">{previewResult.fullPath}</code>
                </div>
              </div>
            </div>
          )}

          {!previewResult && (
            <div className="p-4 bg-muted rounded">
              <div className="text-sm text-muted-foreground">
                Fill in the form above and click "Generate Preview" to see how your files will be organized.
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Rule Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Organization Rule</DialogTitle>
            <DialogDescription>
              Create a new rule for organizing downloaded content
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="contentType">Content Type</Label>
              <Select
                value={formData.contentType}
                onValueChange={(value: 'MOVIE' | 'TV_SHOW' | 'GAME') => handleContentTypeChange(value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MOVIE">Movie</SelectItem>
                  <SelectItem value="TV_SHOW">TV Show</SelectItem>
                  <SelectItem value="GAME">Game</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="isDefault"
                  checked={formData.isDefault}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isDefault: checked }))}
                />
                <Label htmlFor="isDefault">Default rule for this content type</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
                />
                <Label htmlFor="isActive">Active</Label>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="folderPattern">Folder Name Pattern</Label>
              <Input
                id="folderPattern"
                value={formData.folderNamePattern}
                onChange={(e) => setFormData(prev => ({ ...prev, folderNamePattern: e.target.value }))}
                placeholder="e.g., {title} ({year})"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="filePattern">File Name Pattern</Label>
              <Input
                id="filePattern"
                value={formData.fileNamePattern}
                onChange={(e) => setFormData(prev => ({ ...prev, fileNamePattern: e.target.value }))}
                placeholder="e.g., {title} ({year}) - {quality} - {format}"
              />
            </div>

            {formData.contentType === 'TV_SHOW' && (
              <div className="space-y-2">
                <Label htmlFor="seasonPattern">Season Folder Pattern</Label>
                <Input
                  id="seasonPattern"
                  value={formData.seasonFolderPattern || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, seasonFolderPattern: e.target.value }))}
                  placeholder="e.g., Season {seasonNumber}"
                />
              </div>
            )}

            {formData.contentType === 'GAME' && (
              <div className="space-y-2">
                <Label htmlFor="platform">Platform (Optional)</Label>
                <Select
                  value={formData.platform || ''}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, platform: value === 'none' ? '' : value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select platform or leave empty for general rule" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No specific platform (general rule)</SelectItem>
                    {loadingPlatforms ? (
                      <SelectItem value="loading" disabled>
                        Loading platforms...
                      </SelectItem>
                    ) : (
                      platformOptions?.data?.map((platform: { value: string; label: string }) => (
                        <SelectItem key={platform.value} value={platform.value}>
                          {platform.label}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Leave empty for a general game rule, or specify a platform for platform-specific organization
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="basePath">Base Path Override (Optional)</Label>
              <Input
                id="basePath"
                value={formData.basePath || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, basePath: e.target.value }))}
                placeholder="e.g., /custom/path"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveRule}
              disabled={createRule.isPending || !formData.folderNamePattern || !formData.fileNamePattern}
            >
              {createRule.isPending ? 'Creating...' : 'Create Rule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Rule Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Organization Rule</DialogTitle>
            <DialogDescription>
              Modify the organization rule for {editingRule && getContentTypeLabel(editingRule.contentType)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Content Type</Label>
              <div className="p-2 bg-muted rounded">
                {editingRule && getContentTypeLabel(editingRule.contentType)}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="editIsDefault"
                  checked={formData.isDefault}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isDefault: checked }))}
                />
                <Label htmlFor="editIsDefault">Default rule for this content type</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="editIsActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
                />
                <Label htmlFor="editIsActive">Active</Label>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="editFolderPattern">Folder Name Pattern</Label>
              <Input
                id="editFolderPattern"
                value={formData.folderNamePattern}
                onChange={(e) => setFormData(prev => ({ ...prev, folderNamePattern: e.target.value }))}
                placeholder="e.g., {title} ({year})"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="editFilePattern">File Name Pattern</Label>
              <Input
                id="editFilePattern"
                value={formData.fileNamePattern}
                onChange={(e) => setFormData(prev => ({ ...prev, fileNamePattern: e.target.value }))}
                placeholder="e.g., {title} ({year}) - {quality} - {format}"
              />
            </div>

            {formData.contentType === 'TV_SHOW' && (
              <div className="space-y-2">
                <Label htmlFor="editSeasonPattern">Season Folder Pattern</Label>
                <Input
                  id="editSeasonPattern"
                  value={formData.seasonFolderPattern || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, seasonFolderPattern: e.target.value }))}
                  placeholder="e.g., Season {seasonNumber}"
                />
              </div>
            )}

            {formData.contentType === 'GAME' && (
              <div className="space-y-2">
                <Label htmlFor="editPlatform">Platform (Optional)</Label>
                <Select
                  value={formData.platform || ''}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, platform: value === 'none' ? '' : value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select platform or leave empty for general rule" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No specific platform (general rule)</SelectItem>
                    {loadingPlatforms ? (
                      <SelectItem value="loading" disabled>
                        Loading platforms...
                      </SelectItem>
                    ) : (
                      platformOptions?.data?.map((platform: { value: string; label: string }) => (
                        <SelectItem key={platform.value} value={platform.value}>
                          {platform.label}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Leave empty for a general game rule, or specify a platform for platform-specific organization
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="editBasePath">Base Path Override (Optional)</Label>
              <Input
                id="editBasePath"
                value={formData.basePath || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, basePath: e.target.value }))}
                placeholder="e.g., /custom/path"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveRule}
              disabled={updateRule.isPending || !formData.folderNamePattern || !formData.fileNamePattern}
            >
              {updateRule.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
