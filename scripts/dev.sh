#!/bin/sh
set -e

WATCH_FLAG=""
if [ "$1" = "--watch" ]; then
  WATCH_FLAG="--watch"
fi

CONTAINER="pg-dev"

if [ -z "$DATABASE_URL" ]; then
  if ! docker inspect "$CONTAINER" --format '{{.State.Running}}' 2>/dev/null | grep -q true; then
    docker rm -f "$CONTAINER" 2>/dev/null || true
    docker run -d --name "$CONTAINER" \
      -e POSTGRES_PASSWORD=postgres \
      -e POSTGRES_DB=untaingled \
      -p 5432:5432 \
      --health-cmd pg_isready \
      --health-interval 2s \
      --health-retries 10 \
      docker.io/library/postgres:17

    until docker inspect "$CONTAINER" --format '{{.State.Health.Status}}' | grep -q healthy; do
      sleep 1
    done
  fi
fi

set -a
# shellcheck disable=SC1091
[ -f .env ] && . ./.env
set +a

if [ -n "$WATCH_FLAG" ]; then
  bun x vite build --watch &
  VITE_PID=$!
  trap 'kill $VITE_PID 2>/dev/null || true' EXIT INT TERM
fi

bun $WATCH_FLAG --preload ./src/instrumentation.ts ./src/index.ts
