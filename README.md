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

After setup, visit http://localhost:3000 to complete the onboarding wizard where you'll:
- Configure your Prowlarr API key
- Set up file organization preferences
- Complete your Downloadarr setup

### Upgrading from a Jackett install

Downloadarr now indexes through [Prowlarr](https://prowlarr.com) instead of Jackett. The `jackett`
service is replaced by `prowlarr` on port 9696, so this upgrade needs a **new
`docker-compose.yml`** — the usual `docker compose pull && docker compose up -d` only refreshes
images and would leave you running Jackett with an API that no longer talks to it.

> **Do not re-run `setup.sh` to upgrade.** It overwrites `.env` with the defaults, which would
> reset your `POSTGRES_PASSWORD` and lock the API out of your existing database. Nothing in `.env`
> needs to change for this upgrade.

From the directory holding your `docker-compose.yml`:

```bash
docker compose down
curl -fsSL https://raw.githubusercontent.com/chrisdmacrae/downloadarr/main/docker-compose.yml -o docker-compose.yml
docker compose pull
docker compose up -d --remove-orphans
```

VPN users should re-download `docker-compose.vpn.yml` the same way, and add
`-f docker-compose.vpn.yml` to the last two commands.

`--remove-orphans` is what clears out the old `jackett` container, which would otherwise keep
running as a leftover.

The API applies the database migration on boot. It renames the stored indexer settings and
**clears the saved API key** — a Jackett key does not authenticate against Prowlarr, and leaving it
in place would look configured while every search returned 401. So finish in the UI:

1. Open Prowlarr at http://localhost:9696 and complete its first-run setup (it requires you to set
   up authentication, which Jackett did not)
2. Add your indexers there — Prowlarr ships the same indexer definitions Jackett did, but they do
   not carry over automatically
3. Copy the API key from Prowlarr's **Settings → General**
4. Paste it into Downloadarr under **Settings → Indexing**, then hit **Test connection**

Until step 4 is done every search comes back empty. Existing requests are not lost: the search loop
retries requests in the pending, failed and expired states alike, so anything outstanding picks back
up on its own once the key is in place.

For indexers behind Cloudflare, see [docs/FLARESOLVERR_SETUP.md](docs/FLARESOLVERR_SETUP.md) — in
Prowlarr, FlareSolverr is applied per indexer via a tag rather than globally.

Your Jackett config is untouched by all of this. Once you are happy with the switch, reclaim the
space with `docker volume rm downloadarr_jackett_config`.

### Development

To spin up a dockerized development environment, run:

```
npm run dev
# optionally run the following to run in detached mode:
# npm run dev:detached
```

To spin up a dockerized development environment with VPN support, run:

```
npm run dev:vpn
# optionally run the following to run in detached mode:
# npm run dev:vpn:detached
```

## Services

- **API Server**: http://localhost:3001
- **Frontend**: http://localhost:3000
- **Prowlarr**: http://localhost:9696
- **FlareSolverr**: http://localhost:8191 (Cloudflare bypass)
- **AriaNG**: http://localhost:6880 (Download manager UI)

## Environment Variables

Copy `.env.example` to `.env` and configure:

- `VPN_ENABLED` - Enable/disable VPN integration
- `VPN_CONFIG_PATH` - Path to OpenVPN configuration
- `DOWNLOAD_PATH` - Directory for downloaded files
- `FRONTEND_URL` - Allowed frontend origins for CORS (see [CORS Configuration](docs/CORS_CONFIGURATION.md))
- `FLARESOLVERR_URL` - FlareSolverr URL for Cloudflare bypass
- `OMDB_API_KEY` - OMDb API key for movie search
- `TMDB_API_KEY` - TMDB API key for TV show search
- `IGDB_CLIENT_ID` - IGDB client ID for game search
- `IGDB_CLIENT_SECRET` - IGDB client secret for game search

## Troubleshooting

### CORS Issues

If you encounter "Origin not allowed by Access-Control-Allow-Origin" errors, see the [CORS Configuration Guide](docs/CORS_CONFIGURATION.md) for detailed setup instructions.

## License

MIT
