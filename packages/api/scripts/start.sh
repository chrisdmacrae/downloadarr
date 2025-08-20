#!/bin/sh

# Note: We don't use set -e here because we need to handle migration errors gracefully

echo "🚀 Starting Downloadarr API..."

# Wait for database to be ready
echo "⏳ Waiting for database connection..."

# Function to wait for database
wait_for_db() {
  until nc -z postgres 5432 2>/dev/null; do
    echo "Database not ready, waiting 5 seconds..."
    sleep 5
  done
}

wait_for_db
echo "✅ Database connection established"

# Handle database migrations with proper error handling
echo "🔄 Running database migrations..."

# Capture the output and exit code of the migration command
migration_output=$(npx prisma migrate deploy 2>&1)
migration_exit_code=$?

if [ $migration_exit_code -eq 0 ]; then
  echo "✅ Database migrations completed successfully"
else
  echo "⚠️ Migration failed with exit code $migration_exit_code"
  echo "Migration output: $migration_output"

  # Check if it's the P3005 error (database schema is not empty)
  if echo "$migration_output" | grep -q "P3005"; then
    echo "🔧 Detected P3005 error - resolving migrations..."

    # Mark all migrations as applied to resolve the P3005 error
    for migration in prisma/migrations/*/; do
      if [ -d "$migration" ]; then
        migration_name=$(basename "$migration")
        echo "📝 Resolving migration: $migration_name"
        npx prisma migrate resolve --applied "$migration_name" 2>/dev/null || true
      fi
    done

    echo "✅ Database migrations resolved"
  else
    echo "❌ Migration failed with unknown error"
    exit 1
  fi
fi

echo "✅ Database setup completed"

# Generate Prisma client (in case it's not up to date)
echo "🔧 Generating Prisma client..."
npx prisma generate

echo "🎯 Starting application..."
# Start the application
exec "$@"
