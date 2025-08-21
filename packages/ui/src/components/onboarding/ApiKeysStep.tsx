import { Button } from '@/components/ui/button'
import { AlertCircle } from 'lucide-react'
import ApiKeysSettings from '@/components/settings/ApiKeysSettings'

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
  const hasAnyApiKey = data.omdbApiKey || data.tmdbApiKey || data.igdbClientId

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">🔑</span>
          </div>
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

        <ApiKeysSettings
          data={{
            omdbApiKey: data.omdbApiKey,
            tmdbApiKey: data.tmdbApiKey,
            igdbClientId: data.igdbClientId,
            igdbClientSecret: data.igdbClientSecret,
          }}
          onUpdate={onUpdate}
          showSaveButton={false}
        />
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
