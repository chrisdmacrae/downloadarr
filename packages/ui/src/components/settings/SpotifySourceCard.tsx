import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Copy, ExternalLink, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { musicKeys, useRemoveMusicSource } from '@/hooks/useMusic'
import { musicApi, type MusicSource } from '@/services/music'
import { useQueryClient } from '@tanstack/react-query'

const DASHBOARD = 'https://developer.spotify.com/dashboard'

/**
 * Spotify sign-in. Each install uses its own Spotify app, and Spotify only
 * redirects to HTTPS, so the callback has to be reachable at an HTTPS address
 * (a Cloudflare tunnel, a reverse proxy, Tailscale Serve).
 */
export function SpotifySourceCard({ source }: { source?: MusicSource }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const remove = useRemoveMusicSource()
  const [searchParams, setSearchParams] = useSearchParams()
  const suggested = musicApi.spotifyCallbackUrl()
  const [clientId, setClientId] = useState(source?.clientId ?? '')
  const [redirectUri, setRedirectUri] = useState(source?.redirectUri ?? suggested)
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    if (source?.clientId) setClientId(source.clientId)
    if (source?.redirectUri) setRedirectUri(source.redirectUri)
  }, [source?.clientId, source?.redirectUri])

  // The API's callback sends the browser back here with the outcome.
  useEffect(() => {
    const outcome = searchParams.get('spotify')
    if (!outcome) return
    if (outcome === 'connected') {
      toast({ title: 'Spotify connected', description: 'Building your recommendations now.' })
      queryClient.invalidateQueries({ queryKey: musicKeys.sources })
      queryClient.invalidateQueries({ queryKey: musicKeys.syncStatus })
    } else {
      toast({
        title: 'Couldn’t connect Spotify',
        description: searchParams.get('message') ?? undefined,
        variant: 'destructive',
      })
    }
    const next = new URLSearchParams(searchParams)
    next.delete('spotify')
    next.delete('message')
    setSearchParams(next, { replace: true })
    // Run once per redirect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const httpsRedirect = redirectUri.trim().startsWith('https://')

  const connect = async () => {
    setStarting(true)
    try {
      const returnTo = `${window.location.origin}${window.location.pathname}`
      const authorizeUrl = await musicApi.startSpotifyAuth({ clientId, redirectUri, returnTo })
      window.location.assign(authorizeUrl)
    } catch (error: any) {
      setStarting(false)
      toast({
        title: 'Couldn’t start Spotify sign-in',
        description: error?.response?.data?.message ?? error?.message,
        variant: 'destructive',
      })
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          Spotify
          {source && (
            <span className="rounded bg-surface-raised px-2 py-1 text-xs text-fg-primary">
              {source.lastSyncError ? 'Error' : `Connected as ${source.displayName ?? source.username}`}
            </span>
          )}
        </CardTitle>
        <CardDescription>
          Your top artists, followed artists, saved albums and tracks, and playlists. Spotify no longer gives new apps
          recommendations, so it shapes your taste while the other sources find new music.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 pt-0">
        {!source && (
          <ol className="list-decimal space-y-1 pl-5 text-sm text-fg-secondary">
            <li>
              Create an app in the{' '}
              <a href={DASHBOARD} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-primary hover:underline">
                Spotify developer dashboard <ExternalLink className="ml-1 h-3 w-3" />
              </a>{' '}
              with the Web API. The app owner needs Spotify Premium.
            </li>
            <li>Add the redirect URI below to the app, exactly as written.</li>
            <li>Under User Management, add the Spotify account you'll sign in with.</li>
            <li>Paste the app's Client ID here and connect.</li>
          </ol>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="spotify-client-id">Client ID</Label>
            <Input
              id="spotify-client-id"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="32 letters and digits"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="spotify-redirect">Redirect URI</Label>
            <div className="flex gap-2">
              <Input
                id="spotify-redirect"
                value={redirectUri}
                onChange={(e) => setRedirectUri(e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Copy redirect URI"
                onClick={() => navigator.clipboard?.writeText(redirectUri)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-fg-muted">
              {httpsRedirect
                ? 'Must reach this API over HTTPS, and match the app’s redirect URI exactly.'
                : 'Spotify only redirects to HTTPS. Use the https:// address of your tunnel or proxy, ending in /music/spotify/callback.'}
            </p>
          </div>
        </div>

        {source?.lastSyncError && <p className="text-sm text-brand-400">Last sync failed: {source.lastSyncError}</p>}
        {source?.lastSyncedAt && !source.lastSyncError && (
          <p className="text-xs text-fg-muted">Last synced {new Date(source.lastSyncedAt).toLocaleString()}</p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button onClick={connect} disabled={!clientId.trim() || !httpsRedirect || starting}>
            {starting && <Loader2 className="h-4 w-4 animate-spin" />}
            {source ? 'Reconnect' : 'Connect with Spotify'}
          </Button>
          {source && (
            <Button variant="ghost" disabled={remove.isPending} onClick={() => remove.mutate('SPOTIFY')}>
              Disconnect
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
