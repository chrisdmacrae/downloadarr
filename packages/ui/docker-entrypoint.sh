#!/bin/sh

# Docker entrypoint script for Downloadarr frontend
# This script generates runtime configuration based on environment variables

set -e

# Default values
API_URL="${VITE_API_URL:-/api}"

# Generate runtime configuration
cat > /usr/share/nginx/html/runtime-config.js << EOF
// Runtime configuration for Downloadarr frontend
// Generated at container startup

(function() {
  window.__RUNTIME_CONFIG__ = {
    apiUrl: '${API_URL}'
  };
})();
EOF

echo "Generated runtime configuration:"
echo "  API_URL: ${API_URL}"

# Start nginx
exec "$@"
