#!/usr/bin/env bash
set -euo pipefail

# Portable assertive smoke test for Chorely API
# Usage:
#   BASE_URL=http://localhost:8787 ./scripts/api_test.sh
#   BASE_URL=http://localhost:4000 SB_ACCESS_TOKEN=... ./scripts/api_test.sh

BASE_URL=${BASE_URL:-http://localhost:8787}
TOKEN_HEADER=()
if [[ -n "${SB_ACCESS_TOKEN:-}" ]]; then
  TOKEN_HEADER=( -H "Authorization: Bearer $SB_ACCESS_TOKEN" )
fi

expect_status() {
  local expected="$1"; shift
  local method="$1"; shift
  local url="$1"; shift
  local data="${1:-}"
  local body="" code
  local HDRS=()
  if [[ ${#TOKEN_HEADER[@]:-0} -gt 0 ]]; then
    HDRS=("${TOKEN_HEADER[@]}")
  fi
  if [[ -n "$data" ]]; then
    body=$(curl -sS -X "$method" -H 'Content-Type: application/json' ${HDRS[@]+"${HDRS[@]}"} -d "$data" "$BASE_URL$url" -w "\n%{http_code}")
  else
    body=$(curl -sS -X "$method" -H 'Content-Type: application/json' ${HDRS[@]+"${HDRS[@]}"} "$BASE_URL$url" -w "\n%{http_code}")
  fi
  code="${body##*$'\n'}"; body="${body%$'\n'*}"
  if [[ "$code" != "$expected" ]]; then
    echo "FAIL: $method $url expected $expected, got $code" >&2
    echo "Response: $body" >&2
    exit 1
  fi
  echo "$body"
}

require_jq() { command -v jq >/dev/null 2>&1 || { echo 'jq is required'; exit 1; }; }
require_jq

echo "→ Health check"
expect_status 200 GET /healthz >/dev/null

echo "→ Create home"
HOME_JSON=$(expect_status 201 POST /homes '{"name":"Smoke Home"}')
HOME_ID=$(jq -r '.id' <<<"$HOME_JSON")

if [[ -z "$HOME_ID" || "$HOME_ID" == null ]]; then
  echo "FAIL: missing home id" >&2; exit 1
fi

echo "→ Create backend user (201 or 409)"
USR_EMAIL="smoke.user@local.test"
USR_RES=$(curl -sS -X POST -H 'Content-Type: application/json' "$BASE_URL/user" -d "$(jq -nc --arg e "$USR_EMAIL" --arg h "$HOME_ID" '{email:$e, name:"Smoke", homeIds:[$h]}')" -w "\n%{http_code}")
USR_CODE="${USR_RES##*$'\n'}"; USR_BODY="${USR_RES%$'\n'*}"
if [[ "$USR_CODE" != "201" && "$USR_CODE" != "409" ]]; then
  echo "FAIL: POST /user expected 201 or 409, got $USR_CODE" >&2
  echo "Response: $USR_BODY" >&2
  exit 1
fi

if [[ "$USR_CODE" == "409" ]]; then
  echo "→ Join home (204)"
  expect_status 204 POST /user/join "$(jq -nc --arg e "$USR_EMAIL" --arg h "$HOME_ID" '{email:$e, homeId:$h}')" >/dev/null
fi

echo "→ Todos generate (200)"
expect_status 200 POST /todos/generate '{"choreName":"A","choreDescription":"B"}' >/dev/null

echo "✓ Smoke OK"
