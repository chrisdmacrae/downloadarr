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

The WebSocket gateway (used for real-time updates) uses the same `FRONTEND_URL` configuration, so no additional setup is needed.

## Security Notes

- Only add origins you trust to the `FRONTEND_URL` list
- Use HTTPS origins in production
- Avoid using wildcards (`*`) in production environments
- The API includes `credentials: true` to support authentication cookies
