#!/bin/bash
# First-time setup on a Raspberry Pi (Docker Compose production stack)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="$SCRIPT_DIR/.env.production"
COMPOSE_FILE="$PROJECT_ROOT/docker-compose.prod.yml"

cd "$PROJECT_ROOT"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is not installed."
  echo "Install Docker on Raspberry Pi OS, then re-run this script:"
  echo "  curl -fsSL https://get.docker.com | sh"
  echo "  sudo usermod -aG docker \$USER"
  echo "Log out and back in so the docker group applies."
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose plugin is not available."
  echo "Install the compose plugin, then re-run this script."
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "==> Creating production environment..."
  POSTGRES_PASSWORD="$(openssl rand -hex 16)"
  SESSION_SECRET="$(openssl rand -hex 32)"
  LAN_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
  APP_URL="http://${LAN_IP:-localhost}:3002"

  cat > "$ENV_FILE" <<EOF
POSTGRES_USER=hamlog
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=hamlog

DATABASE_URL=postgresql://hamlog:${POSTGRES_PASSWORD}@db:5432/hamlog
SESSION_SECRET=${SESSION_SECRET}
NODE_ENV=production
PORT=3002
APP_URL=${APP_URL}
EOF
  chmod 600 "$ENV_FILE"
  echo "Wrote $ENV_FILE"
else
  echo "==> Using existing $ENV_FILE"
fi

mkdir -p "$PROJECT_ROOT/deploy/aws"
ln -sf ../pi/.env.production "$PROJECT_ROOT/deploy/aws/.env.production"

echo "==> Building and starting containers (first build on a Pi can take 20–40 minutes)..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --build

echo ""
echo "============================================"
echo " Setup complete!"
echo " URL:  $(grep '^APP_URL=' "$ENV_FILE" | cut -d= -f2-)"
echo " Public display: append /display to the URL above"
echo " Auth: configure in Admin → Security & Branding"
echo " Reset passwords: ENV_FILE=$ENV_FILE ./scripts/reset-auth-docker.sh --help"
echo "============================================"
