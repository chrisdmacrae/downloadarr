import { useEffect, useState } from 'react'
import { ExternalLink, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { useRemoveSource, useSaveSource } from '@/hooks/useRecommendations'
import type { RecommendationSource, RecommendationSourceProvider } from '@/services/recommendations'

export interface ProviderCopy {
  provider: RecommendationSourceProvider
  title: string
  description: React.ReactNode
  usernameLabel?: string
  usernamePlaceholder?: string
  /** Omitted for providers that need no key. */
  keyLabel?: string
  keyHelp?: React.ReactNode
  keyRequired?: boolean
}

export const external = (href: string, label: string) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className="inline-flex items-center text-primary hover:underline"
  >
    {label} <ExternalLink className="ml-1 h-3 w-3" />
  </a>
)

/** Accounts connected by username. Spotify and Trakt have their own cards. */
export const USERNAME_PROVIDERS: ProviderCopy[] = [
  {
    provider: 'LISTENBRAINZ',
    title: 'ListenBrainz',
    description: (
      <>
        Listening stats, similar artists, fresh releases and ListenBrainz's weekly and daily playlists. The profile at{' '}
        {external('https://listenbrainz.org', 'listenbrainz.org')} must be public.
      </>
    ),
    keyLabel: 'User token (optional)',
    keyHelp: (
      <>
        Picks each new artist's most popular album and powers LB Radio. Copy it from{' '}
        {external('https://listenbrainz.org/settings/', 'your settings')}.
      </>
    ),
    keyRequired: false,
  },
  {
    provider: 'LASTFM',
    title: 'Last.fm',
    description: <>Scrobbled top artists and albums, and Last.fm's similar artists.</>,
    keyLabel: 'API key',
    keyHelp: <>Create a free key at {external('https://www.last.fm/api/account/create', 'last.fm/api')}.</>,
    keyRequired: true,
  },
  {
    provider: 'DEEZER',
    title: 'Deezer',
    description: (
      <>
        Favourites, personal charts and Flow. Deezer isn't issuing new app logins, so Downloadarr reads the public
        profile instead: make sure it's public in Deezer's privacy settings.
      </>
    ),
    usernameLabel: 'Profile link or user ID',
    usernamePlaceholder: 'https://www.deezer.com/profile/123456',
  },
]

/** The account's last sync: when, or why it failed. */
export function SyncState({ source }: { source?: RecommendationSource }) {
  if (source?.lastSyncError) return <p className="text-sm text-brand-400">Last sync failed: {source.lastSyncError}</p>
  if (source?.lastSyncedAt) {
    return <p className="text-xs text-fg-muted">Last synced {new Date(source.lastSyncedAt).toLocaleString()}</p>
  }
  return null
}

export function SourceCard({
  profileId,
  copy,
  source,
}: {
  profileId: string
  copy: ProviderCopy
  source?: RecommendationSource
}) {
  const { toast } = useToast()
  const save = useSaveSource()
  const remove = useRemoveSource()
  const [username, setUsername] = useState(source?.username ?? '')
  const [apiKey, setApiKey] = useState('')

  useEffect(() => setUsername(source?.username ?? ''), [source?.username])

  const onSave = () =>
    save.mutate(
      // An empty key field keeps the saved key.
      { profileId, provider: copy.provider, username, apiKey: apiKey || undefined },
      {
        onSuccess: () => {
          setApiKey('')
          toast({ title: `${copy.title} connected`, description: 'Building recommendations now.' })
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
  const idPrefix = `${profileId}-${copy.provider}`

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
            <Label htmlFor={`${idPrefix}-username`}>{copy.usernameLabel ?? 'Username'}</Label>
            <Input
              id={`${idPrefix}-username`}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={copy.usernamePlaceholder ?? `${copy.title} username`}
              autoComplete="off"
            />
          </div>
          {copy.keyLabel && (
            <div className="space-y-2">
              <Label htmlFor={`${idPrefix}-key`}>{copy.keyLabel}</Label>
              <Input
                id={`${idPrefix}-key`}
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

        <SyncState source={source} />

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
                remove.mutate({ profileId, provider: copy.provider }, { onSuccess: () => setUsername('') })
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
