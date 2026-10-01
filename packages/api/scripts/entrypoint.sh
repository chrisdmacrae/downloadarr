#!/bin/sh
# Runs as root, to do what the app can't once it is `node`: make the folders
# it writes to its own. Then it hands over to start.sh, which
# waits for the database and applies migrations before the app boots.
set -e

# Map the container user onto the host's PUID/PGID.
PUID=${PUID:-1000}
PGID=${PGID:-1000}
groupmod -o -g "$PGID" node
usermod -o -u "$PUID" node

# The download and library roots are created and chowned here, using the paths
# the app will actually read from its env: the app runs as `node` and cannot
# create directories at the filesystem root. Only the roots are chowned:
# recursing into a large mounted library would add seconds to every start.
for dir in "${DOWNLOAD_PATH:-/downloads}" "${LIBRARY_PATH:-/library}" /app/vpn; do
  mkdir -p "$dir" 2>/dev/null || true
  chown node:node "$dir" 2>/dev/null || true
done

exec su-exec node /start.sh "$@"
