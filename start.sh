#!/bin/sh
set -e

KNEX="npx knex --knexfile ./src/db/config/knexfile.ts"

echo "⏳  Waiting for Postgres (db:5432)…"
until nc -z db 5432; do
  sleep 1
done

echo "🔓  Unlocking…"
$KNEX migrate:unlock || true

echo "🔄  Migrating & seeding…"
$KNEX migrate:latest
$KNEX seed:run

echo "🚀  Starting backend…"
npm start