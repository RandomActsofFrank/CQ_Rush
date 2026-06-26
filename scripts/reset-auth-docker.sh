#!/bin/bash
# Reset site/admin passwords on the server (run after SSH into EC2).
# Usage from /opt/hamlog-app:
#   ./scripts/reset-auth-docker.sh --show
#   ./scripts/reset-auth-docker.sh --clear-all
#   ./scripts/reset-auth-docker.sh --set-admin-password "NewPass"
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE="${ENV_FILE:-deploy/aws/.env.production}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing env file: $ENV_FILE"
  echo "Set ENV_FILE if your production env lives elsewhere."
  exit 1
fi

if [ $# -eq 0 ]; then
  echo "Pass arguments to reset-auth.js, e.g.:"
  echo "  ./scripts/reset-auth-docker.sh --show"
  echo "  ./scripts/reset-auth-docker.sh --clear-all"
  echo "  ./scripts/reset-auth-docker.sh --set-site-password \"SitePass\""
  echo "  ./scripts/reset-auth-docker.sh --set-admin-password \"AdminPass\""
  exit 1
fi

docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T app node scripts/reset-auth.js "$@"
