import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ExternalLink, Eye, EyeOff, Save, TestTube } from 'lucide-react'

interface JackettData {
  jackettApiKey?: string
  jackettUrl?: string
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
    const url = data.jackettUrl || 'http://localhost:9117'
    window.open(url, '_blank')
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
        <CardTitle>Jackett Integration</CardTitle>
        <CardDescription>
          Configure Jackett for torrent search across multiple indexers
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="space-y-2">
            <h4 className="font-medium text-blue-900 dark:text-blue-100">
              How to get your Jackett API key:
            </h4>
            <ol className="text-sm text-blue-700 dark:text-blue-300 space-y-1 list-decimal list-inside">
              <li>Click "Open Jackett" below to access the web interface</li>
              <li>Look for the "API Key" section on the dashboard</li>
              <li>Copy the API key and paste it in the field below</li>
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
                value={data.jackettUrl || ''}
                onChange={(e) => handleInputChange('jackettUrl', e.target.value)}
                className="flex-1"
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
              <p className="text-sm text-destructive">Please enter a valid URL</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="jackettApiKey">API Key</Label>
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
              <p className="text-sm text-destructive">Please enter a valid API key</p>
            )}
          </div>
        </div>

        {isValidApiKey && isValidJackettUrl && (
          <div className="bg-green-50 dark:bg-green-950/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <p className="text-sm font-medium text-green-900 dark:text-green-100">
                Jackett configuration looks good!
              </p>
            </div>
          </div>
        )}

        <div className="bg-gray-50 dark:bg-gray-950/20 p-4 rounded-lg border">
          <p className="text-sm text-muted-foreground">
            <strong>Note:</strong> Jackett is required for torrent search functionality. 
            Make sure Jackett is running and accessible at the configured URL.
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
                    Testing...
                  </>
                ) : (
                  <>
                    <TestTube className="w-4 h-4 mr-2" />
                    Test Connection
                  </>
                )}
              </Button>
            )}
            {showSaveButton && onSave && (
              <Button onClick={onSave} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Configuration
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
