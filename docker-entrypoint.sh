#!/bin/sh
set -e

# Run database migrations if we are launching the web service or explicitly requested
if [ "$RUN_MIGRATIONS" = "true" ]; then
  echo "Running database migrations..."
  pnpm db:migrate
fi

exec "$@"
