# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Dependency stage
#
# Keyed only on the manifests, so it stays cached across source changes. The
# lock file is deliberately not copied: it is generated on macOS and records
# only darwin optional binaries, so `npm ci` fails to find rollup's native
# module on Alpine.
# ---------------------------------------------------------------------------
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json ./
COPY packages/ui/package.json ./packages/ui/
RUN npm install --no-audit --no-fund && npm cache clean --force

# ---------------------------------------------------------------------------
# Build stage
# ---------------------------------------------------------------------------
FROM node:20-alpine AS builder
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
FROM nginx:alpine AS production

ARG APP_VERSION=latest
ENV APP_VERSION=${APP_VERSION}

COPY --from=builder /app/packages/ui/dist /usr/share/nginx/html
COPY packages/ui/nginx.conf /etc/nginx/conf.d/default.conf
COPY packages/ui/docker-entrypoint.sh /docker-entrypoint.sh

RUN chmod +x /docker-entrypoint.sh && chown -R nginx:nginx /usr/share/nginx/html

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/ || exit 1

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
