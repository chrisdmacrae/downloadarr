# syntax=docker/dockerfile:1

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
RUN npm install --no-audit --no-fund && npm cache clean --force

# Production dependencies only, resolved once and reused by the final stage.
FROM node:20-alpine AS prod-deps
WORKDIR /app
COPY package.json ./
COPY packages/api/package.json ./packages/api/
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force

# ---------------------------------------------------------------------------
# Build stage
# ---------------------------------------------------------------------------
FROM node:20-alpine AS builder
ARG APP_VERSION=latest
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY packages/api ./packages/api

WORKDIR /app/packages/api
RUN npx prisma generate
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
COPY --from=builder /app/packages/api/dist ./packages/api/dist
COPY --from=builder /app/packages/api/generated ./packages/api/generated
COPY --from=builder /app/packages/api/prisma ./packages/api/prisma

COPY packages/api/scripts/start.sh /start.sh
RUN chmod +x /start.sh

RUN mkdir -p /downloads /library /app/vpn

# Entrypoint maps the container user onto the host's PUID/PGID, then hands over
# to start.sh, which waits for the database and applies migrations before the
# app boots.
#
# The download and library roots are created and chowned here, as root, using
# the paths the app will actually read from its env — the app itself runs as
# `node` and cannot create directories at the filesystem root. Only those roots
# are chowned: recursing into a large mounted library would add seconds to
# every start.
RUN printf '%s\n' \
    '#!/bin/sh' \
    'set -e' \
    'PUID=${PUID:-1000}' \
    'PGID=${PGID:-1000}' \
    'groupmod -o -g "$PGID" node' \
    'usermod -o -u "$PUID" node' \
    'for dir in "${DOWNLOAD_PATH:-/downloads}" "${LIBRARY_PATH:-/library}" /app/vpn; do' \
    '  mkdir -p "$dir" 2>/dev/null || true' \
    '  chown node:node "$dir" 2>/dev/null || true' \
    'done' \
    'exec su-exec node /start.sh "$@"' \
    > /entrypoint.sh && chmod +x /entrypoint.sh

# Docker socket access for container control.
RUN addgroup -g 999 docker || true
RUN adduser node docker || true

WORKDIR /app/packages/api

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3001/ || exit 1

# ENTRYPOINT was previously missing, so start.sh never ran and migrations were
# never applied on boot.
ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "dist/main.js"]
