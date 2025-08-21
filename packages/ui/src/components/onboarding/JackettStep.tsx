import { useState } from 'react'
import { Button } from '@/components/ui/button'
import JackettSettings from '@/components/settings/JackettSettings'

interface JackettStepProps {
  data: {
    jackettApiKey: string
    organizationEnabled: boolean
    jackettUrl?: string
  }
  onUpdate: (updates: Partial<{ jackettApiKey: string; organizationEnabled: boolean; jackettUrl?: string }>) => void
  onNext: () => void
}

export default function JackettStep({ data, onUpdate, onNext }: JackettStepProps) {
  const [isValidating, setIsValidating] = useState(false)

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

  const isValid = data.jackettApiKey.trim().length > 0

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="text-center">
          <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">🔍</span>
          </div>
          <h3 className="text-lg font-semibold mb-2">Configure Jackett</h3>
          <p className="text-sm text-muted-foreground">
            Jackett is required to search for torrents across multiple indexers.
            You'll need to get your API key from the Jackett web interface.
          </p>
        </div>

        <JackettSettings
          data={{
            jackettApiKey: data.jackettApiKey,
            jackettUrl: data.jackettUrl || 'http://localhost:9117',
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
