#!/bin/bash
# Sync code to EC2 and run docker compose production build
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
STATE_FILE="$SCRIPT_DIR/.aws-deploy-state"

if [ ! -f "$STATE_FILE" ]; then
  echo "No deployment state found. Run ./launch.sh first."
  exit 1
fi

# shellcheck source=/dev/null
source "$STATE_FILE"

SSH_OPTS=(-i "$KEY_PATH" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10)
REMOTE="ec2-user@${PUBLIC_IP}"
REMOTE_DIR="/opt/hamlog-app"

echo "==> Waiting for SSH on $PUBLIC_IP..."
for i in $(seq 1 30); do
  if ssh "${SSH_OPTS[@]}" "$REMOTE" "echo ok" 2>/dev/null; then
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "SSH not ready. Bootstrap may still be running — try again in a few minutes."
    exit 1
  fi
  sleep 10
done

echo "==> Waiting for Docker..."
ssh "${SSH_OPTS[@]}" "$REMOTE" 'until docker info >/dev/null 2>&1; do sleep 5; done'

echo "==> Syncing application files..."
rsync -az --delete \
  --exclude node_modules \
  --exclude client/node_modules \
  --exclude server/node_modules \
  --exclude client/build \
  --exclude .git \
  --exclude deploy/aws/.env.production \
  -e "ssh -i ${KEY_PATH} -o StrictHostKeyChecking=accept-new" \
  "$PROJECT_ROOT/" "$REMOTE:$REMOTE_DIR/"

echo "==> Copying production environment..."
scp "${SSH_OPTS[@]}" "$SCRIPT_DIR/.env.production" "$REMOTE:$REMOTE_DIR/deploy/aws/.env.production"

# Update APP_URL with public IP if not set
ssh "${SSH_OPTS[@]}" "$REMOTE" "grep -q '^APP_URL=$' $REMOTE_DIR/deploy/aws/.env.production && \
  sed -i 's|^APP_URL=.*|APP_URL=http://${PUBLIC_IP}:3002|' $REMOTE_DIR/deploy/aws/.env.production || true"

echo "==> Building and starting containers (first run takes several minutes)..."
ssh "${SSH_OPTS[@]}" "$REMOTE" "cd $REMOTE_DIR && docker compose -f docker-compose.prod.yml --env-file deploy/aws/.env.production down 2>/dev/null || true"
ssh "${SSH_OPTS[@]}" "$REMOTE" "cd $REMOTE_DIR && docker compose -f docker-compose.prod.yml --env-file deploy/aws/.env.production up -d --build"

echo ""
echo "============================================"
echo " Deploy complete!"
echo " URL:  http://${PUBLIC_IP}:3002"
echo " Auth: configure in Admin → Security & Branding (no default password)"
echo " Reset: ./reset-passwords.sh --help"
echo "============================================"
echo ""
echo "Useful commands:"
echo "  ssh -i $KEY_PATH $REMOTE"
echo "  ssh ... 'cd /opt/hamlog-app && docker compose -f docker-compose.prod.yml logs -f app'"
