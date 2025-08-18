# Docker Setup Guide

This project provides two Docker Compose configurations:

1. **Base Configuration** (`docker-compose.yml`) - All services without VPN
2. **VPN Overlay** (`docker-compose.vpn.yml`) - Adds VPN routing for secure downloads

## Quick Start

### Option 1: Without VPN (Default)

```bash
# Start all services without VPN
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Option 2: With VPN (Recommended for torrents)

```bash
# Start all services with VPN routing
docker-compose -f docker-compose.yml -f docker-compose.vpn.yml up -d

# View logs
docker-compose -f docker-compose.yml -f docker-compose.vpn.yml logs -f

# Stop services
docker-compose -f docker-compose.yml -f docker-compose.vpn.yml down
```

## Services Overview

### Base Services (docker-compose.yml)

| Service | Port | Description |
|---------|------|-------------|
| **api** | 3001 | NestJS REST API server |
| **frontend** | 3000 | React frontend application |
| **redis** | 6379 | BullMQ job queue storage |
| **postgres** | 5432 | Database (optional) |
| **aria2** | 6800, 6888 | Download engine |
| **ariang** | 6880 | Aria2 web interface |
| **jackett** | 9117 | Torrent indexer |

### VPN Services (docker-compose.vpn.yml)

| Service | Description |
|---------|-------------|
| **vpn** | OpenVPN client container |
| **aria2** (override) | Routes through VPN network |
| **api** (override) | Connects to Aria2 via VPN |

## VPN Setup

### 1. Prepare VPN Configuration

```bash
# Place your OpenVPN config in vpn-configs/
cp your-provider.ovpn vpn-configs/

# If authentication required, create credentials file
echo "your_username" > vpn-configs/credentials.txt
echo "your_password" >> vpn-configs/credentials.txt
```

### 2. Environment Variables

Create a `.env` file:

```env
# VPN Configuration
VPN_ENABLED=true
TZ=America/New_York

# Aria2 Configuration
ARIA2_RPC_SECRET=your_secure_secret_here

# Database
POSTGRES_PASSWORD=secure_password_here

# Jackett
JACKETT_API_KEY=your_jackett_api_key
```

### 3. Start with VPN

```bash
docker-compose -f docker-compose.yml -f docker-compose.vpn.yml up -d
```

## Network Architecture

### Without VPN
```
Internet ← → Aria2 (direct connection)
              ↑
            API Server
```

### With VPN
```
Internet ← → VPN Container ← → Aria2 (routed through VPN)
                              ↑
                            API Server
```

## Accessing Services

| Service | URL | Description |
|---------|-----|-------------|
| Frontend | http://localhost:3000 | Main application |
| API | http://localhost:3001 | REST API |
| AriaNG | http://localhost:6880 | Aria2 web interface |
| Jackett | http://localhost:9117 | Torrent indexer |

## Troubleshooting

### VPN Issues

```bash
# Check VPN container logs
docker logs downloadarr-vpn

# Test VPN connection
docker exec downloadarr-vpn curl -s https://api.ipify.org

# Check if Aria2 is accessible through VPN
docker exec downloadarr-api curl -s http://vpn:6800/jsonrpc
```

### Aria2 Issues

```bash
# Check Aria2 logs
docker logs downloadarr-aria2

# Test Aria2 RPC (without VPN)
curl -X POST http://localhost:6800/jsonrpc \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":"1","method":"aria2.getVersion"}'

# Test Aria2 RPC (with VPN, from API container)
docker exec downloadarr-api curl -X POST http://vpn:6800/jsonrpc \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":"1","method":"aria2.getVersion"}'
```

### General Debugging

```bash
# View all container status
docker-compose ps

# Check container logs
docker-compose logs [service_name]

# Restart specific service
docker-compose restart [service_name]

# Rebuild and restart
docker-compose up -d --build [service_name]
```

## Development

### Building Images

```bash
# Build all images
docker-compose build

# Build specific service
docker-compose build api
```

### Development Mode

```bash
# Start with development overrides
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

## Security Notes

- VPN container requires elevated privileges (`cap_add: net_admin`)
- Never commit VPN configuration files to version control
- Use strong passwords for all services
- Consider using Docker secrets for production deployments
- Regularly update container images for security patches

## Performance Tuning

### Aria2 Optimization

Edit environment variables in docker-compose files:

```yaml
environment:
  DISK_CACHE: 128M          # Increase for better performance
  MAX_CONCURRENT_DOWNLOADS: 5
  MAX_CONNECTION_PER_SERVER: 8
  SPLIT: 8                  # Number of connections per download
```

### Resource Limits

Add resource constraints:

```yaml
deploy:
  resources:
    limits:
      memory: 512M
      cpus: '0.5'
```
