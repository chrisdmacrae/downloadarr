import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle, Key, FolderOpen, Loader2 } from 'lucide-react'

interface CompletionStepProps {
  data: {
    jackettApiKey: string
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
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Ready to Complete Setup</h3>
          <p className="text-sm text-muted-foreground">
            Review your configuration and complete the setup process.
          </p>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center">
                <Key className="w-4 h-4 mr-2" />
                Jackett Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">API Key:</span>
                  <span className="text-sm font-mono">
                    {data.jackettApiKey ? '••••••••••••••••' : 'Not configured'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Status:</span>
                  <span className="text-sm text-green-600 dark:text-green-400">
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
                  <span className="text-sm text-muted-foreground">Organization:</span>
                  <span className="text-sm">
                    {data.organizationEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                {data.organizationEnabled && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Default Rules:</span>
                    <span className="text-sm text-green-600 dark:text-green-400">
                      ✓ Will be created
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="bg-green-50 dark:bg-green-950/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
          <div className="text-center">
            <h4 className="font-medium text-green-900 dark:text-green-100 mb-1">
              You're all set!
            </h4>
            <p className="text-sm text-green-700 dark:text-green-300">
              Click "Complete Setup" to finish the onboarding process and start using Downloadarr.
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onPrevious} disabled={isLoading}>
          Previous
        </Button>
        <Button onClick={onComplete} disabled={isLoading}>
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
