import { Button } from '@/components/ui/button'
import { AlertCircle } from 'lucide-react'
import ApiKeysSettings from '@/components/settings/ApiKeysSettings'
import { ServiceLinks } from '@/components/settings/ServiceLinks'

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
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-pill bg-[color:var(--accent-quiet)]">
            <span className="text-2xl">🔑</span>
          </div>
          <h3 className="text-lg font-semibold mb-2">External API Keys (Optional)</h3>
          <p className="text-sm text-fg-secondary">
            Configure API keys for enhanced movie, TV show, and game discovery. These are optional but recommended for the best experience.
          </p>
        </div>

        <div className="rounded-card border border-hairline bg-white/[.05] p-4">
          <div className="flex items-start space-x-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-fg-secondary" />
            <div className="text-sm">
              <p className="mb-1 font-medium text-fg-primary">
                Why configure API keys?
              </p>
              <ul className="space-y-1 text-fg-secondary">
                <li>• Get detailed metadata, posters, and descriptions</li>
                <li>• Enable movie and TV show discovery features</li>
                <li>• Access game information and artwork</li>
                <li>• Improve search accuracy and results</li>
              </ul>
            </div>
          </div>
        </div>

        <ServiceLinks variant="providers" />

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
