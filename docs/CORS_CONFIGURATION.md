# CORS Configuration Guide

This guide explains how to configure Cross-Origin Resource Sharing (CORS) for Downloadarr to resolve frontend-to-API communication issues.

## What is CORS?

CORS (Cross-Origin Resource Sharing) is a security feature implemented by web browsers that blocks requests from one domain to another unless explicitly allowed. When your frontend and API run on different origins (different protocol, domain, or port), you need to configure CORS properly.

## Configuration

### Environment Variable

Set the `FRONTEND_URL` environment variable to specify which origins are allowed to make requests to the API.

### Single Origin

```bash
FRONTEND_URL=http://localhost:3000
```

### Multiple Origins

For multiple allowed origins, separate them with commas:

```bash
FRONTEND_URL=http://localhost:3000,https://your-domain.com,http://downloadarr:3000
```

### Extra Origins (`CORS_ORIGINS`)

`CORS_ORIGINS` is optional and adds origins on top of `FRONTEND_URL`, comma-separated. Use it for addresses other than the UI's own, such as a LAN IP, a reverse proxy, or another tool that calls the API:

```bash
CORS_ORIGINS=http://192.168.1.10:3000,https://media.example.com
```

Set it to `*` to allow any origin:

```bash
CORS_ORIGINS=*
```

A `*` in either variable allows every origin. The API then echoes each caller's origin back rather than sending a literal `*`, because browsers reject `*` on requests with credentials. Anyone who can reach the API can then call it from any website, so only do this on a trusted network.

## Common Scenarios

### 1. Local Development

```bash
FRONTEND_URL=http://localhost:3000
```

### 2. Docker Deployment (Internal Network)

When both frontend and API are running in Docker containers:

```bash
FRONTEND_URL=http://downloadarr:3000
```

### 3. Docker with External Access

When accessing from both internal Docker network and external domain:

```bash
FRONTEND_URL=http://downloadarr:3000,https://your-domain.com,http://localhost:3000
```

### 4. Production with Custom Domain

```bash
FRONTEND_URL=https://your-downloadarr-domain.com
```

## Troubleshooting

### Error: "Origin not allowed by Access-Control-Allow-Origin"

This error occurs when the frontend origin is not included in the `FRONTEND_URL` environment variable.

**Solution:**
1. Check what origin your frontend is running on (look at the browser URL)
2. Add that origin to the `FRONTEND_URL` environment variable
3. Restart the API service

### Common Origins to Check

- `http://localhost:3000` - Local development
- `http://downloadarr:3000` - Docker container name
- `http://127.0.0.1:3000` - Local IP
- `https://your-domain.com` - Production domain

### Docker Compose Example

In your `.env` file:

```bash
# For local development
FRONTEND_URL=http://localhost:3000

# For Docker deployment with external access
FRONTEND_URL=http://localhost:3000,http://downloadarr:3000,https://your-domain.com
```

Then restart your services:

```bash
docker-compose down
docker-compose up -d
```

## WebSocket Configuration

The WebSocket gateway (used for real-time updates) uses the same `FRONTEND_URL` and `CORS_ORIGINS` configuration, so no additional setup is needed.

## Cloudflare Access

If the UI and API sit behind Cloudflare Access on different hostnames, the UI sends its API requests with credentials, so the `CF_Authorization` cookie goes along wherever its domain covers the API's hostname. When that cookie is readable from JavaScript (the Access application's HttpOnly cookie setting is off), the UI also copies the token into a `cf-access-token` header, which Access accepts on any hostname protected by the same team.

Cross-origin requests with that header trigger a CORS preflight, which Access blocks by default. Turn on **CORS settings → Bypass OPTIONS requests to origin** on the API's Access application so the preflight reaches the API, which allows the header.

## Security Notes

- Only add origins you trust to the `FRONTEND_URL` list
- Use HTTPS origins in production
- Avoid `CORS_ORIGINS=*` unless the API is only reachable on a trusted network
- The API includes `credentials: true` to support authentication cookies
