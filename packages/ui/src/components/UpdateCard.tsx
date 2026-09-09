import { useState } from 'react'
import { AlertCircle, Copy, Download, ExternalLink, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogEyebrow,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useUpdateCheck } from '@/hooks/useApi'
import { useToast } from '@/hooks/use-toast'

/**
 * The available-update notice. It sits in the app chrome above the report FAB
 * and stays quiet until there is actually an update.
 */
export function UpdateCard() {
  const [showModal, setShowModal] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const { data: updateInfo, isLoading, error } = useUpdateCheck()
  const { toast } = useToast()

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast({ title: 'Copied', description: 'Update command copied to your clipboard.' })
    } catch {
      toast({
        title: 'Copy failed',
        description: 'Please copy the command manually.',
        variant: 'destructive',
      })
    }
  }

  if (isLoading || error || !updateInfo?.updateAvailable || dismissed) {
    return null
  }

  return (
    <>
      <div className="fixed bottom-6 right-6 z-40 flex w-[300px] max-w-[calc(100vw-48px)] flex-col gap-2 rounded-card border border-[color:var(--brand-tint-16)] bg-[linear-gradient(180deg,var(--brand-tint-08),transparent_70%),var(--surface-card)] p-3 shadow-3 sm:right-[104px]">
        <div className="flex items-center gap-2">
          <span className="font-condensed text-2xs font-bold uppercase leading-none tracking-eyebrow text-brand-500">
            Update available
          </span>
          <span className="font-mono text-xs text-fg-primary">{updateInfo.latestVersion}</span>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setDismissed(true)}
            className="ml-auto rounded-sm p-0.5 text-fg-muted transition-colors duration-fast ease-standard hover:text-fg-primary focus-visible:outline-none focus-visible:shadow-focus"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="text-xs text-fg-secondary">
          You're on <span className="font-mono">{updateInfo.currentVersion}</span>. Run one command
          on your host to update.
        </p>
        <Button size="sm" onClick={() => setShowModal(true)}>
          <Download className="h-3.5 w-3.5" />
          View update
        </Button>
      </div>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogEyebrow>Update available</DialogEyebrow>
            <DialogTitle>Downloadarr {updateInfo.latestVersion}</DialogTitle>
            <DialogDescription>A new version of Downloadarr is available</DialogDescription>
          </DialogHeader>

          <DialogBody className="flex flex-col gap-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <span className="font-condensed text-2xs font-bold uppercase tracking-eyebrow text-fg-muted">
                  Current version
                </span>
                <span className="font-mono text-lg text-fg-primary">{updateInfo.currentVersion}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-condensed text-2xs font-bold uppercase tracking-eyebrow text-fg-muted">
                  Latest version
                </span>
                <span className="font-mono text-lg text-fg-primary">{updateInfo.latestVersion}</span>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <span className="font-condensed text-2xs font-bold uppercase tracking-eyebrow text-fg-muted">
                Release date
              </span>
              <span className="font-mono text-sm text-fg-body">
                {new Date(updateInfo.publishedAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>

            <div className="flex flex-col gap-2">
              <span className="font-condensed text-2xs font-bold uppercase tracking-eyebrow text-fg-muted">
                Update command
              </span>
              <div className="relative">
                <pre className="overflow-x-auto rounded-md border border-hairline bg-white/[.05] p-3 font-mono text-sm text-fg-body">
                  <code className="whitespace-pre-wrap break-all">{updateInfo.updateCommand}</code>
                </pre>
                <Button
                  size="sm"
                  variant="secondary"
                  className="absolute right-2 top-2"
                  onClick={() => copyToClipboard(updateInfo.updateCommand)}
                >
                  <Copy className="h-3 w-3" />
                  Copy
                </Button>
              </div>
              <p className="text-xs text-fg-muted">
                Run this on your host system to update Downloadarr.
              </p>
            </div>

            {updateInfo.description && updateInfo.description !== 'No release notes available' && (
              <div className="flex flex-col gap-2">
                <span className="font-condensed text-2xs font-bold uppercase tracking-eyebrow text-fg-muted">
                  Release notes
                </span>
                <div className="max-h-40 overflow-y-auto rounded-md border border-hairline bg-white/[.05] p-3 text-sm text-fg-body">
                  <pre className="whitespace-pre-wrap font-sans">{updateInfo.description}</pre>
                </div>
              </div>
            )}

            <div className="flex gap-3 rounded-card border border-hairline bg-white/[.05] p-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-fg-secondary" />
              <div className="text-sm">
                <p className="font-bold text-fg-primary">Important</p>
                <p className="text-fg-secondary">
                  Run the update command on your host system, not inside a container. It pulls new
                  images and restarts your containers.
                </p>
              </div>
            </div>
          </DialogBody>

          <DialogFooter>
            <Button variant="outline" onClick={() => window.open(updateInfo.releaseUrl, '_blank')}>
              <ExternalLink className="h-4 w-4" />
              View on GitHub
            </Button>
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              Later
            </Button>
            <Button
              onClick={() => {
                copyToClipboard(updateInfo.updateCommand)
                setShowModal(false)
              }}
            >
              <Copy className="h-4 w-4" />
              Copy &amp; close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
