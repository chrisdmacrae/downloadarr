# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Downloadarr is a self-hosted, all-in-one media and ROM downloading tool (for content the user owns) — a NestJS API plus React frontend orchestrating a fleet of Docker services: Jackett (torrent indexing), aria2 (downloading), FlareSolverr (Cloudflare bypass), Redis, and PostgreSQL. Optional OpenVPN integration routes download traffic through a VPN.

## Commands

Development happens **inside Docker Compose** — the API and UI are not normally run bare on the host. Source dirs are volume-mounted into the dev containers for hot reload.

```bash
npm run dev              # start full dev stack (docker-compose.yml + docker-compose.dev.yml)
npm run dev:build        # same, rebuilding images
npm run dev:detached     # detached mode
npm run dev:logs         # follow logs
npm run dev:vpn          # dev stack with VPN overlay (needs config.ovpn + credentials.txt)

npm run build            # build all workspaces
npm run lint             # lint all workspaces
npm run test             # run tests (only @app/api has tests)
```

API-specific (run from `packages/api/` or with `--workspace=@app/api`):

```bash
npm run test --workspace=@app/api                         # all API tests (Jest)
npx jest torrent-filter --prefix packages/api             # single test by name pattern
npm run db:migrate --workspace=@app/api                   # prisma migrate deploy
npm run db:generate --workspace=@app/api                  # regenerate Prisma client
```

Tests are colocated `*.spec.ts` files next to their source (e.g. `src/discovery/services/torrent-filter.service.spec.ts`).

## Architecture

npm workspaces monorepo: `packages/api` (`@app/api`, NestJS 10) and `packages/ui` (`@app/ui`, React 18 + Vite + Tailwind/shadcn + React Query).

### Prisma client location (gotcha)

The Prisma client is generated to `packages/api/generated/prisma` (not `node_modules/@prisma/client`). API code imports models/enums like `RequestStatus` from relative paths such as `../../../generated/prisma`. After schema changes, run `db:generate` or imports break.

### The request lifecycle (core domain)

The heart of the app is `packages/api/src/torrents/`: users create a `RequestedTorrent` (movie, TV show, or game), and background cron loops drive it through a **state machine** to completion. Do not set `status` directly — transitions are validated by `state-machine/request-state-machine.ts`:

```
PENDING → SEARCHING → FOUND → DOWNLOADING → COMPLETED (terminal)
                (plus FAILED / CANCELLED / EXPIRED side states)
```

TV shows have a second, parallel state machine (`tv-show-state-machine.ts`) tracking per-season (`TvShowSeason`) and per-episode (`TvShowEpisode`) status; ongoing shows (`isOngoing`) keep searching as new episodes air. `RequestLifecycleOrchestrator` coordinates transitions and side effects.

Background work is **cron-driven via @nestjs/schedule**, not BullMQ (despite README/PROJECT-PLAN mentions; Redis is in the stack but queues aren't wired up):

- `torrent-checker.service.ts` — every 30s, searches Jackett for pending requests
- `tv-show-search-loop.service.ts` — every 5min, TV-show season/episode search loop
- `download-progress-tracker.service.ts` — every 30s, polls aria2 and updates request status
- `organization/services/reverse-indexing.service.ts` — hourly, indexes existing library files

### Module map (packages/api/src)

- `discovery/` — external metadata APIs (OMDb movies, TMDB TV, IGDB games) + Jackett torrent search, quality/format filtering (`torrent-filter.service.ts`) and ranking
- `torrents/` — request lifecycle, state machines, TV-show gap analysis/selection (see above)
- `download/` — aria2 JSON-RPC client (`aria2.service.ts`), Socket.IO gateway on namespace `/downloads` (room per download: `download-${id}`) pushing progress to the UI
- `http-downloads/` — direct HTTP/HTTPS downloads (separate `HttpDownloadRequest` model, own progress tracker)
- `organization/` — moves completed downloads from `DOWNLOAD_PATH` into `LIBRARY_PATH` per naming rules; `OrganizeQueue` for manual approval; reverse indexing of pre-existing files
- `config/` — `AppConfiguration` singleton row in Postgres: onboarding state + API keys (Jackett, OMDb, TMDB, IGDB). **Runtime config lives in the DB, set via the onboarding wizard/settings UI — not only env vars.**
- `initialization/` — creates `movies/`, `tv-shows/`, `games/`, `other/` subdirs under downloads and library paths on boot
- `vpn/`, `docker/`, `system/` — VPN connectivity checks, Docker container control, health/version endpoints
- `requests/` — aggregated request views for the UI

Swagger docs are served at `/api` on the API (port 3001). Global `ValidationPipe` with `whitelist: true, forbidNonWhitelisted: true` — DTO properties must be declared or requests 400.

### Frontend (packages/ui)

Single axios client in `src/services/api.ts` (base URL from `VITE_API_URL`, default `http://localhost:3001`). Pages in `src/pages/` (Dashboard, Downloads, Requests, per-type Discovery pages, Settings, Onboarding). `OnboardingGuard` blocks the app until onboarding is completed (checked against the API). Real-time download progress comes over the `/downloads` Socket.IO namespace.

## Product constraints

- **VPN posture**: with the VPN overlay (`docker-compose.vpn.yml`), only **aria2** (and the vpn-ip-monitor) run with `network_mode: service:vpn` — download traffic goes through the VPN; the API, frontend, Jackett, etc. keep normal networking.
- **Onboarding is mandatory**: features assume `AppConfiguration.onboardingCompleted`; API keys for discovery services come from the DB config, with env vars as fallback.
- **File organization naming** is specified in `docs/prompts/ORGANIZATION-RULES.md`: movies `{title} ({year})/`, TV `{title} ({year})/Season {n}/{title} - SxxExx - ...`, games `{title} ({platform})/`. Organization rules per content type are user-editable (`OrganizationRule` model); games platforms come from `config/game-platforms.yml`.
- **CORS**: allowed origins come from `FRONTEND_URL` (comma-separated) in both `main.ts` and the WebSocket gateway — keep them in sync when touching CORS (see `docs/CORS_CONFIGURATION.md`).
- **Deployment**: images are published to GHCR by `.github/workflows/build-and-deploy.yml` on pushes to `main` and `v*` tags; end users install via `setup.sh` + `docker-compose.yml`. Changes to compose files affect real installs.
- `docs/prompts/` contains design docs (requests system, organization rules, reverse indexing) that explain intent behind these subsystems.
