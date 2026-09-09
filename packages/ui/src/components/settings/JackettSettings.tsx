import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ExternalLink, Eye, EyeOff, Save, TestTube } from 'lucide-react'
import { jackettUrl } from '@/lib/services'

interface JackettData {
  jackettApiKey?: string
  jackettUrl?: string
  /** FlareSolverr, for indexers behind Cloudflare. */
  flaresolverrUrl?: string
}

interface JackettSettingsProps {
  data: JackettData
  onUpdate: (updates: Partial<JackettData>) => void
  onSave?: () => void
  onTest?: () => void
  isLoading?: boolean
  isTesting?: boolean
  showSaveButton?: boolean
  showTestButton?: boolean
}

export default function JackettSettings({ 
  data, 
  onUpdate, 
  onSave, 
  onTest,
  isLoading = false,
  isTesting = false,
  showSaveButton = true,
  showTestButton = true
}: JackettSettingsProps) {
  const [showApiKey, setShowApiKey] = useState(false)

  const handleInputChange = (field: keyof JackettData, value: string) => {
    onUpdate({ [field]: value || undefined })
  }

  const openJackett = () => {
    window.open(jackettUrl(data.jackettUrl), '_blank', 'noopener,noreferrer')
  }

  const isValidUrl = (url: string) => {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  }

  const isValidApiKey = data.jackettApiKey && data.jackettApiKey.trim().length > 0
  const isValidJackettUrl = data.jackettUrl && isValidUrl(data.jackettUrl)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Jackett</CardTitle>
        <CardDescription>
          Configure Jackett for torrent search across multiple indexers
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-card border border-hairline bg-white/[.05] p-4">
          <div className="space-y-2">
            <h4 className="text-sm font-bold text-fg-primary">How to get your Jackett API key</h4>
            <ol className="list-inside list-decimal space-y-1 text-sm text-fg-secondary">
              <li>Click "Open Jackett" below to reach its web interface</li>
              <li>Find the "API Key" section on the dashboard</li>
              <li>Copy the key and paste it into the field below</li>
            </ol>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="jackettUrl">Jackett URL</Label>
            <div className="flex space-x-2">
              <Input
                id="jackettUrl"
                type="url"
                placeholder="http://localhost:9117"
                className="flex-1 font-mono"
                value={data.jackettUrl || ''}
                onChange={(e) => handleInputChange('jackettUrl', e.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                onClick={openJackett}
                className="flex items-center space-x-2"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Open Jackett</span>
              </Button>
            </div>
            {data.jackettUrl && !isValidJackettUrl && (
              <p className="text-sm text-status-failed">Please enter a valid URL</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="jackettApiKey">API key</Label>
            <div className="relative">
              <Input
                id="jackettApiKey"
                type={showApiKey ? 'text' : 'password'}
                placeholder="Enter your Jackett API key"
                value={data.jackettApiKey || ''}
                onChange={(e) => handleInputChange('jackettApiKey', e.target.value)}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
            {data.jackettApiKey && !isValidApiKey && (
              <p className="text-sm text-status-failed">Please enter a valid API key</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="flaresolverrUrl">FlareSolverr URL</Label>
            <Input
              id="flaresolverrUrl"
              type="url"
              className="font-mono"
              placeholder="http://flaresolverr:8191"
              value={data.flaresolverrUrl || ''}
              onChange={(e) => handleInputChange('flaresolverrUrl', e.target.value)}
            />
            <p className="text-xs text-fg-muted">
              Optional. Indexers behind Cloudflare need FlareSolverr; leave empty to fall back to
              the FLARESOLVERR_URL environment variable.
            </p>
            {data.flaresolverrUrl && !isValidUrl(data.flaresolverrUrl) && (
              <p className="text-sm text-status-failed">Please enter a valid URL</p>
            )}
          </div>
        </div>

        {isValidApiKey && isValidJackettUrl && (
          <div className="rounded-card border border-hairline bg-white/[.08] p-4">
            <div className="flex items-center gap-2.5">
              <span className="h-1.5 w-1.5 rounded-pill bg-[color:var(--status-completed)]" />
              <p className="text-sm font-medium text-fg-primary">Jackett configuration looks good</p>
            </div>
          </div>
        )}

        <div className="rounded-card border border-hairline bg-white/[.05] p-4">
          <p className="text-sm text-fg-secondary">
            <strong className="text-fg-primary">Note:</strong> Jackett is required for torrent
            search. Make sure it is running and reachable at the configured URL.
          </p>
        </div>

        {(showSaveButton || showTestButton) && (
          <div className="flex justify-end space-x-2">
            {showTestButton && onTest && (
              <Button 
                variant="outline" 
                onClick={onTest} 
                disabled={!isValidApiKey || !isValidJackettUrl || isTesting}
              >
                {isTesting ? (
                  <>
                    <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Testing…
                  </>
                ) : (
                  <>
                    <TestTube className="w-4 h-4 mr-2" />
                    Test connection
                  </>
                )}
              </Button>
            )}
            {showSaveButton && onSave && (
              <Button onClick={onSave} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save configuration
                  </>
                )}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
