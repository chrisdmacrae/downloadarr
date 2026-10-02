import { useMemo, useState } from 'react'
import { File, Folder, FolderInput, Loader2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ds/Page'
import {
  useAggregatedRequests,
  useDownloadsFolder,
  useGamePlatformOptions,
  useOrganizeDownload,
} from '@/hooks/useApi'
import { useToast } from '@/hooks/use-toast'
import { formatFileSize, formatRelativeTime, statusTone } from '@/lib/status'
import type { AggregatedRequest, DownloadsFolderEntry, OrganizeDownloadPayload } from '@/services/api'

type ContentType = NonNullable<OrganizeDownloadPayload['contentType']>

/**
 * What the download is. Anime is filed with TV shows or movies: the library
 * has no folder of its own for it.
 */
const KINDS: Array<{ value: string; label: string; contentType: ContentType }> = [
  { value: 'MOVIE', label: 'Movie', contentType: 'MOVIE' },
  { value: 'TV_SHOW', label: 'TV show', contentType: 'TV_SHOW' },
  { value: 'ANIME_SERIES', label: 'Anime series (filed with TV shows)', contentType: 'TV_SHOW' },
  { value: 'ANIME_FILM', label: 'Anime film (filed with movies)', contentType: 'MOVIE' },
  { value: 'GAME', label: 'Game', contentType: 'GAME' },
  { value: 'MUSIC', label: 'Album', contentType: 'MUSIC' },
]

const NO_REQUEST = 'none'

interface FormState {
  kind: string
  requestId: string
  title: string
  year: string
  season: string
  platform: string
  artist: string
}

export function UnorganizedDownloads() {
  const { toast } = useToast()
  const { data: entries, isLoading, error } = useDownloadsFolder()
  const { data: requestsData } = useAggregatedRequests({ limit: 500 })
  const { data: platformOptions } = useGamePlatformOptions(false)
  const organize = useOrganizeDownload()

  const [selected, setSelected] = useState<DownloadsFolderEntry | null>(null)
  const [form, setForm] = useState<FormState>({
    kind: 'MOVIE',
    requestId: NO_REQUEST,
    title: '',
    year: '',
    season: '',
    platform: '',
    artist: '',
  })

  const contentType = KINDS.find((kind) => kind.value === form.kind)?.contentType ?? 'MOVIE'

  // Requests this download could belong to: the same type, and not already complete
  const requests = useMemo(
    () =>
      ((requestsData?.data ?? []) as AggregatedRequest[]).filter(
        (request) =>
          request.type === 'torrent' &&
          request.contentType === contentType &&
          request.status !== 'COMPLETED'
      ),
    [requestsData, contentType]
  )
  const request = requests.find((candidate) => candidate.id === form.requestId)

  const open = (entry: DownloadsFolderEntry) => {
    setSelected(entry)
    setForm({
      kind: entry.suggestedContentType ?? 'MOVIE',
      requestId: entry.suggestedRequestId ?? NO_REQUEST,
      title: entry.detected.title,
      year: entry.detected.year ? String(entry.detected.year) : '',
      season: entry.detected.season ? String(entry.detected.season) : '',
      platform: '',
      artist: '',
    })
  }

  const submit = async () => {
    if (!selected) return

    const payload: OrganizeDownloadPayload = {
      path: selected.path,
      season: contentType === 'TV_SHOW' && form.season ? parseInt(form.season, 10) : undefined,
      platform: contentType === 'GAME' && form.platform ? form.platform : undefined,
    }
    if (request) {
      payload.requestId = request.id
    } else {
      payload.contentType = contentType
      payload.title = form.title.trim()
      payload.year = form.year ? parseInt(form.year, 10) : undefined
      payload.artist = contentType === 'MUSIC' ? form.artist.trim() || undefined : undefined
    }

    try {
      const result = await organize.mutateAsync(payload)
      if (result.success) {
        toast({ title: 'Moved to the library', description: result.message })
        setSelected(null)
      } else {
        toast({
          title: 'Not everything could be moved',
          description: result.failed[0]
            ? `${result.message}. ${result.failed[0].path}: ${result.failed[0].error}`
            : result.message,
          variant: 'destructive',
        })
      }
    } catch (err: any) {
      toast({
        title: 'Could not organize this download',
        description: err?.response?.data?.message || 'An error occurred. Please try again.',
        variant: 'destructive',
      })
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-[72px] w-full rounded-card" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <EmptyState
        icon={<Folder />}
        title="Could not read the downloads folder"
        description="Check that the download path is mounted and readable."
      />
    )
  }

  if (!entries || entries.length === 0) {
    return (
      <EmptyState
        icon={<Folder />}
        title="The downloads folder is empty"
        description="Finished downloads are moved to the library. Anything left behind shows up here."
      />
    )
  }

  const canSubmit = Boolean(request) || form.title.trim().length > 0

  return (
    <div className="flex flex-col gap-3">
      {entries.map((entry) => {
        const Icon = entry.isDirectory ? Folder : File
        return (
          <Card key={entry.path}>
            <CardContent className="flex flex-wrap items-center gap-4 p-4">
              <Icon className="h-5 w-5 shrink-0 text-fg-muted" />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <code className="break-all font-mono text-sm text-fg-primary">{entry.path}</code>
                <span className="text-xs text-fg-muted">
                  {[
                    formatFileSize(entry.sizeBytes),
                    `${entry.fileCount} ${entry.fileCount === 1 ? 'file' : 'files'}`,
                    `changed ${formatRelativeTime(entry.modifiedAt)}`,
                  ].join(' · ')}
                </span>
              </div>
              {entry.inProgress ? (
                <Badge variant="outline" size="sm">
                  Still downloading
                </Badge>
              ) : (
                <Button size="sm" variant="secondary" onClick={() => open(entry)}>
                  <FolderInput className="h-3.5 w-3.5" />
                  Organize
                </Button>
              )}
            </CardContent>
          </Card>
        )
      })}

      <Dialog open={selected !== null} onOpenChange={(isOpen) => !isOpen && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Organize a download</DialogTitle>
            <DialogDescription>
              Say what this is, and its files are moved into the library the same way a finished
              download would be.
            </DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="flex flex-col gap-4">
              <code className="block break-all rounded-md bg-white/[.05] p-2 font-mono text-sm text-fg-body">
                {selected.path}
              </code>

              <div className="flex flex-col gap-2">
                <Label htmlFor="organize-kind">What is it?</Label>
                <Select
                  value={form.kind}
                  onValueChange={(kind) => setForm((prev) => ({ ...prev, kind, requestId: NO_REQUEST }))}
                >
                  <SelectTrigger id="organize-kind">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {KINDS.map((kind) => (
                      <SelectItem key={kind.value} value={kind.value}>
                        {kind.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="organize-request">Request</Label>
                <Select
                  value={request ? request.id : NO_REQUEST}
                  onValueChange={(requestId) => setForm((prev) => ({ ...prev, requestId }))}
                >
                  <SelectTrigger id="organize-request">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_REQUEST}>No request: use the title below</SelectItem>
                    {requests.map((candidate) => (
                      <SelectItem key={candidate.id} value={candidate.id}>
                        {candidate.title}
                        {candidate.year ? ` (${candidate.year})` : ''} · {statusTone(candidate.status).label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-fg-muted">
                  {request
                    ? 'The files are filed under this request, which is then brought up to date.'
                    : 'Pick the request this download belongs to, if it has one.'}
                </p>
              </div>

              {!request && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_8rem]">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="organize-title">{contentType === 'MUSIC' ? 'Album' : 'Title'}</Label>
                    <Input
                      id="organize-title"
                      value={form.title}
                      onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="organize-year">Year</Label>
                    <Input
                      id="organize-year"
                      type="number"
                      value={form.year}
                      onChange={(e) => setForm((prev) => ({ ...prev, year: e.target.value }))}
                    />
                  </div>
                </div>
              )}

              {!request && contentType === 'MUSIC' && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="organize-artist">Artist</Label>
                  <Input
                    id="organize-artist"
                    value={form.artist}
                    onChange={(e) => setForm((prev) => ({ ...prev, artist: e.target.value }))}
                  />
                </div>
              )}

              {contentType === 'TV_SHOW' && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="organize-season">Season</Label>
                  <Input
                    id="organize-season"
                    type="number"
                    min={1}
                    className="sm:w-32"
                    value={form.season}
                    onChange={(e) => setForm((prev) => ({ ...prev, season: e.target.value }))}
                  />
                  <p className="text-xs text-fg-muted">
                    Only used for files that do not name their own season. A file called S02E03 goes
                    to season 2 whatever is entered here.
                  </p>
                </div>
              )}

              {contentType === 'GAME' && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="organize-platform">Platform</Label>
                  <Select
                    value={form.platform}
                    onValueChange={(platform) => setForm((prev) => ({ ...prev, platform }))}
                  >
                    <SelectTrigger id="organize-platform">
                      <SelectValue placeholder={request?.platform || 'Select platform'} />
                    </SelectTrigger>
                    <SelectContent>
                      {platformOptions?.data?.map((platform: { value: string; label: string }) => (
                        <SelectItem key={platform.value} value={platform.value}>
                          {platform.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={organize.isPending || !canSubmit}>
              {organize.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {organize.isPending ? 'Moving…' : 'Move to library'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
