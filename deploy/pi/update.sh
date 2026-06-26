#!/bin/bash
# Pull latest code and rebuild on the Raspberry Pi
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="$SCRIPT_DIR/.env.production"
COMPOSE_FILE="$PROJECT_ROOT/docker-compose.prod.yml"

cd "$PROJECT_ROOT"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing $ENV_FILE — run ./deploy/pi/setup.sh first."
  exit 1
fi

if [ -d .git ]; then
  echo "==> Pulling latest changes..."
  git pull --ff-only
fi

mkdir -p "$PROJECT_ROOT/deploy/aws"
ln -sf ../pi/.env.production "$PROJECT_ROOT/deploy/aws/.env.production"

echo "==> Rebuilding and restarting containers..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --build

echo ""
echo "Update complete."
grep '^APP_URL=' "$ENV_FILE" || true
