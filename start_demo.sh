set -e

KNEX="npx knex --knexfile ./src/db/config/knexfile.ts"

wait_for_pg() {
  echo "⏳  Waiting for Postgres (db:5432)…"
  until pg_isready -h db -p 5432 -U postgres >/dev/null 2>&1; do
    sleep 1
  done
}

run_migrations() {
  echo "🔓  Unlocking migrations…"
  $KNEX migrate:unlock || true
  
  echo "🧹  Rolling back all migrations (demo reset)…"
  $KNEX migrate:rollback --all || true
  
  echo "🗑️  Clearing any remaining data…"
  PGPASSWORD=password psql -h db -U postgres -d chorely -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" || true
  
  echo "🔄  Running migrations…"
  $KNEX migrate:latest
}

seed_if_empty() {
  echo "🌱  Running seeds…"
  $KNEX seed:run
}

start_node() {
  echo "🚀  Starting backend (compiled JS)…"
  exec node dist/index.js
}

wait_for_pg
run_migrations
seed_if_empty
start_node
