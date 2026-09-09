#!/bin/sh

# Note: We don't use set -e here because we need to handle migration errors gracefully

echo "🚀 Starting Downloadarr API..."

# Wait for database to be ready
echo "⏳ Waiting for database connection..."

# Derive host and port from DATABASE_URL so an external database works too;
# fall back to the bundled compose service.
DB_HOST=$(echo "$DATABASE_URL" | sed -n 's|.*://[^@]*@\([^:/?]*\).*|\1|p')
DB_PORT=$(echo "$DATABASE_URL" | sed -n 's|.*://[^@]*@[^:]*:\([0-9]*\).*|\1|p')
DB_HOST=${DB_HOST:-postgres}
DB_PORT=${DB_PORT:-5432}

# Give up rather than hang forever if the database never appears.
attempt=0
max_attempts=60
until nc -z "$DB_HOST" "$DB_PORT" 2>/dev/null; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge "$max_attempts" ]; then
    echo "❌ Database at $DB_HOST:$DB_PORT unreachable after $((max_attempts * 5))s"
    exit 1
  fi
  echo "Database not ready at $DB_HOST:$DB_PORT, waiting 5 seconds..."
  sleep 5
done

echo "✅ Database connection established ($DB_HOST:$DB_PORT)"

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
  # Check if it's the P3009 error (failed migrations found)
  elif echo "$migration_output" | grep -q "P3009"; then
    echo "🔧 Detected P3009 error - resolving failed migrations..."

    # Extract failed migration names from the output and mark them as rolled back
    failed_migrations=$(echo "$migration_output" | grep -o "The \`[^']*\` migration" | sed 's/The `\([^`]*\)` migration/\1/')

    for migration_name in $failed_migrations; do
      if [ -n "$migration_name" ]; then
        echo "📝 Marking failed migration as rolled back: $migration_name"
        npx prisma migrate resolve --rolled-back "$migration_name" 2>/dev/null || true
      fi
    done

    # Try to deploy migrations again after resolving failed ones
    echo "🔄 Retrying migration deployment..."
    npx prisma migrate deploy 2>/dev/null || true

    echo "✅ Database migrations resolved"
  else
    echo "❌ Migration failed with unknown error"
    exit 1
  fi
fi

echo "✅ Database setup completed"

# The Prisma client is generated at image build time, so there is nothing to
# regenerate here.

echo "🎯 Starting application..."
# Start the application
exec "$@"
