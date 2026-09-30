import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { recommendationKeys, useRecommendationApps, useRemoveSource } from '@/hooks/useRecommendations'
import { recommendationsApi, type RecommendationSource } from '@/services/recommendations'
import { SyncState } from './SourceCard'

/**
 * A profile's Spotify sign-in, through the install's Spotify app (saved under
 * App credentials). Spotify only redirects to HTTPS, so the callback has to be
 * reachable at an HTTPS address.
 */
export function SpotifySourceCard({ profileId, source }: { profileId: string; source?: RecommendationSource }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const remove = useRemoveSource()
  const { data: apps } = useRecommendationApps()
  const [searchParams, setSearchParams] = useSearchParams()
  const [starting, setStarting] = useState(false)
  const ready = Boolean(apps?.spotifyClientId && apps?.spotifyRedirectUri)

  // The API's callback sends the browser back here with the outcome.
  useEffect(() => {
    const outcome = searchParams.get('spotify')
    if (!outcome) return
    if (outcome === 'connected') {
      toast({ title: 'Spotify connected', description: 'Building recommendations now.' })
      queryClient.invalidateQueries({ queryKey: recommendationKeys.sources })
      queryClient.invalidateQueries({ queryKey: recommendationKeys.syncStatus })
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

  const connect = async () => {
    setStarting(true)
    try {
      const returnTo = `${window.location.origin}${window.location.pathname}`
      window.location.assign(await recommendationsApi.startSpotifyAuth(profileId, returnTo))
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
          Top artists, followed artists, saved albums and tracks, and playlists. Spotify no longer gives new apps
          recommendations, so it shapes taste while the other accounts find new music.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 pt-0">
        {!ready && (
          <p className="text-sm text-fg-secondary">
            Save your Spotify app under App credentials first. In development mode, add this person's Spotify account
            under User Management in the app.
          </p>
        )}
        <SyncState source={source} />
        <div className="flex flex-wrap gap-2">
          <Button onClick={connect} disabled={!ready || starting}>
            {starting && <Loader2 className="h-4 w-4 animate-spin" />}
            {source ? 'Reconnect' : 'Connect with Spotify'}
          </Button>
          {source && (
            <Button
              variant="ghost"
              disabled={remove.isPending}
              onClick={() => remove.mutate({ profileId, provider: 'SPOTIFY' })}
            >
              Disconnect
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
