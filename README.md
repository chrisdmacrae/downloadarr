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
