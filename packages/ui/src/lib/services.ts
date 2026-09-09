/**
 * Links to the services Downloadarr sits on top of.
 *
 * The self-hosted ones (Prowlarr, AriaNg, FlareSolverr) are published on the
 * same host as the frontend, so their URLs are derived from whatever hostname
 * the browser is already using — `localhost:9696` when you are on localhost,
 * `nas.local:9696` when you reached the app at `nas.local:3000`. The values
 * configured for the API (`http://prowlarr:9696`) are Docker-internal service
 * names that resolve inside the compose network but never in a browser.
 */

/** Compose service names — never resolvable from a browser. */
const DOCKER_INTERNAL_HOSTS = new Set([
  'prowlarr',
  'aria2',
  'ariang',
  'flaresolverr',
  'api',
  'frontend',
  'postgres',
  'redis',
  'vpn',
])

/** Ports each service is published on by docker-compose. */
export const SERVICE_PORTS = {
  prowlarr: 9696,
  ariaNg: 6880,
  flaresolverr: 8191,
} as const

/**
 * Builds a browser-reachable URL for a service published on this host.
 *
 * A configured URL wins when it points somewhere a browser can actually
 * reach — someone running Prowlarr on another machine — otherwise the current
 * hostname plus the service port is used.
 */
export function browserServiceUrl(port: number, configuredUrl?: string | null): string {
  if (configuredUrl) {
    try {
      const url = new URL(configuredUrl)
      if (!DOCKER_INTERNAL_HOSTS.has(url.hostname)) {
        return url.toString().replace(/\/$/, '')
      }
    } catch {
      // Not a parseable URL — fall through to the derived one.
    }
  }

  if (typeof window === 'undefined') {
    return `http://localhost:${port}`
  }

  const { protocol, hostname } = window.location
  return `${protocol}//${hostname}:${port}`
}

export const prowlarrUrl = (configured?: string | null) =>
  browserServiceUrl(SERVICE_PORTS.prowlarr, configured)

export const ariaNgUrl = () => browserServiceUrl(SERVICE_PORTS.ariaNg)

export const flaresolverrUrl = (configured?: string | null) =>
  browserServiceUrl(SERVICE_PORTS.flaresolverr, configured)

/** Metadata providers, for "where do I get a key" and reference lookups. */
export const EXTERNAL_LINKS = {
  omdb: { label: 'OMDb', href: 'https://www.omdbapi.com/apikey.aspx' },
  imdb: { label: 'IMDb', href: 'https://www.imdb.com' },
  tmdb: { label: 'TMDB', href: 'https://www.themoviedb.org/settings/api' },
  tvdb: { label: 'TVDB', href: 'https://thetvdb.com' },
  igdb: { label: 'IGDB', href: 'https://www.igdb.com' },
  igdbDocs: { label: 'IGDB API', href: 'https://api-docs.igdb.com/#getting-started' },
} as const
