#!/bin/sh
# ------------------------------------------------------------------
#  start.sh   – runtime entry for production/demo container
#               1. wait for Postgres
#               2. run migrations (idempotent)
#               3. optional seed on first boot
#               4. launch compiled Node app
# ------------------------------------------------------------------
set -e

KNEX="npx knex --knexfile ./src/db/config/knexfile.js"

wait_for_pg() {
  echo "⏳  Waiting for Postgres (db:5432)…"
  until pg_isready -h db -p 5432 -U postgres >/dev/null 2>&1; do
    sleep 1
  done
}

run_migrations() {
  echo "🔄  Running migrations…"
  $KNEX migrate:latest
}

seed_if_empty() {
  # seed only when the chores table is empty (clean DB)
  ROWS=$(psql "$DATABASE_URL" -Atc "SELECT COUNT(*) FROM chores" || echo 0)
  if [ "$ROWS" -eq 0 ]; then
    echo "🌱  Running seeds (empty DB detected)…"
    $KNEX seed:run
  fi
}

start_node() {
  echo "🚀  Starting backend (compiled JS)…"
  exec node dist/index.js
}

wait_for_pg
run_migrations
seed_if_empty
start_node
