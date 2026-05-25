#!/bin/sh
set -e

DATABASE_URL="postgresql://postgres:postgres@localhost:5432/untaingled"
CONTAINER="pg-e2e"

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

export DATABASE_URL
playwright test "$@" || true

docker stop "$CONTAINER"
docker rm "$CONTAINER"
