import { useEffect, useState } from 'react'
import { ExternalLink, Loader2, RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import {
  useMusicDismissals,
  useMusicSources,
  useMusicSyncStatus,
  useRemoveMusicSource,
  useSaveMusicSource,
  useStartMusicSync,
  useUndoMusicDismissal,
} from '@/hooks/useMusic'
import type { MusicSource, MusicSourceProvider } from '@/services/music'
import { SpotifySourceCard } from './SpotifySourceCard'

interface ProviderCopy {
  provider: MusicSourceProvider
  title: string
  description: React.ReactNode
  usernameLabel?: string
  usernamePlaceholder?: string
  /** Omitted for providers that need no key. */
  keyLabel?: string
  keyHelp?: React.ReactNode
  keyRequired?: boolean
}

const external = (href: string, label: string) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className="inline-flex items-center text-primary hover:underline"
  >
    {label} <ExternalLink className="ml-1 h-3 w-3" />
  </a>
)

const PROVIDERS: ProviderCopy[] = [
  {
    provider: 'LISTENBRAINZ',
    title: 'ListenBrainz',
    description: (
      <>
        Your listening stats, similar artists, fresh releases and weekly exploration playlist. Your profile at{' '}
        {external('https://listenbrainz.org', 'listenbrainz.org')} must be public.
      </>
    ),
    keyLabel: 'User token (optional)',
    keyHelp: (
      <>
        Lets Downloadarr pick each new artist's most popular album. Copy it from{' '}
        {external('https://listenbrainz.org/settings/', 'your settings')}.
      </>
    ),
    keyRequired: false,
  },
  {
    provider: 'LASTFM',
    title: 'Last.fm',
    description: <>Your scrobbled top artists and albums, and Last.fm's similar artists.</>,
    keyLabel: 'API key',
    keyHelp: <>Create a free key at {external('https://www.last.fm/api/account/create', 'last.fm/api')}.</>,
    keyRequired: true,
  },
  {
    provider: 'DEEZER',
    title: 'Deezer',
    description: (
      <>
        Your favourites, personal charts and Flow. Deezer isn't issuing new app logins, so Downloadarr reads your public
        profile instead: make sure it's public in Deezer's privacy settings.
      </>
    ),
    usernameLabel: 'Profile link or user ID',
    usernamePlaceholder: 'https://www.deezer.com/profile/123456',
  },
]

function SourceCard({ copy, source }: { copy: ProviderCopy; source?: MusicSource }) {
  const { toast } = useToast()
  const save = useSaveMusicSource()
  const remove = useRemoveMusicSource()
  const [username, setUsername] = useState(source?.username ?? '')
  const [apiKey, setApiKey] = useState('')

  useEffect(() => setUsername(source?.username ?? ''), [source?.username])

  const onSave = () =>
    save.mutate(
      // An empty key field keeps the saved key.
      { provider: copy.provider, username, apiKey: apiKey || undefined },
      {
        onSuccess: () => {
          setApiKey('')
          toast({
            title: `${copy.title} connected`,
            description: 'Building your recommendations now.',
          })
        },
        onError: (error: any) =>
          toast({
            title: `Couldn't connect ${copy.title}`,
            description: error?.response?.data?.message ?? error?.message,
            variant: 'destructive',
          }),
      }
    )

  const needsKey = copy.keyRequired && !source?.hasApiKey && !apiKey

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          {copy.title}
          {source && (
            <span className="rounded bg-surface-raised px-2 py-1 text-xs text-fg-primary">
              {source.lastSyncError ? 'Error' : source.displayName ? `Connected as ${source.displayName}` : 'Connected'}
            </span>
          )}
        </CardTitle>
        <CardDescription>{copy.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 pt-0">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`${copy.provider}-username`}>{copy.usernameLabel ?? 'Username'}</Label>
            <Input
              id={`${copy.provider}-username`}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={copy.usernamePlaceholder ?? `Your ${copy.title} username`}
              autoComplete="off"
            />
          </div>
          {copy.keyLabel && (
            <div className="space-y-2">
              <Label htmlFor={`${copy.provider}-key`}>{copy.keyLabel}</Label>
              <Input
                id={`${copy.provider}-key`}
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={source?.hasApiKey ? 'Saved — enter a new one to replace it' : ''}
                autoComplete="off"
              />
              <p className="text-xs text-fg-muted">{copy.keyHelp}</p>
            </div>
          )}
        </div>

        {source?.lastSyncError && <p className="text-sm text-brand-400">Last sync failed: {source.lastSyncError}</p>}
        {source?.lastSyncedAt && !source.lastSyncError && (
          <p className="text-xs text-fg-muted">Last synced {new Date(source.lastSyncedAt).toLocaleString()}</p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button onClick={onSave} disabled={!username.trim() || needsKey || save.isPending}>
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {source ? 'Save' : 'Connect'}
          </Button>
          {source && (
            <Button
              variant="ghost"
              disabled={remove.isPending}
              onClick={() =>
                remove.mutate(copy.provider, {
                  onSuccess: () => setUsername(''),
                })
              }
            >
              Disconnect
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

/** Settings › Music: listening-history sources and hidden recommendations. */
export function MusicSourcesSettings() {
  const { data: sources } = useMusicSources()
  const { data: dismissals } = useMusicDismissals()
  const { data: syncStatus } = useMusicSyncStatus()
  const startSync = useStartMusicSync()
  const undo = useUndoMusicDismissal()
  const syncing = Boolean(syncStatus?.running) || startSync.isPending

  return (
    <div className="flex flex-col gap-6">
      {PROVIDERS.map((copy) => (
        <SourceCard key={copy.provider} copy={copy} source={sources?.find((s) => s.provider === copy.provider)} />
      ))}
      <SpotifySourceCard source={sources?.find((s) => s.provider === 'SPOTIFY')} />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recommendations</CardTitle>
          <CardDescription>
            Rebuilt every night at 4am. Related artists and 30-second previews come from Deezer's public catalog; no
            Deezer account is needed.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 pt-0">
          <div className="flex items-center gap-3">
            <Button variant="outline" disabled={syncing || !sources?.length} onClick={() => startSync.mutate()}>
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {syncing ? 'Updating…' : 'Refresh now'}
            </Button>
            {syncStatus?.error && !syncing && <span className="text-sm text-brand-400">{syncStatus.error}</span>}
          </div>

          <div className="flex flex-col gap-2">
            <Label>Hidden artists and albums</Label>
            {dismissals?.length ? (
              <p className="text-xs text-fg-muted">Anything you show again returns at the next refresh.</p>
            ) : null}
            {dismissals?.length ? (
              <ul className="flex flex-col divide-y divide-[color:var(--border-hairline)] rounded-card border border-hairline">
                {dismissals.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span className="min-w-0 truncate text-sm text-fg-primary">{d.label}</span>
                    <Button variant="ghost" size="sm" disabled={undo.isPending} onClick={() => undo.mutate(d.id)}>
                      Show again
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-fg-muted">
                Nothing hidden. Use the menu on any album on the Music page to hide it or its artist.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
