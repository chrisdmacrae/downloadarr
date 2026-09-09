import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ExternalLink, Eye, EyeOff, Save, TestTube } from 'lucide-react'
import { prowlarrUrl } from '@/lib/services'

interface ProwlarrData {
  prowlarrApiKey?: string
  prowlarrUrl?: string
  /** FlareSolverr, for indexers behind Cloudflare. */
  flaresolverrUrl?: string
}

interface ProwlarrSettingsProps {
  data: ProwlarrData
  onUpdate: (updates: Partial<ProwlarrData>) => void
  onSave?: () => void
  onTest?: () => void
  isLoading?: boolean
  isTesting?: boolean
  showSaveButton?: boolean
  showTestButton?: boolean
}

export default function ProwlarrSettings({
  data,
  onUpdate,
  onSave,
  onTest,
  isLoading = false,
  isTesting = false,
  showSaveButton = true,
  showTestButton = true
}: ProwlarrSettingsProps) {
  const [showApiKey, setShowApiKey] = useState(false)

  const handleInputChange = (field: keyof ProwlarrData, value: string) => {
    onUpdate({ [field]: value || undefined })
  }

  const openProwlarr = () => {
    window.open(prowlarrUrl(data.prowlarrUrl), '_blank', 'noopener,noreferrer')
  }

  const isValidUrl = (url: string) => {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  }

  const isValidApiKey = data.prowlarrApiKey && data.prowlarrApiKey.trim().length > 0
  const isValidProwlarrUrl = data.prowlarrUrl && isValidUrl(data.prowlarrUrl)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Prowlarr</CardTitle>
        <CardDescription>
          Configure Prowlarr for torrent search across multiple indexers
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-card border border-hairline bg-white/[.05] p-4">
          <div className="space-y-2">
            <h4 className="text-sm font-bold text-fg-primary">How to get your Prowlarr API key</h4>
            <ol className="list-inside list-decimal space-y-1 text-sm text-fg-secondary">
              <li>Click "Open Prowlarr" below to reach its web interface</li>
              <li>Go to Settings → General and find the "API Key" field</li>
              <li>Copy the key and paste it into the field below</li>
            </ol>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="prowlarrUrl">Prowlarr URL</Label>
            <div className="flex space-x-2">
              <Input
                id="prowlarrUrl"
                type="url"
                placeholder="http://localhost:9696"
                className="flex-1 font-mono"
                value={data.prowlarrUrl || ''}
                onChange={(e) => handleInputChange('prowlarrUrl', e.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                onClick={openProwlarr}
                className="flex items-center space-x-2"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Open Prowlarr</span>
              </Button>
            </div>
            {data.prowlarrUrl && !isValidProwlarrUrl && (
              <p className="text-sm text-status-failed">Please enter a valid URL</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="prowlarrApiKey">API key</Label>
            <div className="relative">
              <Input
                id="prowlarrApiKey"
                type={showApiKey ? 'text' : 'password'}
                placeholder="Enter your Prowlarr API key"
                value={data.prowlarrApiKey || ''}
                onChange={(e) => handleInputChange('prowlarrApiKey', e.target.value)}
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
            {data.prowlarrApiKey && !isValidApiKey && (
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
              Optional. Downloadarr registers this as a FlareSolverr proxy in Prowlarr and creates a{' '}
              <code className="font-mono">flaresolverr</code> tag — add that tag to any indexer behind
              Cloudflare. Leave empty to fall back to the FLARESOLVERR_URL environment variable.
            </p>
            {data.flaresolverrUrl && !isValidUrl(data.flaresolverrUrl) && (
              <p className="text-sm text-status-failed">Please enter a valid URL</p>
            )}
          </div>
        </div>

        {isValidApiKey && isValidProwlarrUrl && (
          <div className="rounded-card border border-hairline bg-white/[.08] p-4">
            <div className="flex items-center gap-2.5">
              <span className="h-1.5 w-1.5 rounded-pill bg-[color:var(--status-completed)]" />
              <p className="text-sm font-medium text-fg-primary">Prowlarr configuration looks good</p>
            </div>
          </div>
        )}

        <div className="rounded-card border border-hairline bg-white/[.05] p-4">
          <p className="text-sm text-fg-secondary">
            <strong className="text-fg-primary">Note:</strong> Prowlarr is required for torrent
            search. Make sure it is running, reachable at the configured URL, and has at least one
            indexer added.
          </p>
        </div>

        {(showSaveButton || showTestButton) && (
          <div className="flex justify-end space-x-2">
            {showTestButton && onTest && (
              <Button
                variant="outline"
                onClick={onTest}
                disabled={!isValidApiKey || !isValidProwlarrUrl || isTesting}
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
