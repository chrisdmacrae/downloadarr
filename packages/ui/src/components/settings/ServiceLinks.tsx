import { ExternalLink, Film, Gamepad2, HardDriveDownload, Radar, ShieldQuestion, Tv } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { EXTERNAL_LINKS, ariaNgUrl, flaresolverrUrl, prowlarrUrl } from '@/lib/services'

interface LinkRowProps {
  icon: LucideIcon
  label: string
  description: string
  href: string
  /** Shown in mono — the resolved host:port for self-hosted services. */
  hint?: string
}

function LinkRow({ icon: Icon, label, description, href, hint }: LinkRowProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'group flex items-center gap-3 rounded-control px-3 py-2.5 transition-colors duration-fast ease-standard',
        'hover:bg-surface-input focus-visible:outline-none focus-visible:shadow-focus'
      )}
    >
      <Icon className="h-4 w-4 shrink-0 text-fg-muted transition-colors duration-fast group-hover:text-brand-500" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-fg-primary">{label}</span>
        <span className="block text-xs text-fg-muted">{description}</span>
      </span>
      {hint && <span className="hidden shrink-0 font-mono text-xs text-fg-muted sm:block">{hint}</span>}
      <ExternalLink className="h-3.5 w-3.5 shrink-0 text-fg-muted transition-colors duration-fast group-hover:text-fg-primary" />
    </a>
  )
}

function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

interface ServiceLinksProps {
  /** The configured Prowlarr URL, used only when it is browser-reachable. */
  configuredProwlarrUrl?: string
  configuredFlaresolverrUrl?: string
  /** Hides the metadata-provider card, e.g. in the indexing pane. */
  variant?: 'all' | 'self-hosted' | 'providers'
  className?: string
}

/**
 * Links out to the services Downloadarr orchestrates. Self-hosted URLs follow
 * the hostname the browser is already on, so they work whether you reached the
 * app at localhost or at a machine name on your network.
 */
export function ServiceLinks({
  configuredProwlarrUrl,
  configuredFlaresolverrUrl,
  variant = 'all',
  className,
}: ServiceLinksProps) {
  const prowlarr = prowlarrUrl(configuredProwlarrUrl)
  const ariaNg = ariaNgUrl()
  const flare = flaresolverrUrl(configuredFlaresolverrUrl)

  return (
    <div className={cn('flex flex-col gap-6', className)}>
      {variant !== 'providers' && (
        <Card>
          <CardHeader>
            <CardTitle>Services</CardTitle>
            <CardDescription>
              The containers Downloadarr runs alongside, on this host
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 p-2">
            <LinkRow
              icon={Radar}
              label="Prowlarr"
              description="Indexer configuration and torrent search"
              href={prowlarr}
              hint={hostOf(prowlarr)}
            />
            <LinkRow
              icon={HardDriveDownload}
              label="AriaNg"
              description="Web interface for the aria2 download engine"
              href={ariaNg}
              hint={hostOf(ariaNg)}
            />
            <LinkRow
              icon={ShieldQuestion}
              label="FlareSolverr"
              description="Cloudflare bypass for protected indexers"
              href={flare}
              hint={hostOf(flare)}
            />
          </CardContent>
        </Card>
      )}

      {variant !== 'self-hosted' && (
        <Card>
          <CardHeader>
            <CardTitle>Metadata providers</CardTitle>
            <CardDescription>Where artwork, titles and IDs come from</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 p-2">
            <LinkRow
              icon={Film}
              label="IMDb"
              description="Source of the IMDb IDs stored on requests"
              href={EXTERNAL_LINKS.imdb.href}
            />
            <LinkRow
              icon={Tv}
              label="TMDB"
              description="Movie and TV metadata — where your TMDB key comes from"
              href={EXTERNAL_LINKS.tmdb.href}
            />
            <LinkRow
              icon={Tv}
              label="TVDB"
              description="TV reference; Downloadarr reads TV data from TMDB"
              href={EXTERNAL_LINKS.tvdb.href}
            />
            <LinkRow
              icon={Gamepad2}
              label="IGDB"
              description="Game metadata — where your IGDB credentials come from"
              href={EXTERNAL_LINKS.igdb.href}
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
