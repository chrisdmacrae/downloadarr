import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle, Key, FolderOpen, Loader2 } from 'lucide-react'
import { ServiceLinks } from '@/components/settings/ServiceLinks'

interface CompletionStepProps {
  data: {
    prowlarrApiKey: string
    organizationEnabled: boolean
  }
  onComplete: () => void
  onPrevious: () => void
  isLoading: boolean
}

export default function CompletionStep({ data, onComplete, onPrevious, isLoading }: CompletionStepProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="text-center">
          <CheckCircle className="mx-auto mb-4 h-16 w-16 text-ink-100" />
          <h3 className="text-lg font-semibold mb-2">Ready to Complete Setup</h3>
          <p className="text-sm text-fg-secondary">
            Review your configuration and complete the setup process.
          </p>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center">
                <Key className="w-4 h-4 mr-2" />
                Prowlarr Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-fg-secondary">API Key:</span>
                  <span className="text-sm font-mono">
                    {data.prowlarrApiKey ? '••••••••••••••••' : 'Not configured'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-fg-secondary">Status:</span>
                  <span className="text-sm text-fg-body">
                    ✓ Configured
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center">
                <FolderOpen className="w-4 h-4 mr-2" />
                File Organization
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-fg-secondary">Organization:</span>
                  <span className="text-sm">
                    {data.organizationEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                {data.organizationEnabled && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-fg-secondary">Default Rules:</span>
                    <span className="text-sm text-fg-body">
                      ✓ Will be created
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* The services now reachable from this host. */}
        <ServiceLinks variant="self-hosted" />

        <div className="rounded-card border border-hairline bg-white/[.08] p-4">
          <div className="text-center">
            <h4 className="mb-1 font-medium text-fg-primary">
              You're all set!
            </h4>
            <p className="text-sm text-fg-secondary">
              Click "Complete Setup" to finish the onboarding process and start using Downloadarr.
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onPrevious} disabled={isLoading}>
          Previous
        </Button>
        <Button
          onClick={onComplete}
          disabled={isLoading || !data.prowlarrApiKey?.trim()}
          className="min-w-[140px]"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Completing Setup...
            </>
          ) : (
            'Complete Setup'
          )}
        </Button>
      </div>
    </div>
  )
}
