import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ExternalLink, Key, Film, Gamepad2, AlertCircle, CheckCircle } from 'lucide-react'

interface ApiKeysStepProps {
  data: {
    jackettApiKey: string
    organizationEnabled: boolean
    omdbApiKey?: string
    tmdbApiKey?: string
    igdbClientId?: string
    igdbClientSecret?: string
  }
  onUpdate: (updates: any) => void
  onNext: () => void
  onPrevious: () => void
}

export default function ApiKeysStep({ data, onUpdate, onNext, onPrevious }: ApiKeysStepProps) {
  const [showSecrets, setShowSecrets] = useState({
    omdb: false,
    tmdb: false,
    igdbSecret: false,
  })

  const handleInputChange = (field: string, value: string) => {
    onUpdate({ [field]: value })
  }

  const toggleSecretVisibility = (field: keyof typeof showSecrets) => {
    setShowSecrets(prev => ({ ...prev, [field]: !prev[field] }))
  }

  const hasAnyApiKey = data.omdbApiKey || data.tmdbApiKey || data.igdbClientId

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="text-center">
          <Key className="w-16 h-16 text-blue-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">External API Keys (Optional)</h3>
          <p className="text-sm text-muted-foreground">
            Configure API keys for enhanced movie, TV show, and game discovery. These are optional but recommended for the best experience.
          </p>
        </div>

        <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                Why configure API keys?
              </p>
              <ul className="text-blue-700 dark:text-blue-300 space-y-1">
                <li>• Get detailed metadata, posters, and descriptions</li>
                <li>• Enable movie and TV show discovery features</li>
                <li>• Access game information and artwork</li>
                <li>• Improve search accuracy and results</li>
              </ul>
            </div>
          </div>
        </div>

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
                    {showSecrets.omdb ? '👁️' : '👁️‍🗨️'}
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
                    {showSecrets.tmdb ? '👁️' : '👁️‍🗨️'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* IGDB Credentials */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center">
                <Gamepad2 className="w-4 h-4 mr-2" />
                IGDB Credentials
                <span className="ml-2 text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded">
                  Optional
                </span>
              </CardTitle>
              <CardDescription>
                For game metadata and discovery. Create a Twitch application at{' '}
                <a 
                  href="https://dev.twitch.tv/console/apps" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center"
                >
                  dev.twitch.tv <ExternalLink className="w-3 h-3 ml-1" />
                </a>
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-4">
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
                      {showSecrets.igdbSecret ? '👁️' : '👁️‍🗨️'}
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
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
              <p className="text-sm font-medium text-green-900 dark:text-green-100">
                Great! You've configured some API keys for enhanced functionality.
              </p>
            </div>
          </div>
        )}

        <div className="bg-gray-50 dark:bg-gray-950/20 p-4 rounded-lg border">
          <p className="text-sm text-muted-foreground">
            <strong>Note:</strong> You can skip this step and configure API keys later in the settings. 
            Downloadarr will work without them, but some discovery features may be limited.
          </p>
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onPrevious}>
          Previous
        </Button>
        <Button onClick={onNext}>
          {hasAnyApiKey ? 'Continue with API Keys' : 'Skip for Now'}
        </Button>
      </div>
    </div>
  )
}
