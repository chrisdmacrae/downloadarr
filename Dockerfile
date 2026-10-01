# syntax=docker/dockerfile:1

# One image for the whole app: the NestJS server, with the built UI inside it
# to serve from the same port.
#
# ---------------------------------------------------------------------------
# Dependency stages
#
# Both installs are keyed only on the manifests, so they stay cached across
# source changes. The lock file is deliberately not copied: it is generated on
# macOS and records only darwin optional binaries, so `npm ci` fails on Alpine.
# See docs — regenerating it on Linux would let these become `npm ci`.
# ---------------------------------------------------------------------------
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json ./
COPY packages/api/package.json ./packages/api/
COPY packages/ui/package.json ./packages/ui/
RUN npm install --no-audit --no-fund && npm cache clean --force

# Production dependencies only, resolved once and reused by the final stage.
# The UI is built to static files, so only the API's are needed at runtime.
FROM node:20-alpine AS prod-deps
WORKDIR /app
COPY package.json ./
COPY packages/api/package.json ./packages/api/
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force

# ---------------------------------------------------------------------------
# Build stages
# ---------------------------------------------------------------------------
FROM node:20-alpine AS api-builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY packages/api ./packages/api

WORKDIR /app/packages/api
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS ui-builder
ARG APP_VERSION=latest
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY packages/ui ./packages/ui

WORKDIR /app/packages/ui
ENV VITE_APP_VERSION=${APP_VERSION}
RUN npm run build

# ---------------------------------------------------------------------------
# Production stage
# ---------------------------------------------------------------------------
FROM node:20-alpine AS production

ARG APP_VERSION=latest
ENV APP_VERSION=${APP_VERSION}

# System dependencies for VPN, downloading and Docker control.
RUN apk add --no-cache \
    openvpn \
    curl \
    wget \
    aria2 \
    docker-cli \
    shadow \
    postgresql-client \
    su-exec

WORKDIR /app

COPY package.json ./
COPY packages/api/package.json ./packages/api/

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=api-builder /app/packages/api/dist ./packages/api/dist
COPY --from=api-builder /app/packages/api/generated ./packages/api/generated
COPY --from=api-builder /app/packages/api/prisma ./packages/api/prisma
# main.ts serves this from the API's port.
COPY --from=ui-builder /app/packages/ui/dist ./packages/ui/dist
# The game platforms list. Compose mounts ./config over it, so it can be edited
# without a rebuild.
COPY config ./config

COPY packages/api/scripts/start.sh /start.sh
RUN chmod +x /start.sh

RUN mkdir -p /downloads /library /app/vpn

# The entrypoint runs as root: it maps the container user onto the host's
# PUID/PGID, makes the download and library roots the app's own, then hands
# over to start.sh as `node`.
COPY packages/api/scripts/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Docker socket access for container control.
RUN addgroup -g 999 docker || true
RUN adduser node docker || true

WORKDIR /app/packages/api

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${PORT:-3001}/api/v1 || exit 1

# ENTRYPOINT was previously missing, so start.sh never ran and migrations were
# never applied on boot.
ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "dist/main.js"]
