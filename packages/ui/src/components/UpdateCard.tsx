import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { useUpdateCheck } from '@/hooks/useApi'
import { useToast } from '@/hooks/use-toast'
import { Download, ExternalLink, Copy, AlertCircle } from 'lucide-react'

export function UpdateCard() {
  const [showModal, setShowModal] = useState(false)
  const { data: updateInfo, isLoading, error } = useUpdateCheck()
  const { toast } = useToast()

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast({
        title: "Copied!",
        description: "Update command copied to clipboard",
      })
    } catch (err) {
      toast({
        title: "Copy failed",
        description: "Please copy the command manually",
      })
    }
  }

  // Don't show the card if there's an error or no update available
  if (isLoading || error || !updateInfo?.updateAvailable) {
    return null
  }

  return (
    <>
      {/* Mobile */}
      <Card className='md:hidden cursor-pointer p-2 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200 dark:border-blue-800' onClick={() => setShowModal(true)}>
        <div className='flex items-center justify-center'>
          <Download className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        </div>
      </Card>
      {/* Desktop */}
      <Card className="hidden md:block bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200 dark:border-blue-800">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Download className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <CardTitle className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Update Available
              </CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <Button
            onClick={() => setShowModal(true)}
            size="sm"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          >
            View Update
          </Button>
        </CardContent>
      </Card>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="w-full max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Download className="w-5 h-5" />
              <span>Update Available</span>
            </DialogTitle>
            <DialogDescription>
              A new version of Downloadarr is available
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Version Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Current Version</label>
                <p className="text-lg font-mono">{updateInfo.currentVersion}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Latest Version</label>
                <p className="text-lg font-mono text-green-600 dark:text-green-400">{updateInfo.latestVersion}</p>
              </div>
            </div>

            {/* Release Info */}
            <div>
              <label className="text-sm font-medium text-muted-foreground">Release Date</label>
              <p className="text-sm">
                {new Date(updateInfo.publishedAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </div>

            {/* Update Command */}
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Update Command</label>
              <div className="relative">
                <pre className="bg-muted p-3 rounded-md text-sm font-mono overflow-hidden border">
                  <code className="w-full whitespace-pre-wrap">
                    {updateInfo.updateCommand}
                  </code>
                </pre>
                <Button
                  size="sm"
                  variant="outline"
                  className="absolute top-2 right-2"
                  onClick={() => copyToClipboard(updateInfo.updateCommand)}
                >
                  <Copy className="w-3 h-3 mr-1" />
                  Copy
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Run this command on your host system to update Downloadarr
              </p>
            </div>

            {/* Release Notes */}
            {updateInfo.description && updateInfo.description !== 'No release notes available' && (
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-2 block">Release Notes</label>
                <div className="bg-muted p-3 rounded-md text-sm max-h-40 overflow-y-auto">
                  <pre className="whitespace-pre-wrap">{updateInfo.description}</pre>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-between items-center pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => window.open(updateInfo.releaseUrl, '_blank')}
                className="flex items-center space-x-2"
              >
                <ExternalLink className="w-4 h-4" />
                <span>View on GitHub</span>
              </Button>

              <div className="flex space-x-2">
                <Button variant="outline" onClick={() => setShowModal(false)}>
                  Later
                </Button>
                <Button
                  onClick={() => {
                    copyToClipboard(updateInfo.updateCommand)
                    setShowModal(false)
                  }}
                  className="flex items-center space-x-2"
                >
                  <Copy className="w-4 h-4" />
                  <span>Copy & Close</span>
                </Button>
              </div>
            </div>

            {/* Warning */}
            <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-3">
              <div className="flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-yellow-800 dark:text-yellow-200">Important</p>
                  <p className="text-yellow-700 dark:text-yellow-300">
                    Run the update command on your host system (not inside a container).
                    This will pull new images and restart your containers.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
