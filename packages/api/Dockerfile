# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/api/package*.json ./packages/api/

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY packages/api ./packages/api

# Build the application
WORKDIR /app/packages/api
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Install system dependencies for VPN and downloading
RUN apk add --no-cache \
    openvpn \
    curl \
    wget \
    aria2

WORKDIR /app

# Copy package files and install production dependencies
COPY package*.json ./
COPY packages/api/package*.json ./packages/api/
RUN npm ci --only=production && npm cache clean --force

# Copy built application
COPY --from=builder /app/packages/api/dist ./packages/api/dist
COPY --from=builder /app/packages/api/node_modules ./packages/api/node_modules

# Create directories
RUN mkdir -p /downloads /app/vpn

# Set permissions
RUN chown -R node:node /app /downloads
USER node

WORKDIR /app/packages/api

EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/ || exit 1

CMD ["node", "dist/main.js"]
