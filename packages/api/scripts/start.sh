#!/bin/sh

# Exit on any error
set -e

echo "🚀 Starting Downloadarr API..."

# Wait for database to be ready
echo "⏳ Waiting for database connection..."
until npx prisma db push --accept-data-loss 2>/dev/null || npx prisma migrate deploy 2>/dev/null; do
  echo "Database not ready, waiting 5 seconds..."
  sleep 5
done

echo "✅ Database connection established"

# Run Prisma migrations
echo "🔄 Running database migrations..."
npx prisma migrate deploy

# Generate Prisma client (in case it's not up to date)
echo "🔧 Generating Prisma client..."
npx prisma generate

echo "🎯 Starting application..."
# Start the application
exec "$@"
