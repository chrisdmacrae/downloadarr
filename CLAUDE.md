# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Downloadarr is a self-hosted, all-in-one media and ROM downloading tool (for content the user owns) — one NestJS server that serves its API under `/api/v1` and the built React frontend from the same port (3001), orchestrating a fleet of Docker services: Prowlarr (torrent indexing), aria2 (downloading), FlareSolverr (Cloudflare bypass), Redis, and PostgreSQL. Optional OpenVPN integration routes download traffic through a VPN.

## Commands

Development happens **inside Docker Compose** — the API and UI are not normally run bare on the host. One `downloadarr` dev container (`Dockerfile.dev`) runs both `nest --watch` (port 3001) and Vite (port 3000, proxying `/api` to 3001), with both source dirs volume-mounted for hot reload.

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

The heart of the app is `packages/api/src/torrents/`: users create a `RequestedTorrent` (movie, TV show, game, or music album), and background cron loops drive it through a **state machine** to completion. Do not set `status` directly — transitions are validated by `state-machine/request-state-machine.ts`:

```
PENDING → SEARCHING → FOUND → DOWNLOADING → COMPLETED (terminal)
                (plus FAILED / CANCELLED / EXPIRED side states)
                DOWNLOADING → ORGANIZE_FAILED → COMPLETED or PENDING
```

`ORGANIZE_FAILED` holds a request whose download finished (from `DOWNLOADING`, or from `PENDING`/`FOUND`/`FAILED`/`EXPIRED` when the download landed late) but whose files could not all be moved to the library (`organizeError`, `unorganizedFiles`). Nothing searches or downloads for it until `POST /torrent-requests/:id/retry-organize` (or a manual organize mapped to it) moves the files; it cannot be cancelled, because cancelling deletes a download's files. A request can also jump to `COMPLETED` from a non-downloading state when its files were organized by hand (`markAsManuallyOrganized`).

TV shows have a second, parallel state machine (`tv-show-state-machine.ts`) tracking per-season (`TvShowSeason`) and per-episode (`TvShowEpisode`) status; ongoing shows (`isOngoing`) keep searching as new episodes air. `RequestLifecycleOrchestrator` coordinates transitions and side effects.

Background work is **cron-driven via @nestjs/schedule**, not BullMQ (despite README/PROJECT-PLAN mentions; Redis is in the stack but queues aren't wired up):

- `torrent-checker.service.ts` — every 30s, searches Prowlarr for pending requests. A TV show is only searched while it is missing an episode that has aired; otherwise its next check is pushed back without a search attempt. A show downloads one torrent at a time, earliest missing season first
- `tv-show-search-loop.service.ts` — every 5min, TV-show season/episode search loop
- `download-progress-tracker.service.ts` — every 30s, polls aria2 for every `TorrentDownload` still marked `DOWNLOADING`, whatever state its request is in (tracking by request stranded downloads that finished after their request failed or went back to pending). A finished download is organized and its request caught up; one aria2 has forgotten is re-added from its stored magnet/link and resumes from the partial files; a request marked failed while its download still runs goes back to `DOWNLOADING`. One run at a time
- `organization/services/downloads-folder.service.ts` — every 10min, organizes downloads-folder entries that match exactly one open request (same type folder, same normalised title, compatible year, untouched for 15 minutes, no download of the request's own running)
- `organization/services/reverse-indexing.service.ts` — hourly, indexes existing library files
- `recommendations/services/recommendation-sync.service.ts` — daily at 4am, rebuilds every profile's music and Trakt recommendations

### Module map (packages/api/src)

- `discovery/` — external metadata APIs (OMDb movies, TMDB TV, IGDB games) + Prowlarr torrent search, quality/format filtering (`torrent-filter.service.ts`) and ranking. `GET /movies/discover` and `/tv-shows/discover` page through TMDB by genre, year range and sort (`TmdbService.discoverMovies/discoverTvShows`), and `GET /games/discover` does the same over IGDB with a platform filter (`IgdbService.discoverGames`; IGDB sorts nulls first, so every order but `title` leaves out unrated games). The UI's browse pages (`pages/Browse.tsx`, at `/movies/browse`, `/tv-shows/browse` and `/games/browse`) scroll through them. Listings stop at 500 pages, so decade filters are what reach older titles
- `torrents/` — request lifecycle, state machines, TV-show gap analysis/selection (see above)
- `download/` — aria2 JSON-RPC client (`aria2.service.ts`), Socket.IO gateway on namespace `/downloads` (room per download: `download-${id}`) pushing progress to the UI. `GET /downloads` lists `DownloadMetadata` rows, plus whatever aria2 is running that has no row (`untracked: true`, with the aria2 GID as `id`)
- `http-downloads/` — direct HTTP/HTTPS downloads (separate `HttpDownloadRequest` model, own progress tracker)
- `organization/` — moves completed downloads from `DOWNLOAD_PATH` into `LIBRARY_PATH` per naming rules; `OrganizeQueue` for manual approval; reverse indexing of pre-existing files. `DownloadOrganizationService` is the one place a download's files are turned into library files (the download tracker, the retry and manual organize all use it); subtitles are moved with their video and renamed after it, release notes and samples are left behind. `DownloadsFolderService` lists what is still in the downloads folder (`GET /organization/downloads`) and organizes an entry by hand as a request or a typed title (`POST /organization/downloads/organize`); the UI for it is on the Downloads page
- `config/` — `AppConfiguration` singleton row in Postgres: onboarding state + API keys (Prowlarr, OMDb, TMDB, IGDB) and the Spotify/Trakt app credentials. **Runtime config lives in the DB, set via the onboarding wizard/settings UI — not only env vars.**
- `initialization/` — creates `movies/`, `tv-shows/`, `games/`, `other/` subdirs under downloads and library paths on boot
- `vpn/`, `docker/`, `system/` — VPN connectivity checks, Docker container control, health/version endpoints
- `requests/` — aggregated request views for the UI
- `recommendations/` — per-person **recommendation profiles** (`RecommendationProfile`). Each profile connects its own accounts (`RecommendationSource`, one per provider per profile), and recommendations and dismissals belong to a profile. API reads take an optional `profileId`; without one they merge every profile (`recommendations/merge.ts`). The Spotify and Trakt app credentials are install-level, on `AppConfiguration`. Trakt connects by device login (`trakt-auth.service.ts`; its refresh tokens are single-use) and feeds `VideoRecommendation` (recommended + watchlist, with artwork from TMDB via `TmdbService.getMovieSummary/getTvSummary`), shown as rails on the Movies and TV pages. `RecommendationsModule` also provides everything in `music/` (one module avoids a dependency cycle)
- `music/` — music discovery: ListenBrainz/Last.fm listening history, a public Deezer profile (read by user ID, no OAuth) and Spotify (OAuth with PKCE via `music/spotify/callback`, which needs an HTTPS address) → taste profile → cached recommendation lists per profile (`MusicRecommendation`, built by `music-lists.service.ts`); Deezer's public API supplies related artists and 30s previews. Artist radio (`GET /music/radio`, `music-radio.service.ts`) is built on demand and never stored: Deezer's artist mix, plus an LB Radio playlist when a ListenBrainz token is set. The Music page requests albums as `ContentType.MUSIC` (`title` is the album, `artist` is set), searched in Prowlarr's Audio category and ranked by `discovery/services/music-release-ranker.ts`

Every route has the global prefix `/api/v1` (`API_PREFIX` in `common/utils/serve-ui.ts`, set in `main.ts`); controllers declare paths without it, and controller specs that build their own app call them unprefixed. `main.ts` also serves the built UI (`packages/ui/dist`, or `UI_DIST_PATH`): static files, and `index.html` for any other GET outside `/api` and `/socket.io`. Swagger docs are served at `/api/docs` (port 3001). Global `ValidationPipe` with `whitelist: true, forbidNonWhitelisted: true` — DTO properties must be declared or requests 400.

### Frontend (packages/ui)

Single axios client in `src/services/api.ts` (base URL `API_BASE_URL`: `/api/v1` on the page's own origin, or `VITE_API_URL` at build time for an API elsewhere). There is no nginx and no runtime config file; in development Vite proxies `/api` (to `VITE_API_PROXY`, default `http://localhost:3001`). Pages in `src/pages/` (Dashboard, Downloads, Requests, per-type Discovery pages, Settings, Onboarding). `OnboardingGuard` blocks the app until onboarding is completed (checked against the API). Real-time download progress comes over the `/downloads` Socket.IO namespace.

## Product constraints

- **VPN posture**: with the VPN overlay (`docker-compose.vpn.yml`), only **aria2** (and the vpn-ip-monitor) run with `network_mode: service:vpn` — download traffic goes through the VPN; the API, frontend, Prowlarr, etc. keep normal networking.
- **Onboarding is mandatory**: features assume `AppConfiguration.onboardingCompleted`; API keys for discovery services come from the DB config, with env vars as fallback.
- **File organization naming** is specified in `docs/prompts/ORGANIZATION-RULES.md`: movies `{title} ({year})/`, TV `{title} ({year})/Season {n}/{title} - SxxExx - ...`, games `{title} ({platform})/`, music `{artist}/{title} ({year})/` (music patterns may contain `/` to nest folders). Organization rules per content type are user-editable (`OrganizationRule` model); games platforms come from `config/game-platforms.yml`.
- **CORS**: the UI is same-origin and needs none. Other clients (the Vite dev server, TV and J) are allowed by `CORS_ORIGINS`, plus the older `FRONTEND_URL` (both comma-separated; `*` allows any), resolved by `common/utils/cors-origins.ts` for both `main.ts` and the WebSocket gateway (see `docs/CORS_CONFIGURATION.md`).
- **Deployment**: one image, `ghcr.io/chrisdmacrae/downloadarr` (root `Dockerfile`: API plus built UI), is published to GHCR by `.github/workflows/build-and-deploy.yml` on pushes to `main` (as `edge`) and `v*.*.*` tags. A release is made by pushing a tag (`git tag v1.2.3 && git push origin v1.2.3`), not in the GitHub UI: once the images are published the workflow's `release` job cuts the GitHub release, with install, upgrade and rollback instructions from `.github/release-notes.md` (filled in by `.github/scripts/release-notes.sh`, which also flags changes to the compose files and `.env.example`); end users install via `setup.sh` + `docker-compose.yml`, where it is the `downloadarr` service, and upgrade with `upgrade.sh` (database backup, pull, restart; it detects the VPN overlay so both compose files are used when the install has one — with the overlay the containers are `downloadarr-app-vpn`, `downloadarr-aria2-vpn` and `downloadarr-vpn`). Changes to compose files affect real installs.
- **API clients**: TV and J (`../tv-and-j`, `packages/core/downloadarr/client.ts`, mocked by its `scripts/dev-downloadarr.mjs`) calls this API. A route moved or renamed here has to move there too.
- **aria2 paths**: aria2 may see the download folder at another path than the server (`/downloads` vs `DOWNLOAD_PATH` in Compose). `common/utils/aria2-paths.ts` translates both ways, from `DOWNLOAD_PATH` and `ARIA2_DOWNLOAD_PATH`; don't hardcode either.
- `docs/prompts/` contains design docs (requests system, organization rules, reverse indexing) that explain intent behind these subsystems.
