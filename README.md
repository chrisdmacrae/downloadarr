# Downloadarr

All-in-one media and ROM downloading tool with VPN integration, built with NestJS API and React frontend.

## Features

- **Media Discovery**: Search and download movies and TV shows
- **ROM Management**: Discover and download retro game ROMs
- **VPN Integration**: Secure downloading with OpenVPN support
- **Queue Management**: BullMQ-powered job processing
- **Docker Deployment**: Complete containerized setup

## Quick Start

### Prerequisites

- Docker & Docker Compose
- OpenVPN configuration files (optional)
- External API keys for discovery services (OMDb, TMDB, IGDB)

### Setup

**Option 1: One-line install (recommended)**
```bash
curl -fsSL https://raw.githubusercontent.com/chrisdmacrae/downloadarr/main/setup.sh | bash
```

**Option 2: Download and run manually**
```bash
curl -fsSL https://raw.githubusercontent.com/chrisdmacrae/downloadarr/main/setup.sh -o setup.sh
chmod +x setup.sh
./setup.sh
```

The setup script will:
- ✅ Check Docker installation
- ⬇️ Download required configuration files
- ⚙️ Configure environment variables (paths, API keys)
- 🔒 Set up VPN support (optional)
- 🚀 Start all services with Docker Compose

### Development

TODO: add dev script

## Services

- **API Server**: http://localhost:3001
- **Frontend**: http://localhost:3000
- **Jackett**: http://localhost:9117
- **FlareSolverr**: http://localhost:8191 (Cloudflare bypass)
- **AriaNG**: http://localhost:6880 (Download manager UI)

## Environment Variables

Copy `.env.example` to `.env` and configure:

- `VPN_ENABLED` - Enable/disable VPN integration
- `VPN_CONFIG_PATH` - Path to OpenVPN configuration
- `DOWNLOAD_PATH` - Directory for downloaded files
- `JACKETT_API_KEY` - Jackett API key for torrent search
- `FLARESOLVERR_URL` - FlareSolverr URL for Cloudflare bypass
- `OMDB_API_KEY` - OMDb API key for movie search
- `TMDB_API_KEY` - TMDB API key for TV show search
- `IGDB_CLIENT_ID` - IGDB client ID for game search
- `IGDB_CLIENT_SECRET` - IGDB client secret for game search

## License

MIT
