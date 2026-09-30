import { useEffect, useRef, useState } from 'react'
import { Copy, ExternalLink, Loader2 } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { recommendationKeys, useRecommendationApps, useRemoveSource } from '@/hooks/useRecommendations'
import { recommendationsApi, type RecommendationSource } from '@/services/recommendations'
import { SyncState } from './SourceCard'

const OUTCOME_MESSAGES: Record<string, string> = {
  expired: 'The code expired before it was entered. Start again.',
  denied: 'Access was declined on Trakt.',
}

/**
 * A profile's Trakt sign-in, by device code: the person enters a short code at
 * trakt.tv/activate while this card polls for the outcome.
 */
export function TraktSourceCard({ profileId, source }: { profileId: string; source?: RecommendationSource }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const remove = useRemoveSource()
  const { data: apps } = useRecommendationApps()
  const [starting, setStarting] = useState(false)
  const [active, setActive] = useState(false)
  const ready = Boolean(apps?.traktClientId && apps?.hasTraktClientSecret)

  const { data: login } = useQuery({
    queryKey: ['recommendations', 'trakt-login', profileId],
    queryFn: () => recommendationsApi.getTraktLogin(profileId),
    enabled: active,
    refetchInterval: (q) => (q.state.data?.status === 'pending' ? 3000 : false),
  })

  // React once to each finished login.
  const handled = useRef<string | null>(null)
  useEffect(() => {
    if (!active || !login || login.status === 'pending' || handled.current === login.userCode) return
    handled.current = login.userCode
    setActive(false)
    if (login.status === 'connected') {
      toast({ title: 'Trakt connected', description: 'Building movie and TV recommendations now.' })
      queryClient.invalidateQueries({ queryKey: recommendationKeys.sources })
      queryClient.invalidateQueries({ queryKey: recommendationKeys.syncStatus })
    } else {
      toast({
        title: 'Couldn’t connect Trakt',
        description: login.error ?? OUTCOME_MESSAGES[login.status],
        variant: 'destructive',
      })
    }
  }, [active, login, queryClient, toast])

  const connect = async () => {
    setStarting(true)
    try {
      const started = await recommendationsApi.startTraktLogin(profileId)
      queryClient.setQueryData(['recommendations', 'trakt-login', profileId], started)
      setActive(true)
    } catch (error: any) {
      toast({
        title: 'Couldn’t start Trakt sign-in',
        description: error?.response?.data?.message ?? error?.message,
        variant: 'destructive',
      })
    } finally {
      setStarting(false)
    }
  }

  const cancel = async () => {
    setActive(false)
    await recommendationsApi.cancelTraktLogin(profileId).catch(() => undefined)
  }

  const pending = active && login?.status === 'pending'

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          Trakt
          {source && (
            <span className="rounded bg-surface-raised px-2 py-1 text-xs text-fg-primary">
              {source.lastSyncError ? 'Error' : `Connected as ${source.displayName ?? source.username}`}
            </span>
          )}
        </CardTitle>
        <CardDescription>
          Trakt's personal movie and show recommendations, and the watchlist, as rails at the top of the Movies and TV
          pages.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 pt-0">
        {!ready && <p className="text-sm text-fg-secondary">Save your Trakt app under App credentials first.</p>}

        {pending && login && (
          <div className="flex flex-col gap-3 rounded-card border border-hairline p-4">
            <p className="text-sm text-fg-secondary">
              Open{' '}
              <a
                href={login.verificationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-primary hover:underline"
              >
                {login.verificationUrl.replace(/^https?:\/\//, '')} <ExternalLink className="ml-1 h-3 w-3" />
              </a>{' '}
              signed in as this person, and enter:
            </p>
            <div className="flex items-center gap-2">
              <span className="font-mono text-2xl font-bold tracking-[0.2em] text-fg-primary">{login.userCode}</span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Copy code"
                onClick={() => navigator.clipboard?.writeText(login.userCode)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="flex items-center gap-2 text-xs text-fg-muted">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Waiting for approval · code expires at {new Date(login.expiresAt).toLocaleTimeString()}
            </p>
          </div>
        )}

        <SyncState source={source} />

        <div className="flex flex-wrap gap-2">
          {pending ? (
            <Button variant="ghost" onClick={cancel}>
              Cancel
            </Button>
          ) : (
            <Button onClick={connect} disabled={!ready || starting}>
              {starting && <Loader2 className="h-4 w-4 animate-spin" />}
              {source ? 'Reconnect' : 'Connect Trakt'}
            </Button>
          )}
          {source && !pending && (
            <Button
              variant="ghost"
              disabled={remove.isPending}
              onClick={() => remove.mutate({ profileId, provider: 'TRAKT' })}
            >
              Disconnect
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
