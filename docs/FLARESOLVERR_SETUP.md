# FlareSolverr Setup Guide

FlareSolverr is a proxy server that helps bypass Cloudflare protection, which is commonly encountered when accessing torrent indexers through Prowlarr.

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

### What Downloadarr configures for you

About 30 seconds after the API starts (and whenever you POST to `/prowlarr/configure`), Downloadarr talks to Prowlarr's API and:

1. Creates a Prowlarr tag called `flaresolverr`, if it does not exist
2. Creates — or updates — a **FlareSolverr indexer proxy** pointing at your FlareSolverr URL, with a 60 second request timeout
3. Attaches the `flaresolverr` tag to that proxy

The URL it uses comes from **Settings → Indexing → FlareSolverr URL** in the Downloadarr UI, falling back to the `FLARESOLVERR_URL` environment variable.

Check what it found with:

```bash
curl http://localhost:3001/prowlarr/status
```

## Turning FlareSolverr on for an indexer

This is the one manual step, and it is different from how Jackett worked. In Prowlarr, FlareSolverr is **not** a global setting: an indexer is routed through the proxy only when it carries one of the proxy's tags.

1. Open Prowlarr at http://localhost:9696
2. Go to **Indexers**, and edit the indexer that needs Cloudflare bypass
3. Add the `flaresolverr` tag to it
4. Save, then use **Test** to confirm the indexer works

Indexers without that tag keep talking to their site directly, which is faster — so only tag the ones that actually need it.

To confirm the proxy itself is registered, look under **Settings → Indexers → Indexer Proxies** in Prowlarr; you should see a `FlareSolverr` entry tagged `flaresolverr`.

## Common Indexers That Benefit from FlareSolverr

- 1337x
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
3. Verify the host in Prowlarr's FlareSolverr proxy is `http://flaresolverr:8191/`
4. Confirm the failing indexer actually carries the `flaresolverr` tag
5. For VPN mode, ensure both base and VPN compose files are used:
   ```bash
   docker-compose -f docker-compose.yml -f docker-compose.vpn.yml up -d
   ```

### The proxy was never created
Downloadarr skips configuration when it cannot reach Prowlarr or has no API key for it. Both are reported by `/prowlarr/status`; fix whichever is false, then re-trigger with:

```bash
curl -X POST http://localhost:3001/prowlarr/configure
```

### Slow Response Times
- FlareSolverr can be slow as it needs to load a full browser
- Raise the proxy's **Request Timeout** in Prowlarr (it is an advanced setting on the proxy) if needed
- Consider tagging only the indexers that actually need it

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
