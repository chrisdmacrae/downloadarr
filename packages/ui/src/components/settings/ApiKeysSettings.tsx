import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ExternalLink, Film, Gamepad2, Eye, EyeOff, Save } from 'lucide-react'

interface ApiKeysData {
  omdbApiKey?: string
  tmdbApiKey?: string
  igdbClientId?: string
  igdbClientSecret?: string
}

interface ApiKeysSettingsProps {
  data: ApiKeysData
  onUpdate: (updates: Partial<ApiKeysData>) => void
  onSave?: () => void
  isLoading?: boolean
  showSaveButton?: boolean
}

export default function ApiKeysSettings({ 
  data, 
  onUpdate, 
  onSave, 
  isLoading = false,
  showSaveButton = true 
}: ApiKeysSettingsProps) {
  const [showSecrets, setShowSecrets] = useState({
    omdb: false,
    tmdb: false,
    igdbSecret: false,
  })

  const handleInputChange = (field: keyof ApiKeysData, value: string) => {
    onUpdate({ [field]: value || undefined })
  }

  const toggleSecretVisibility = (field: keyof typeof showSecrets) => {
    setShowSecrets(prev => ({ ...prev, [field]: !prev[field] }))
  }

  const hasAnyApiKey = data.omdbApiKey || data.tmdbApiKey || data.igdbClientId

  return (
    <Card>
      <CardHeader>
        <CardTitle>External API Keys</CardTitle>
        <CardDescription>
          Configure optional API keys for enhanced metadata and discovery features
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          {/* OMDB API Key */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center">
                <Film className="w-4 h-4 mr-2" />
                OMDB API Key
                <span className="ml-2 text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded">
                  Optional
                </span>
              </CardTitle>
              <CardDescription>
                For movie and TV show metadata. Get your free key from{' '}
                <a 
                  href="http://www.omdbapi.com/apikey.aspx" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center"
                >
                  omdbapi.com <ExternalLink className="w-3 h-3 ml-1" />
                </a>
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                <Label htmlFor="omdbApiKey">API Key</Label>
                <div className="relative">
                  <Input
                    id="omdbApiKey"
                    type={showSecrets.omdb ? 'text' : 'password'}
                    value={data.omdbApiKey || ''}
                    onChange={(e) => handleInputChange('omdbApiKey', e.target.value)}
                    placeholder="Enter your OMDB API key"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => toggleSecretVisibility('omdb')}
                  >
                    {showSecrets.omdb ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* TMDB API Key */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center">
                <Film className="w-4 h-4 mr-2" />
                TMDB API Key
                <span className="ml-2 text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded">
                  Optional
                </span>
              </CardTitle>
              <CardDescription>
                For enhanced movie and TV show data. Get your free key from{' '}
                <a 
                  href="https://www.themoviedb.org/settings/api" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center"
                >
                  themoviedb.org <ExternalLink className="w-3 h-3 ml-1" />
                </a>
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                <Label htmlFor="tmdbApiKey">API Key</Label>
                <div className="relative">
                  <Input
                    id="tmdbApiKey"
                    type={showSecrets.tmdb ? 'text' : 'password'}
                    value={data.tmdbApiKey || ''}
                    onChange={(e) => handleInputChange('tmdbApiKey', e.target.value)}
                    placeholder="Enter your TMDB API key"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => toggleSecretVisibility('tmdb')}
                  >
                    {showSecrets.tmdb ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* IGDB API Keys */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center">
                <Gamepad2 className="w-4 h-4 mr-2" />
                IGDB API Keys
                <span className="ml-2 text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded">
                  Optional
                </span>
              </CardTitle>
              <CardDescription>
                For game metadata and artwork. Get your free keys from{' '}
                <a 
                  href="https://api-docs.igdb.com/#getting-started" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center"
                >
                  IGDB API <ExternalLink className="w-3 h-3 ml-1" />
                </a>
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="igdbClientId">Client ID</Label>
                  <Input
                    id="igdbClientId"
                    type="text"
                    value={data.igdbClientId || ''}
                    onChange={(e) => handleInputChange('igdbClientId', e.target.value)}
                    placeholder="Enter your IGDB Client ID"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="igdbClientSecret">Client Secret</Label>
                  <div className="relative">
                    <Input
                      id="igdbClientSecret"
                      type={showSecrets.igdbSecret ? 'text' : 'password'}
                      value={data.igdbClientSecret || ''}
                      onChange={(e) => handleInputChange('igdbClientSecret', e.target.value)}
                      placeholder="Enter your IGDB Client Secret"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => toggleSecretVisibility('igdbSecret')}
                    >
                      {showSecrets.igdbSecret ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {hasAnyApiKey && (
          <div className="bg-green-50 dark:bg-green-950/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <p className="text-sm font-medium text-green-900 dark:text-green-100">
                API keys configured for enhanced functionality
              </p>
            </div>
          </div>
        )}

        <div className="bg-gray-50 dark:bg-gray-950/20 p-4 rounded-lg border">
          <p className="text-sm text-muted-foreground">
            <strong>Note:</strong> These API keys are optional. Downloadarr will work without them, 
            but some discovery and metadata features may be limited.
          </p>
        </div>

        {showSaveButton && onSave && (
          <div className="flex justify-end">
            <Button onClick={onSave} disabled={isLoading}>
              {isLoading ? (
                <>
                  <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save API Keys
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
