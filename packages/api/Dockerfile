# Build stage
FROM node:20-alpine AS builder

# Accept version as build argument
ARG APP_VERSION=latest

WORKDIR /app

# Copy package files (excluding lock files to avoid platform issues)
COPY package.json ./
COPY packages/api/package.json ./packages/api/

# Install all dependencies (including dev dependencies for build)
RUN npm install && npm cache clean --force

# Copy source code
COPY packages/api ./packages/api

# Build the application
WORKDIR /app/packages/api

# Generate Prisma client
RUN npx prisma generate

# Build the application
RUN npm run build

# Install production dependencies in a separate location
WORKDIR /app
RUN npm install --only=production && npm cache clean --force

# Production stage
FROM node:20-alpine AS production

# Accept version as build argument and set as environment variable
ARG APP_VERSION=latest
ENV APP_VERSION=${APP_VERSION}

# Install system dependencies for VPN, downloading, and Docker
RUN apk add --no-cache \
    openvpn \
    curl \
    wget \
    aria2 \
    docker-cli \
    shadow \
    postgresql-client

WORKDIR /app

# Copy package files
COPY package.json ./
COPY packages/api/package.json ./packages/api/

# Copy built application and dependencies from builder
COPY --from=builder /app/packages/api/dist ./packages/api/dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/api/generated ./packages/api/generated
COPY --from=builder /app/packages/api/prisma ./packages/api/prisma

# Copy startup script
COPY packages/api/scripts/start.sh /start.sh
RUN chmod +x /start.sh

# Create directories
RUN mkdir -p /downloads /app/vpn

# Create entrypoint script to handle PUID/PGID
RUN echo '#!/bin/sh' > /entrypoint.sh && \
    echo 'PUID=${PUID:-1000}' >> /entrypoint.sh && \
    echo 'PGID=${PGID:-1000}' >> /entrypoint.sh && \
    echo 'groupmod -o -g "$PGID" node' >> /entrypoint.sh && \
    echo 'usermod -o -u "$PUID" node' >> /entrypoint.sh && \
    echo 'chown -R node:node /app /downloads' >> /entrypoint.sh && \
    echo 'exec su-exec node /start.sh "$@"' >> /entrypoint.sh && \
    chmod +x /entrypoint.sh

# Install su-exec for user switching
RUN apk add --no-cache su-exec

# Add node user to docker group for Docker socket access
RUN addgroup -g 999 docker || true
RUN adduser node docker || true

WORKDIR /app/packages/api

EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
CMD curl -f http://localhost:3001/ || exit 1

CMD ["node", "dist/main.js"]

