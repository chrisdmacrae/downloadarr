# Downloadarr

All-in-one media and ROM downloading tool with VPN integration, built with NestJS API and React frontend.

## Features

- **Media Discovery**: Search and download movies and TV shows
- **ROM Management**: Discover and download retro game ROMs
- **VPN Integration**: Secure downloading with OpenVPN support
- **Queue Management**: BullMQ-powered job processing
- **Docker Deployment**: Complete containerized setup

## Architecture

This is a monorepo containing:

- `packages/api` - NestJS REST API server with BullMQ job processing
- `packages/ui` - React frontend with shadcn/ui components

## Quick Start

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- OpenVPN configuration files (optional)

### Development

1. Run the setup script:
```bash
./scripts/setup.sh
```

2. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Start development servers:
```bash
npm run dev
```

### Production Deployment

1. Configure environment variables in `.env`
2. Start all services with Docker Compose:
```bash
docker-compose up -d
```

### VPN Setup (Optional)

1. Place your OpenVPN configuration file in `vpn-configs/`
2. Update `.env`:
```bash
VPN_ENABLED=true
VPN_CONFIG_PATH=/app/vpn/your-config.ovpn
```

## Services

- **API Server**: http://localhost:3001
- **Frontend**: http://localhost:3000
- **Jackett**: http://localhost:9117

## Environment Variables

Copy `.env.example` to `.env` and configure:

- `VPN_ENABLED` - Enable/disable VPN integration
- `VPN_CONFIG_PATH` - Path to OpenVPN configuration
- `DOWNLOAD_PATH` - Directory for downloaded files
- `JACKETT_API_KEY` - Jackett API key for torrent search

## License

MIT
