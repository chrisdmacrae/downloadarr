import { useEffect, useState } from 'react'
import { Copy, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { useRecommendationApps, useSaveApps } from '@/hooks/useRecommendations'
import { recommendationsApi } from '@/services/recommendations'
import { external } from './SourceCard'

/**
 * The Spotify and Trakt apps every profile signs in through. Each install
 * registers its own with both services.
 */
export function AppCredentialsCard() {
  const { toast } = useToast()
  const { data: apps } = useRecommendationApps()
  const save = useSaveApps()
  const suggestedRedirect = recommendationsApi.spotifyCallbackUrl()
  const [spotifyClientId, setSpotifyClientId] = useState('')
  const [spotifyRedirectUri, setSpotifyRedirectUri] = useState(suggestedRedirect)
  const [traktClientId, setTraktClientId] = useState('')
  const [traktClientSecret, setTraktClientSecret] = useState('')

  useEffect(() => {
    if (!apps) return
    setSpotifyClientId(apps.spotifyClientId ?? '')
    setSpotifyRedirectUri(apps.spotifyRedirectUri ?? suggestedRedirect)
    setTraktClientId(apps.traktClientId ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apps])

  const onSave = () =>
    save.mutate(
      {
        spotifyClientId,
        // Leaving the suggestion untouched without a client ID saves nothing.
        spotifyRedirectUri: spotifyClientId.trim() ? spotifyRedirectUri : apps?.spotifyRedirectUri ?? '',
        traktClientId,
        // An empty secret field keeps the saved secret.
        ...(traktClientSecret ? { traktClientSecret } : {}),
      },
      {
        onSuccess: () => {
          setTraktClientSecret('')
          toast({ title: 'App credentials saved' })
        },
        onError: (error: any) =>
          toast({
            title: 'Couldn’t save app credentials',
            description: error?.response?.data?.message ?? error?.message,
            variant: 'destructive',
          }),
      }
    )

  const httpsRedirect = spotifyRedirectUri.trim().startsWith('https://')

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">App credentials</CardTitle>
        <CardDescription>
          Spotify and Trakt sign-ins go through apps you register yourself. Every profile signs in through the same app.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6 pt-0">
        <section className="flex flex-col gap-3">
          <h4 className="text-sm font-semibold text-fg-primary">Spotify</h4>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-fg-secondary">
            <li>
              Create an app with the Web API in the {external('https://developer.spotify.com/dashboard', 'Spotify developer dashboard')}.
              The app owner needs Spotify Premium, and development-mode apps allow five users.
            </li>
            <li>Add the redirect URI below to the app, exactly as written.</li>
            <li>Under User Management, add each Spotify account that will sign in.</li>
          </ol>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="spotify-client-id">Client ID</Label>
              <Input
                id="spotify-client-id"
                value={spotifyClientId}
                onChange={(e) => setSpotifyClientId(e.target.value)}
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
                  value={spotifyRedirectUri}
                  onChange={(e) => setSpotifyRedirectUri(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Copy redirect URI"
                  onClick={() => navigator.clipboard?.writeText(spotifyRedirectUri)}
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
        </section>

        <section className="flex flex-col gap-3">
          <h4 className="text-sm font-semibold text-fg-primary">Trakt</h4>
          <p className="text-sm text-fg-secondary">
            Create an app at {external('https://app.trakt.tv/settings/apps/api/new', 'trakt.tv')} (Trakt asks you to verify
            a GitHub account first). Use <code className="font-mono text-xs">urn:ietf:wg:oauth:2.0:oob</code> as its
            redirect URI: profiles sign in with a code, so nothing is redirected. Free Trakt accounts can connect one
            third-party app, and Trakt's API policy bars apps that promote piracy — check it fits how you use Downloadarr.
          </p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="trakt-client-id">Client ID</Label>
              <Input
                id="trakt-client-id"
                value={traktClientId}
                onChange={(e) => setTraktClientId(e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="trakt-client-secret">Client secret</Label>
              <Input
                id="trakt-client-secret"
                type="password"
                value={traktClientSecret}
                onChange={(e) => setTraktClientSecret(e.target.value)}
                placeholder={apps?.hasTraktClientSecret ? 'Saved — enter a new one to replace it' : ''}
                autoComplete="off"
              />
            </div>
          </div>
        </section>

        <div>
          <Button onClick={onSave} disabled={save.isPending}>
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Save app credentials
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
