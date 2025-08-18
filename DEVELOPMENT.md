# Development Guide

This guide explains how to set up and use the development environment for Downloadarr using Docker with hot reloading.

## Prerequisites

- Docker and Docker Compose installed
- Node.js 18+ (for local development without Docker)
- Git

## Development with Docker (Recommended)

The development Docker setup provides hot reloading for both the NestJS API and React UI, making it easy to develop with a consistent environment.

### Quick Start

1. **Clone the repository:**
   ```bash
   git clone https://github.com/chrisdmacrae/downloadarr.git
   cd downloadarr
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start the development environment:**
   ```bash
   npm run dev:docker
   ```

   This will:
   - Build and start all services in development mode
   - Mount your source code for hot reloading
   - Start the API on http://localhost:3001
   - Start the UI on http://localhost:3000
   - Start supporting services (Redis, PostgreSQL, Jackett, Aria2)

### Available Scripts

- `npm run dev:docker` - Start development environment (foreground)
- `npm run dev:docker:detached` - Start development environment (background)
- `npm run dev:docker:down` - Stop development environment
- `npm run dev:docker:logs` - View logs from all services
- `npm run dev:docker:rebuild` - Rebuild and restart all services

### Hot Reloading

The development setup includes hot reloading for:

#### API (NestJS)
- Source code changes in `packages/api/src/` trigger automatic rebuilds
- The NestJS development server watches for file changes
- No need to restart the container for code changes

#### UI (React/Vite)
- Source code changes in `packages/ui/src/` trigger automatic rebuilds
- Vite's fast HMR (Hot Module Replacement) provides instant updates
- Browser automatically refreshes on changes

### File Structure

```
downloadarr/
├── docker-compose.dev.yml          # Development Docker Compose
├── docker-compose.yml              # Production Docker Compose
├── packages/
│   ├── api/
│   │   ├── Dockerfile.dev          # Development API Dockerfile
│   │   ├── Dockerfile              # Production API Dockerfile
│   │   └── src/                    # API source code (hot reloaded)
│   └── ui/
│       ├── Dockerfile.dev          # Development UI Dockerfile
│       ├── Dockerfile              # Production Dockerfile
│       └── src/                    # UI source code (hot reloaded)
└── ...
```

### Development Features

1. **Volume Mounts**: Source code is mounted read-only for security
2. **Node Modules Isolation**: Separate volumes for node_modules to avoid conflicts
3. **Environment Separation**: Development containers use separate networks and volumes
4. **Health Checks**: All services include health checks for monitoring
5. **Consistent Environment**: Same environment across all developers

### Debugging

#### View Logs
```bash
# All services
npm run dev:docker:logs

# Specific service
docker-compose -f docker-compose.dev.yml logs -f api
docker-compose -f docker-compose.dev.yml logs -f frontend
```

#### Access Container Shell
```bash
# API container
docker exec -it downloadarr-api-dev sh

# UI container
docker exec -it downloadarr-frontend-dev sh
```

#### Check Service Status
```bash
docker-compose -f docker-compose.dev.yml ps
```

### Troubleshooting

#### Port Conflicts
If you get port conflicts, check what's running on the required ports:
- 3000 (UI)
- 3001 (API)
- 5432 (PostgreSQL)
- 6379 (Redis)
- 6800 (Aria2 RPC)
- 6880 (AriaNG)
- 6888 (Aria2 BT)
- 9117 (Jackett)

#### Permission Issues
If you encounter permission issues:
```bash
# Reset Docker volumes
docker-compose -f docker-compose.dev.yml down -v
npm run dev:docker
```

#### Hot Reload Not Working
1. Ensure source files are being mounted correctly
2. Check container logs for errors
3. Verify file watchers are working inside containers

## Local Development (Alternative)

If you prefer to run services locally without Docker:

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start supporting services with Docker:**
   ```bash
   docker-compose up redis postgres jackett aria2 ariang
   ```

3. **Start development servers:**
   ```bash
   npm run dev
   ```

This runs the API and UI locally while using Docker for supporting services.

## Production vs Development

| Feature | Development | Production |
|---------|-------------|------------|
| Hot Reloading | ✅ | ❌ |
| Source Mounting | ✅ | ❌ |
| Build Optimization | ❌ | ✅ |
| Container Size | Larger | Smaller |
| Security | Relaxed | Hardened |

## Next Steps

- See [README.md](README.md) for general project information
- See [DOCKER-SETUP.md](DOCKER-SETUP.md) for production Docker setup
- See [VPN-SETUP.md](VPN-SETUP.md) for VPN configuration
