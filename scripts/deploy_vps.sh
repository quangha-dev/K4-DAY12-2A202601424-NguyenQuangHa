#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/opt/k4-day12}"
VPS_ENV_FILE="${VPS_ENV_FILE:-/opt/k4-day12-secrets/app.env}"
COMPOSE_FILE="${APP_DIR}/docker-compose.vps.yml"
DEPLOY_SHA="${DEPLOY_SHA:-$(git -C "${APP_DIR}" rev-parse HEAD)}"
IMAGE_TAG="${DEPLOY_SHA:0:12}"
export APP_DIR VPS_ENV_FILE IMAGE_TAG

if [[ ! -f "${COMPOSE_FILE}" ]]; then
  echo "Missing compose file: ${COMPOSE_FILE}" >&2
  exit 1
fi

if [[ ! -f "${VPS_ENV_FILE}" ]]; then
  echo "Missing environment file: ${VPS_ENV_FILE}" >&2
  exit 1
fi

cd "${APP_DIR}"

previous_image="$(docker inspect day12-chat --format '{{.Config.Image}}' 2>/dev/null || true)"

echo "Building Day12 image for commit ${DEPLOY_SHA}"
docker compose --env-file "${VPS_ENV_FILE}" -f "${COMPOSE_FILE}" build --pull chat
docker compose --env-file "${VPS_ENV_FILE}" -f "${COMPOSE_FILE}" up -d --remove-orphans

healthy=false
for attempt in $(seq 1 30); do
  if curl --fail --silent --show-error http://127.0.0.1:8000/healthz >/dev/null; then
    healthy=true
    break
  fi
  echo "Waiting for Day12 health check (${attempt}/30)"
  sleep 2
done

if [[ "${healthy}" != "true" ]]; then
  echo "New deployment failed its health check" >&2
  docker compose --env-file "${VPS_ENV_FILE}" -f "${COMPOSE_FILE}" logs --tail=100 chat >&2 || true

  if [[ "${previous_image}" == day12-chat:* ]] && docker image inspect "${previous_image}" >/dev/null 2>&1; then
    echo "Rolling back to ${previous_image}" >&2
    export IMAGE_TAG="${previous_image#day12-chat:}"
    docker compose --env-file "${VPS_ENV_FILE}" -f "${COMPOSE_FILE}" up -d --no-build chat
  fi
  exit 1
fi

docker compose --env-file "${VPS_ENV_FILE}" -f "${COMPOSE_FILE}" ps
echo "Day12 deployment is healthy at commit ${DEPLOY_SHA}"
