import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Radar } from 'lucide-react'
import ProwlarrSettings from '@/components/settings/ProwlarrSettings'
import { prowlarrUrl } from '@/lib/services'

interface ProwlarrStepProps {
  data: {
    prowlarrApiKey: string
    organizationEnabled: boolean
    prowlarrUrl?: string
  }
  onUpdate: (updates: Partial<{ prowlarrApiKey: string; organizationEnabled: boolean; prowlarrUrl?: string }>) => void
  onNext: () => void
}

export default function ProwlarrStep({ data, onUpdate, onNext }: ProwlarrStepProps) {
  const [isValidating, setIsValidating] = useState(false)

  const handleNext = async () => {
    if (!data.prowlarrApiKey.trim()) {
      return
    }

    setIsValidating(true)
    // Here you could add API key validation if needed
    setTimeout(() => {
      setIsValidating(false)
      onNext()
    }, 500)
  }

  const isValid = data.prowlarrApiKey.trim().length > 0

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-pill bg-[color:var(--accent-quiet)]">
            <Radar className="h-7 w-7 text-brand-500" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Configure Prowlarr</h3>
          <p className="text-sm text-fg-secondary">
            Prowlarr is required to search for torrents across multiple indexers.
            You'll need to get your API key from the Prowlarr web interface.
          </p>
        </div>

        <ProwlarrSettings
          data={{
            prowlarrApiKey: data.prowlarrApiKey,
            prowlarrUrl: data.prowlarrUrl || prowlarrUrl(),
          }}
          onUpdate={onUpdate}
          showSaveButton={false}
          showTestButton={false}
        />
      </div>

      <div className="flex justify-end">
        <Button
          onClick={handleNext}
          disabled={!isValid || isValidating}
          className="min-w-[120px]"
        >
          {isValidating ? (
            <>
              <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Validating...
            </>
          ) : (
            'Continue'
          )}
        </Button>
      </div>
    </div>
  )
}
