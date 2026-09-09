import { useEffect, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { useTorrentPreferences, useUpdateTorrentPreferences } from '@/hooks/useApi'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import type { TorrentPreferences } from '@/services/api'

const QUALITIES = [
  { value: 'SD', label: 'SD (480p)' },
  { value: '720p', label: 'HD (720p)' },
  { value: '1080p', label: 'Full HD (1080p)' },
  { value: '4K', label: '4K (2160p)' },
  { value: '8K', label: '8K' },
]

const FORMATS = [
  { value: 'x264', label: 'x264 (H.264)' },
  { value: 'x265', label: 'x265 (H.265)' },
  { value: 'HEVC', label: 'HEVC' },
  { value: 'AV1', label: 'AV1' },
  { value: 'XviD', label: 'XviD' },
  { value: 'DivX', label: 'DivX' },
]

const LANGUAGES = [
  'ENGLISH',
  'FRENCH',
  'GERMAN',
  'SPANISH',
  'ITALIAN',
  'JAPANESE',
  'KOREAN',
  'CHINESE',
  'HINDI',
  'PORTUGUESE',
  'RUSSIAN',
  'DUTCH',
  'MULTI',
]

/** A multi-select rendered as toggleable pills — monochrome except when on. */
function PillGroup({
  options,
  selected,
  onToggle,
}: {
  options: Array<{ value: string; label: string }>
  selected: string[]
  onToggle: (value: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = selected.includes(option.value)
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onToggle(option.value)}
            className={cn(
              'inline-flex h-8 items-center rounded-pill px-3 text-xs font-semibold transition-colors duration-fast ease-standard',
              'focus-visible:outline-none focus-visible:shadow-focus',
              active
                ? 'bg-brand-500 text-fg-accent'
                : 'bg-surface-input text-fg-secondary hover:bg-surface-input-hover hover:text-fg-primary'
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Defaults every new request inherits. These persist to the database like
 * every other setting — env values are only the fallback for a fresh install.
 */
export function QualityRulesSettings() {
  const { data, isLoading } = useTorrentPreferences()
  const updatePreferences = useUpdateTorrentPreferences()
  const { toast } = useToast()

  const [form, setForm] = useState<Partial<TorrentPreferences>>({})

  useEffect(() => {
    if (data?.data) setForm(data.data)
  }, [data])

  const toggle = (key: 'defaultQualities' | 'defaultFormats' | 'defaultLanguages', value: string) => {
    setForm((prev) => {
      const current = prev[key] ?? []
      return {
        ...prev,
        [key]: current.includes(value) ? current.filter((v) => v !== value) : [...current, value],
      }
    })
  }

  const handleSave = async () => {
    try {
      await updatePreferences.mutateAsync({
        defaultQualities: form.defaultQualities,
        defaultFormats: form.defaultFormats,
        defaultLanguages: form.defaultLanguages,
        minSeeders: form.minSeeders,
        maxSizeGB: form.maxSizeGB,
        trustedIndexers: form.trustedIndexers,
        blacklistedWords: form.blacklistedWords,
        autoSelectBest: form.autoSelectBest,
        preferRemux: form.preferRemux,
        preferSmallSize: form.preferSmallSize,
      })
      toast({
        title: 'Quality rules saved',
        description: 'New requests will use these defaults.',
      })
    } catch {
      toast({
        title: 'Save failed',
        description: 'Failed to save quality rules. Please try again.',
        variant: 'destructive',
      })
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="gap-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-10 w-40" />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Preferred quality</CardTitle>
          <CardDescription>
            Applied to every new request, and used to rank the torrents Jackett returns
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <Label variant="eyebrow">Video quality</Label>
            <PillGroup
              options={QUALITIES}
              selected={form.defaultQualities ?? []}
              onToggle={(value) => toggle('defaultQualities', value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label variant="eyebrow">Video format</Label>
            <PillGroup
              options={FORMATS}
              selected={form.defaultFormats ?? []}
              onToggle={(value) => toggle('defaultFormats', value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label variant="eyebrow">Language</Label>
            <PillGroup
              options={LANGUAGES.map((value) => ({
                value,
                label: value.charAt(0) + value.slice(1).toLowerCase(),
              }))}
              selected={form.defaultLanguages ?? []}
              onToggle={(value) => toggle('defaultLanguages', value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Limits</CardTitle>
          <CardDescription>Torrents outside these bounds are filtered out</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="minSeeders">Minimum seeders</Label>
            <Input
              id="minSeeders"
              type="number"
              min={0}
              className="font-mono"
              value={form.minSeeders ?? ''}
              onChange={(e) => setForm((prev) => ({ ...prev, minSeeders: Number(e.target.value) }))}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="maxSizeGB">Maximum size (GB)</Label>
            <Input
              id="maxSizeGB"
              type="number"
              min={1}
              className="font-mono"
              value={form.maxSizeGB ?? ''}
              onChange={(e) => setForm((prev) => ({ ...prev, maxSizeGB: Number(e.target.value) }))}
            />
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="trustedIndexers">
              Trusted indexers
              <span className="ml-1 text-xs font-normal text-fg-muted">— comma separated</span>
            </Label>
            <Input
              id="trustedIndexers"
              className="font-mono"
              placeholder="1337x, RARBG, YTS"
              value={(form.trustedIndexers ?? []).join(', ')}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  trustedIndexers: e.target.value
                    .split(',')
                    .map((v) => v.trim())
                    .filter(Boolean),
                }))
              }
            />
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="blacklistedWords">
              Blacklisted words
              <span className="ml-1 text-xs font-normal text-fg-muted">— comma separated</span>
            </Label>
            <Input
              id="blacklistedWords"
              className="font-mono"
              placeholder="cam, ts, hdcam, hdts"
              value={(form.blacklistedWords ?? []).join(', ')}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  blacklistedWords: e.target.value
                    .split(',')
                    .map((v) => v.trim())
                    .filter(Boolean),
                }))
              }
            />
            <p className="text-xs text-fg-muted">
              Any torrent whose title contains one of these is skipped.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Selection</CardTitle>
          <CardDescription>How Downloadarr picks between matching torrents</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-fg-primary">Auto-select the best match</p>
              <p className="text-xs text-fg-muted">
                Start the highest-ranked result automatically instead of waiting for you to pick
              </p>
            </div>
            <Switch
              checked={form.autoSelectBest ?? false}
              onCheckedChange={(checked) => setForm((prev) => ({ ...prev, autoSelectBest: checked }))}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-fg-primary">Prefer remux</p>
              <p className="text-xs text-fg-muted">Favour untouched disc rips over re-encodes</p>
            </div>
            <Switch
              checked={form.preferRemux ?? false}
              onCheckedChange={(checked) => setForm((prev) => ({ ...prev, preferRemux: checked }))}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-fg-primary">Prefer smaller files</p>
              <p className="text-xs text-fg-muted">
                Break ties toward the smaller release at the same quality
              </p>
            </div>
            <Switch
              checked={form.preferSmallSize ?? false}
              onCheckedChange={(checked) =>
                setForm((prev) => ({ ...prev, preferSmallSize: checked }))
              }
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={handleSave} disabled={updatePreferences.isPending}>
          {updatePreferences.isPending ? 'Saving…' : 'Save quality rules'}
        </Button>
        <Badge variant="neutral">Stored in the database</Badge>
      </div>
    </div>
  )
}
