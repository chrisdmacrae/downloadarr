# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/ui/package*.json ./packages/ui/

# Install dependencies
RUN npm ci && npm cache clean --force

# Copy source code
COPY packages/ui ./packages/ui

# Build the application
WORKDIR /app/packages/ui
RUN npm run build

# Production stage
FROM nginx:alpine AS production

# Copy built application
COPY --from=builder /app/packages/ui/dist /usr/share/nginx/html

# Copy nginx configuration
COPY packages/ui/nginx.conf /etc/nginx/conf.d/default.conf

# Create nginx user and set permissions
RUN chown -R nginx:nginx /usr/share/nginx/html

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
