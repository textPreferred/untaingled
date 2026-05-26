#!/bin/sh
set -e

DATABASE_URL="postgresql://postgres:postgres@localhost:5432/untaingled"
BASIC_AUTH_USER="test"
BASIC_AUTH_PASSWORD="test"
CONTAINER="pg-e2e"

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

export DATABASE_URL BASIC_AUTH_USER BASIC_AUTH_PASSWORD
playwright test "$@" || true

docker stop "$CONTAINER"
docker rm "$CONTAINER"
