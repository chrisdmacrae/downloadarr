import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { useOrganizationSettings, useUpdateOrganizationSettings, useTriggerReverseIndexing, useReverseIndexingStatus } from '@/hooks/useApi'
import { useAppConfiguration, useUpdateAppConfiguration } from '@/hooks/useOnboarding'
import ApiKeysSettings from '@/components/settings/ApiKeysSettings'
import JackettSettings from '@/components/settings/JackettSettings'
import type { OrganizationSettings } from '@/services/api'

export default function Settings() {
  const { toast } = useToast()
  const { data: settings, isLoading: settingsLoading } = useOrganizationSettings()
  const { data: reverseIndexingStatus } = useReverseIndexingStatus()
  const { data: appConfig, isLoading: appConfigLoading } = useAppConfiguration()
  const updateSettings = useUpdateOrganizationSettings()
  const updateAppConfig = useUpdateAppConfiguration()
  const triggerReverseIndexing = useTriggerReverseIndexing()

  // Local state for forms
  const [formData, setFormData] = useState<Partial<OrganizationSettings>>({})
  const [appConfigData, setAppConfigData] = useState({
    jackettApiKey: '',
    jackettUrl: '',
    omdbApiKey: '',
    tmdbApiKey: '',
    igdbClientId: '',
    igdbClientSecret: '',
  })

  // Update form data when settings are loaded
  useEffect(() => {
    if (settings) {
      setFormData(settings)
    }
  }, [settings])

  // Update app config data when loaded
  useEffect(() => {
    if (appConfig) {
      setAppConfigData({
        jackettApiKey: appConfig.jackettApiKey || '',
        jackettUrl: appConfig.jackettUrl || '',
        omdbApiKey: appConfig.omdbApiKey || '',
        tmdbApiKey: appConfig.tmdbApiKey || '',
        igdbClientId: appConfig.igdbClientId || '',
        igdbClientSecret: appConfig.igdbClientSecret || '',
      })
    }
  }, [appConfig])

  const handleInputChange = (field: keyof OrganizationSettings, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleAppConfigChange = (updates: Partial<typeof appConfigData>) => {
    setAppConfigData(prev => ({ ...prev, ...updates }))
  }

  const handleSaveJackettConfig = async () => {
    try {
      await updateAppConfig.mutateAsync({
        jackettApiKey: appConfigData.jackettApiKey || undefined,
        jackettUrl: appConfigData.jackettUrl || undefined,
      })
      toast({
        title: "Jackett settings saved",
        description: "Jackett configuration has been updated successfully.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save Jackett settings. Please try again.",
      })
    }
  }

  const handleSaveApiKeys = async () => {
    try {
      await updateAppConfig.mutateAsync({
        omdbApiKey: appConfigData.omdbApiKey || undefined,
        tmdbApiKey: appConfigData.tmdbApiKey || undefined,
        igdbClientId: appConfigData.igdbClientId || undefined,
        igdbClientSecret: appConfigData.igdbClientSecret || undefined,
      })
      toast({
        title: "API keys saved",
        description: "External API keys have been updated successfully.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save API keys. Please try again.",
      })
    }
  }

  const handleSwitchChange = (field: keyof OrganizationSettings, checked: boolean) => {
    setFormData(prev => ({ ...prev, [field]: checked }))
  }

  const handleSaveSettings = async () => {
    try {
      // Filter out read-only fields before sending the update
      const updateData = {
        libraryPath: formData.libraryPath,
        moviesPath: formData.moviesPath,
        tvShowsPath: formData.tvShowsPath,
        gamesPath: formData.gamesPath,
        organizeOnComplete: formData.organizeOnComplete,
        replaceExistingFiles: formData.replaceExistingFiles,
        extractArchives: formData.extractArchives,
        deleteAfterExtraction: formData.deleteAfterExtraction,
        enableReverseIndexing: formData.enableReverseIndexing,
        reverseIndexingCron: formData.reverseIndexingCron,
      }

      await updateSettings.mutateAsync(updateData)
      toast({
        title: "Settings saved",
        description: "Organization settings have been updated successfully.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save organization settings. Please try again.",
      })
    }
  }

  const handleTriggerReverseIndexing = async () => {
    try {
      const result = await triggerReverseIndexing.mutateAsync()
      toast({
        title: "Reverse indexing started",
        description: result.message,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to start reverse indexing. Please try again.",
      })
    }
  }

  const handleResetToDefaults = () => {
    if (settings) {
      setFormData({
        libraryPath: '/library',
        moviesPath: '',
        tvShowsPath: '',
        gamesPath: '',
        organizeOnComplete: true,
        replaceExistingFiles: true,
        extractArchives: true,
        deleteAfterExtraction: true,
        enableReverseIndexing: true,
        reverseIndexingCron: '0 * * * *',
      })
    }
  }

  if (settingsLoading || appConfigLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Configure your downloadarr instance</p>
        </div>

        {/* Download Settings Skeleton */}
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-96" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="flex space-x-2">
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-10 w-40" />
            </div>
          </CardContent>
        </Card>

        {/* Jackett Settings Skeleton */}
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="flex space-x-2">
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-10 w-48" />
            </div>
          </CardContent>
        </Card>

        {/* API Keys Settings Skeleton */}
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-80" />
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
            <div className="flex justify-end">
              <Skeleton className="h-10 w-32" />
            </div>
          </CardContent>
        </Card>

        {/* Organization Settings Skeleton */}
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-80" />
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Library Paths Skeleton */}
            <div className="space-y-4">
              <Skeleton className="h-5 w-32" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-10 w-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-10 w-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-10 w-full" />
                </div>
              </div>
            </div>

            {/* Organization Behavior Skeleton */}
            <div className="space-y-4">
              <Skeleton className="h-5 w-48" />
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-80" />
                    </div>
                    <Skeleton className="h-6 w-11 rounded-full" />
                  </div>
                ))}
              </div>
            </div>

            {/* Reverse Indexing Skeleton */}
            <div className="space-y-4">
              <Skeleton className="h-5 w-40" />
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Skeleton className="h-4 w-44" />
                  <Skeleton className="h-3 w-96" />
                </div>
                <Skeleton className="h-6 w-11 rounded-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="flex space-x-2">
                <Skeleton className="h-10 w-24" />
                <Skeleton className="h-10 w-32" />
              </div>
            </div>

            <div className="flex space-x-2">
              <Skeleton className="h-10 w-48" />
              <Skeleton className="h-10 w-36" />
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Configure your download preferences and system settings
        </p>
      </div>

      <div className="grid gap-6">
        {/* Jackett Settings */}
        <JackettSettings
          data={{
            jackettApiKey: appConfigData.jackettApiKey,
            jackettUrl: appConfigData.jackettUrl,
          }}
          onUpdate={handleAppConfigChange}
          onSave={handleSaveJackettConfig}
          isLoading={updateAppConfig.isPending}
        />

        {/* API Keys Settings */}
        <ApiKeysSettings
          data={{
            omdbApiKey: appConfigData.omdbApiKey,
            tmdbApiKey: appConfigData.tmdbApiKey,
            igdbClientId: appConfigData.igdbClientId,
            igdbClientSecret: appConfigData.igdbClientSecret,
          }}
          onUpdate={handleAppConfigChange}
          onSave={handleSaveApiKeys}
          isLoading={updateAppConfig.isPending}
        />

        {/* Organization Settings */}
        <Card>
          <CardHeader>
            <CardTitle>File Organization</CardTitle>
            <CardDescription>
              Configure how downloaded files are organized and renamed
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Library Paths */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Library Paths</h4>

              <div className="space-y-2">
                <label className="text-sm font-medium">Base Library Path</label>
                <input
                  type="text"
                  placeholder="/library"
                  value={formData.libraryPath || ''}
                  onChange={(e) => handleInputChange('libraryPath', e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Movies Path</label>
                  <input
                    type="text"
                    placeholder="/library/movies"
                    value={formData.moviesPath || ''}
                    onChange={(e) => handleInputChange('moviesPath', e.target.value)}
                    className="w-full px-3 py-2 border border-input rounded-md bg-background"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">TV Shows Path</label>
                  <input
                    type="text"
                    placeholder="/library/tv-shows"
                    value={formData.tvShowsPath || ''}
                    onChange={(e) => handleInputChange('tvShowsPath', e.target.value)}
                    className="w-full px-3 py-2 border border-input rounded-md bg-background"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Games Path</label>
                  <input
                    type="text"
                    placeholder="/library/games"
                    value={formData.gamesPath || ''}
                    onChange={(e) => handleInputChange('gamesPath', e.target.value)}
                    className="w-full px-3 py-2 border border-input rounded-md bg-background"
                  />
                </div>
              </div>
            </div>

            {/* Organization Behavior */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Organization Behavior</h4>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Organize on Download Complete</p>
                    <p className="text-sm text-muted-foreground">
                      Automatically organize files when downloads finish
                    </p>
                  </div>
                  <Switch
                    checked={formData.organizeOnComplete || false}
                    onCheckedChange={(checked) => handleSwitchChange('organizeOnComplete', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Replace Existing Files</p>
                    <p className="text-sm text-muted-foreground">
                      Replace files if they already exist in the library
                    </p>
                  </div>
                  <Switch
                    checked={formData.replaceExistingFiles || false}
                    onCheckedChange={(checked) => handleSwitchChange('replaceExistingFiles', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Extract Archives</p>
                    <p className="text-sm text-muted-foreground">
                      Automatically extract ZIP, RAR, and other archives
                    </p>
                  </div>
                  <Switch
                    checked={formData.extractArchives || false}
                    onCheckedChange={(checked) => handleSwitchChange('extractArchives', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Delete After Extraction</p>
                    <p className="text-sm text-muted-foreground">
                      Delete archive files after successful extraction
                    </p>
                  </div>
                  <Switch
                    checked={formData.deleteAfterExtraction || false}
                    onCheckedChange={(checked) => handleSwitchChange('deleteAfterExtraction', checked)}
                  />
                </div>
              </div>
            </div>

            {/* Reverse Indexing */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Reverse Indexing</h4>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Enable Reverse Indexing</p>
                  <p className="text-sm text-muted-foreground">
                    Scan library directories and add existing files to the database
                  </p>
                </div>
                <Switch
                  checked={formData.enableReverseIndexing || false}
                  onCheckedChange={(checked) => handleSwitchChange('enableReverseIndexing', checked)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Scan Schedule</label>
                <select
                  className="w-full px-3 py-2 border border-input rounded-md bg-background"
                  value={formData.reverseIndexingCron || '0 * * * *'}
                  onChange={(e) => handleInputChange('reverseIndexingCron', e.target.value)}
                >
                  <option value="0 * * * *">Every hour</option>
                  <option value="0 */6 * * *">Every 6 hours</option>
                  <option value="0 0 * * *">Daily</option>
                  <option value="0 0 * * 0">Weekly</option>
                </select>
              </div>

              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  onClick={handleTriggerReverseIndexing}
                  disabled={triggerReverseIndexing.isPending || reverseIndexingStatus?.isRunning}
                >
                  {reverseIndexingStatus?.isRunning ? 'Scanning...' : 'Scan Now'}
                </Button>
                <Button variant="outline">
                  {reverseIndexingStatus?.isRunning ? 'Running' : 'Idle'}
                </Button>
              </div>
            </div>

            <div className="flex space-x-2">
              <Button
                onClick={handleSaveSettings}
                disabled={updateSettings.isPending}
              >
                {updateSettings.isPending ? 'Saving...' : 'Save Organization Settings'}
              </Button>
              <Button
                variant="outline"
                onClick={handleResetToDefaults}
              >
                Reset to Defaults
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
