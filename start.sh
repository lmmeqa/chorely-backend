#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   DATABASE_URL=postgres://app:devpass@localhost:5432/appdb ./start.sh
#   RUN_SEED=1 ./start.sh    # also runs seed script

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export NODE_OPTIONS="--enable-source-maps"

: "${DATABASE_URL:=postgres://app:devpass@localhost:5432/appdb}"
: "${RUN_SEED:=0}"

echo "→ Applying Drizzle migrations to $DATABASE_URL"
npx drizzle-kit migrate

if [[ "$RUN_SEED" == "1" ]]; then
  echo "→ Seeding database"
  node --loader tsx "$ROOT_DIR/scripts/seed.ts"
fi

echo "✓ DB ready"
