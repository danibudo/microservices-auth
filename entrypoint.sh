#!/bin/sh
set -e

echo "Running database migrations..."
npm run migrate:prod

echo "Starting auth service..."
exec node dist/index.js