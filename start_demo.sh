set -e

KNEX="npx knex --knexfile ./src/db/config/knexfile.ts"
DB_HOST=${DB_HOST:-db}
DB_PORT=${DB_PORT:-5432}
DB_USER=${DB_USER:-postgres}
DB_PASSWORD=${DB_PASSWORD:-password}
DB_NAME=${DB_NAME:-chorely}

wait_for_pg() {
  echo "⏳  Waiting for Postgres (db:5432)…"
  until pg_isready -h db -p 5432 -U postgres >/dev/null 2>&1; do
    sleep 1
  done
}

run_migrations() {
  echo "🔓  Unlocking migrations…"
  $KNEX migrate:unlock || true
  echo "🧽  Forcing clean migration state (dropping knex tables if present)…"
  export PGPASSWORD="$DB_PASSWORD"
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=0 -c "DROP TABLE IF EXISTS knex_migrations_lock;" >/dev/null 2>&1 || true
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=0 -c "DROP TABLE IF EXISTS knex_migrations;" >/dev/null 2>&1 || true
  
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
