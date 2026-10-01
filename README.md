# Downloadarr

All-in-one media and ROM downloading tool with VPN integration, built with NestJS API and React frontend.

## Features

- **Media Discovery**: Search and download movies and TV shows (for media you own)
- **ROM Management**: Discover and download retro game ROMs (for games that you own)
- **VPN Integration**: Secure downloading with OpenVPN support
- **Docker Deployment**: Complete containerized setup

## Quick Start

### Prerequisites

- Docker & Docker Compose
- OpenVPN configuration files (optional)
- External API keys for discovery services (OMDb, TMDB, IGDB)

### Setup

**Option 1: One-line install (recommended)**
```bash
curl -fsSL https://raw.githubusercontent.com/chrisdmacrae/downloadarr/refs/heads/main/setup.sh | bash
```

**Option 2: Download and run manually**
```bash
curl -fsSL https://raw.githubusercontent.com/chrisdmacrae/downloadarr/refs/heads/main/setup.sh -o setup.sh
chmod +x setup.sh
./setup.sh
```

The setup script will:
- ✅ Check Docker installation
- ⬇️ Download required configuration files
- ⚙️ Configure environment variables (paths, API keys)
- 🔒 Set up VPN support (optional)
- 🚀 Start all services with Docker Compose

After setup, visit http://localhost:3001 to complete the onboarding wizard where you'll:
- Configure your Prowlarr API key
- Set up file organization preferences
- Complete your Downloadarr setup

### Upgrading from separate API and frontend containers

Downloadarr used to run as two containers: `api` on port 3001 and `frontend` (nginx) on port 3000.
It is now one, `downloadarr`, which serves the web UI and the API from port **3001**.

After pulling the new `docker-compose.yml` (re-run `setup.sh`, or download it again):

1. Start it with `docker compose up -d --remove-orphans`, which also removes the old `api` and
   `frontend` containers. Your database, downloads and library are untouched.
2. Open the web UI at http://localhost:3001 rather than port 3000.
3. Anything that calls the API needs its new address: every route moved under `/api/v1`, so
   `http://localhost:3001/movies/popular` is now `http://localhost:3001/api/v1/movies/popular`.
   The API docs are at `/api/docs`.
4. If you connected Spotify, its redirect URI is now `https://<your address>/api/v1/music/spotify/callback`.
   Change it in your Spotify app and under **Settings → Recommendations → App credentials**.

The image is now `ghcr.io/chrisdmacrae/downloadarr`; the `downloadarr/api` and `downloadarr/ui`
images are no longer published. `FRONTEND_URL` and `VITE_API_URL` are no longer needed: the UI is on
the API's own origin. `CORS_ORIGINS` still lists other apps allowed to call the API from a browser.

### Upgrading from a Jackett install

Downloadarr now indexes through [Prowlarr](https://prowlarr.com) instead of Jackett. Pulling this
version replaces the `jackett` container with `prowlarr` on port 9696, and a database migration
clears the stored indexer API key — a Jackett key does not authenticate against Prowlarr.

After upgrading:

1. Open Prowlarr at http://localhost:9696 and finish its first-run setup
2. Add your indexers there (Prowlarr ships the same indexer definitions Jackett did)
3. Copy the API key from Prowlarr's **Settings → General**
4. Paste it into Downloadarr under **Settings → Indexing**, and use **Test connection**

For indexers behind Cloudflare, see [docs/FLARESOLVERR_SETUP.md](docs/FLARESOLVERR_SETUP.md) — in
Prowlarr, FlareSolverr is applied per indexer via a tag rather than globally.

The old `jackett_config` Docker volume is left untouched, so nothing is deleted; remove it with
`docker volume rm downloadarr_jackett_config` once you are happy with the switch.

### LAN discovery

Downloadarr answers `who is Downloadarr?` UDP broadcasts on port **7360** (one above Jellyfin's 7359), so
clients on your network, like the TV and J Fire TV app, can find it without typing an address. The reply
is JSON: `{ Id, Name, Version, Port }`. Clients combine `Port` with the address the reply came from,
and find the API under `/api/v1` there.

- `docker-compose.yml` publishes `7360:7360/udp`; keep it published or broadcasts won't reach the container.
- `LAN_DISCOVERY_ENABLED=false` turns it off.
- `LAN_DISCOVERY_ADVERTISED_URL` advertises a full address instead (for example behind a reverse proxy).

### Development

To spin up a dockerized development environment, run:

```
npm run dev
# optionally run the following to run in detached mode:
# npm run dev:detached
```

The UI is at http://localhost:3000, served by Vite with hot reload; it proxies `/api` to the API on
http://localhost:3001, which reloads on changes too.

To spin up a dockerized development environment with VPN support, run:

```
npm run dev:vpn
# optionally run the following to run in detached mode:
# npm run dev:vpn:detached
```

## Services

- **Downloadarr**: http://localhost:3001 (web UI; the API is under `/api/v1`, its docs at `/api/docs`)
- **Prowlarr**: http://localhost:9696
- **FlareSolverr**: http://localhost:8191 (Cloudflare bypass)
- **AriaNG**: http://localhost:6880 (Download manager UI)

## Environment Variables

Copy `.env.example` to `.env` and configure:

- `VPN_ENABLED` - Enable/disable VPN integration
- `VPN_CONFIG_PATH` - Path to OpenVPN configuration
- `DOWNLOAD_PATH` - Directory for downloaded files
- `CORS_ORIGINS` - Other origins allowed to call the API from a browser (see [CORS Configuration](docs/CORS_CONFIGURATION.md))
- `FLARESOLVERR_URL` - FlareSolverr URL for Cloudflare bypass
- `OMDB_API_KEY` - OMDb API key for movie search
- `TMDB_API_KEY` - TMDB API key for TV show search
- `IGDB_CLIENT_ID` - IGDB client ID for game search
- `IGDB_CLIENT_SECRET` - IGDB client secret for game search

## Troubleshooting

### CORS Issues

The web UI is served from the API's own address and needs no CORS setup. If another app that calls the API
shows "Origin not allowed by Access-Control-Allow-Origin" errors, see the [CORS Configuration Guide](docs/CORS_CONFIGURATION.md) for detailed setup instructions.

## License

MIT
