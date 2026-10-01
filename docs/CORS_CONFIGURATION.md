# CORS Configuration Guide

Downloadarr's web UI is served by the API itself, from the same address, so it needs no CORS setup: whatever address you open Downloadarr at is also where the UI finds the API, under `/api/v1`.

CORS only matters for **other** apps that call the API from a browser, such as a TV and J web app on another address or port. A browser blocks those requests unless the API allows the app's origin (its protocol, host and port).

## Configuration

### `CORS_ORIGINS`

List the origins allowed to call the API, comma-separated:

```bash
CORS_ORIGINS=http://192.168.1.10:8081,https://tv.example.com
```

Set it to `*` to allow any origin:

```bash
CORS_ORIGINS=*
```

With `*`, the API echoes each caller's origin back rather than sending a literal `*`, because browsers reject `*` on requests with credentials. Anyone who can reach the API can then call it from any website, so only do this on a trusted network.

### `FRONTEND_URL`

`FRONTEND_URL` is read the same way, and is kept for installs that already set it. It defaults to `http://localhost:3000`, the Vite dev server used in development. New installs only need `CORS_ORIGINS`.

## Troubleshooting

### Error: "Origin not allowed by Access-Control-Allow-Origin"

The app making the request is on an origin the API doesn't allow.

1. Check the origin the app is running on (the protocol, host and port in the browser's address bar)
2. Add it to `CORS_ORIGINS` in your `.env` file
3. Restart Downloadarr:

```bash
docker compose up -d
```

If you see this in Downloadarr's own UI, it was built with `VITE_API_URL` pointing at another address. The published image isn't; open the UI at the address the API is on.

## WebSocket Configuration

The WebSocket gateway (used for real-time updates) uses the same `FRONTEND_URL` and `CORS_ORIGINS` configuration, so no additional setup is needed.

## Cloudflare Access

Behind Cloudflare Access, Downloadarr's UI and API share a hostname, so the Access cookie covers both. A UI built to use an API on another hostname (`VITE_API_URL`) sends its API requests with credentials, so the `CF_Authorization` cookie goes along wherever its domain covers the API's hostname. When that cookie is readable from JavaScript (the Access application's HttpOnly cookie setting is off), the UI also copies the token into a `cf-access-token` header, which Access accepts on any hostname protected by the same team.

Cross-origin requests with that header trigger a CORS preflight, which Access blocks by default. Turn on **CORS settings → Bypass OPTIONS requests to origin** on the API's Access application so the preflight reaches the API, which allows the header.

## Security Notes

- Only add origins you trust to `CORS_ORIGINS`
- Use HTTPS origins in production
- Avoid `CORS_ORIGINS=*` unless the API is only reachable on a trusted network
- The API includes `credentials: true` to support authentication cookies
