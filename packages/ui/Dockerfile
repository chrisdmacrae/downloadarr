# Build stage
FROM node:18-alpine AS builder

# Accept version as build argument
ARG APP_VERSION=latest

WORKDIR /app

# Copy package files (excluding lock files to avoid platform issues)
COPY package.json ./
COPY packages/ui/package.json ./packages/ui/

# Install dependencies
RUN npm install && npm cache clean --force

# Copy source code
COPY packages/ui ./packages/ui

# Build the application with version
WORKDIR /app/packages/ui
ENV VITE_APP_VERSION=${APP_VERSION}
RUN npm run build

# Production stage
FROM nginx:alpine AS production

# Accept version as build argument and set as environment variable
ARG APP_VERSION=latest
ENV APP_VERSION=${APP_VERSION}

# Copy built application
COPY --from=builder /app/packages/ui/dist /usr/share/nginx/html

# Copy nginx configuration
COPY packages/ui/nginx.conf /etc/nginx/conf.d/default.conf

# Copy and set up entrypoint script
COPY packages/ui/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Create nginx user and set permissions
RUN chown -R nginx:nginx /usr/share/nginx/html

EXPOSE 3000

# Use custom entrypoint
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
CMD curl -f http://localhost:3000/ || exit 1

# Use custom entrypoint
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
