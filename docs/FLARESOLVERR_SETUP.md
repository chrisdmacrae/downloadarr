# FlareSolverr Setup Guide

FlareSolverr is a proxy server that helps bypass Cloudflare protection, which is commonly encountered when accessing torrent indexers through Jackett.

## What is FlareSolverr?

FlareSolverr is a proxy server to bypass Cloudflare protection. It starts a proxy server and it waits for user requests in an HTTP API form. When some request arrives, it uses Selenium with Chrome browser to solve the challenge and returns the response.

## Automatic Setup

FlareSolverr is automatically included in both the standard and VPN docker-compose configurations and will start alongside other services.

### Default Configuration:
- **Port**: 8191
- **Container Name**:
  - Standard mode: `downloadarr-flaresolverr`
  - VPN mode: `downloadarr-flaresolverr-vpn`
- **Internal URL**: http://flaresolverr:8191

### Quick Configuration Script

Run the automatic configuration script to set up Jackett with FlareSolverr:

```bash
./scripts/configure-jackett-flaresolverr.sh
```

This script will:
- Detect if you're running in VPN mode
- Configure Jackett to use FlareSolverr
- Restart Jackett to apply changes
- Verify the configuration

## Configuring Jackett to Use FlareSolverr

1. **Access Jackett Web UI**: Navigate to http://localhost:9117
2. **Go to Settings**: Click on the gear icon in the top right
3. **Configure FlareSolverr**:
   - **FlareSolverr API URL**: `http://flaresolverr:8191/v1`
   - **Max timeout**: 60 (seconds)
4. **Save Settings**

## Configuring Individual Indexers

For indexers that require Cloudflare bypass:

1. **Add/Edit an Indexer** in Jackett
2. **Look for FlareSolverr settings** in the indexer configuration
3. **Enable FlareSolverr** if the option is available
4. **Test the indexer** to ensure it's working properly

## Common Indexers That Benefit from FlareSolverr

- 1337x
- RARBG (when available)
- Torrentz2
- ExtraTorrent
- Many private trackers with Cloudflare protection

## Troubleshooting

### FlareSolverr Not Working
1. Check if the container is running:
   - Standard mode: `docker ps | grep downloadarr-flaresolverr`
   - VPN mode: `docker ps | grep downloadarr-flaresolverr-vpn`
2. Check logs:
   - Standard mode: `docker logs downloadarr-flaresolverr`
   - VPN mode: `docker logs downloadarr-flaresolverr-vpn`
3. Verify the URL in Jackett settings is correct: `http://flaresolverr:8191/v1`
4. For VPN mode, ensure both base and VPN compose files are used:
   ```bash
   docker-compose -f docker-compose.yml -f docker-compose.vpn.yml up -d
   ```

### Slow Response Times
- FlareSolverr can be slow as it needs to load a full browser
- Increase timeout values in Jackett if needed
- Consider using FlareSolverr only for indexers that actually need it

### Memory Usage
- FlareSolverr uses Chrome browser, so it can consume significant memory
- Monitor system resources if running on limited hardware

## Environment Variables

The following environment variables can be configured in docker-compose.yml:

```yaml
environment:
  LOG_LEVEL: info          # debug, info, warning, error
  LOG_HTML: false          # Log HTML responses (for debugging)
  CAPTCHA_SOLVER: none     # Captcha solving method
  TZ: UTC                  # Timezone
```

## API Usage

FlareSolverr provides an HTTP API that can be used directly:

- **Endpoint**: http://localhost:8191/v1
- **Health Check**: GET http://localhost:8191/v1/health

For more advanced usage, refer to the [FlareSolverr documentation](https://github.com/FlareSolverr/FlareSolverr).
