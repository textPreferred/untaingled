#!/bin/sh
set -e

DATABASE_URL="postgresql://postgres:postgres@localhost:5432/untaingled"
CONTAINER="pg-dev"

if ! docker inspect "$CONTAINER" > /dev/null 2>&1; then
  docker run -d --name "$CONTAINER" \
    -e POSTGRES_PASSWORD=postgres \
    -e POSTGRES_DB=untaingled \
    -p 5432:5432 \
    --health-cmd pg_isready \
    --health-interval 2s \
    --health-retries 10 \
    postgres:17

  until docker inspect "$CONTAINER" --format '{{.State.Health.Status}}' | grep -q healthy; do
    sleep 1
  done
fi

export DATABASE_URL
bun src/index.ts
