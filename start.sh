#!/bin/sh
set -e

KNEX="npx knex --knexfile ./src/db/config/knexfile"  # plain JS file

echo "⏳  Waiting for Postgres (db:5432)…"
until pg_isready -h db -p 5432 -U postgres >/dev/null 2>&1; do
  sleep 1
done

echo "🔓  Unlocking…"
$KNEX migrate:unlock || true

echo "🧹  Rolling back & re-seeding (dev)…"
$KNEX migrate:rollback --all
$KNEX migrate:latest
$KNEX seed:run

echo "🚀  Starting backend (ts-node-dev)…"
exec npx ts-node-dev --respawn --transpile-only src/index
