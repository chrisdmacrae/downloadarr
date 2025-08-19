# Build stage
FROM node:20-alpine AS builder

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

# Production stage
FROM node:20-alpine AS production

# Install system dependencies for VPN, downloading, and Docker
RUN apk add --no-cache \
    openvpn \
    curl \
    wget \
    aria2 \
    docker-cli \
    shadow

WORKDIR /app

# Copy package files and install production dependencies
COPY package.json ./
COPY packages/api/package.json ./packages/api/
RUN npm install --only=production && npm cache clean --force

# Copy built application
COPY --from=builder /app/packages/api/dist ./packages/api/dist
COPY --from=builder /app/packages/api/node_modules ./packages/api/node_modules
COPY --from=builder /app/packages/api/generated ./packages/api/generated
COPY --from=builder /app/packages/api/prisma ./packages/api/prisma

# Create directories
RUN mkdir -p /downloads /app/vpn

# Set permissions and Docker access
RUN chown -R node:node /app /downloads

# Add node user to docker group for Docker socket access
RUN addgroup -g 999 docker || true
RUN adduser node docker || true

USER node

WORKDIR /app/packages/api

EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/ || exit 1

CMD ["node", "dist/main.js"]
