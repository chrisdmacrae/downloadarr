import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ExternalLink, Eye, EyeOff } from 'lucide-react'

interface JackettStepProps {
  data: {
    jackettApiKey: string
    organizationEnabled: boolean
  }
  onUpdate: (updates: Partial<{ jackettApiKey: string; organizationEnabled: boolean }>) => void
  onNext: () => void
}

export default function JackettStep({ data, onUpdate, onNext }: JackettStepProps) {
  const [showApiKey, setShowApiKey] = useState(false)
  const [isValidating, setIsValidating] = useState(false)

  const handleApiKeyChange = (value: string) => {
    onUpdate({ jackettApiKey: value })
  }

  const handleNext = async () => {
    if (!data.jackettApiKey.trim()) {
      return
    }

    setIsValidating(true)
    // Here you could add API key validation if needed
    setTimeout(() => {
      setIsValidating(false)
      onNext()
    }, 500)
  }

  const openJackett = () => {
    window.open('http://localhost:9117', '_blank')
  }

  const isValid = data.jackettApiKey.trim().length > 0

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold mb-2">Configure Jackett</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Jackett is required to search for torrents across multiple indexers. 
            You'll need to get your API key from the Jackett web interface.
          </p>
        </div>

        <div className="bg-muted/50 p-4 rounded-lg">
          <h4 className="font-medium mb-2">How to get your Jackett API key:</h4>
          <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
            <li>Click the button below to open Jackett</li>
            <li>Look for the "API Key" section on the dashboard</li>
            <li>Copy the API key and paste it below</li>
          </ol>
        </div>

        <Button 
          variant="outline" 
          onClick={openJackett}
          className="w-full"
        >
          <ExternalLink className="w-4 h-4 mr-2" />
          Open Jackett (http://localhost:9117)
        </Button>

        <div className="space-y-2">
          <Label htmlFor="jackett-api-key">Jackett API Key</Label>
          <div className="relative">
            <Input
              id="jackett-api-key"
              type={showApiKey ? 'text' : 'password'}
              placeholder="Enter your Jackett API key"
              value={data.jackettApiKey}
              onChange={(e) => handleApiKeyChange(e.target.value)}
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
          {!isValid && data.jackettApiKey.length > 0 && (
            <p className="text-sm text-destructive">Please enter a valid API key</p>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <Button 
          onClick={handleNext}
          disabled={!isValid || isValidating}
        >
          {isValidating ? 'Validating...' : 'Continue'}
        </Button>
      </div>
    </div>
  )
}
