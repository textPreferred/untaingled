#!/bin/sh
set -e

CONTAINER="pg-dev"

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

set -a
# shellcheck disable=SC1091
[ -f .env ] && . ./.env
set +a

bun src/index.ts
