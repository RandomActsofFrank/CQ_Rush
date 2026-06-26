#!/bin/bash
# Run auth reset commands on the EC2 server via Docker.
# Usage (from your laptop, in deploy/aws):
#   ./reset-passwords.sh --show
#   ./reset-passwords.sh --clear-all
#   ./reset-passwords.sh --set-site-password "NewPass"
#   ./reset-passwords.sh --set-admin-password "AdminPass"
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATE_FILE="$SCRIPT_DIR/.aws-deploy-state"

if [ ! -f "$STATE_FILE" ]; then
  echo "No deployment state found. Run ./launch.sh first, or SSH manually."
  exit 1
fi

# shellcheck source=/dev/null
source "$STATE_FILE"

SSH_OPTS=(-i "$KEY_PATH" -o StrictHostKeyChecking=accept-new)
REMOTE="ec2-user@${PUBLIC_IP}"
REMOTE_DIR="/opt/hamlog-app"

if [ $# -eq 0 ]; then
  echo "Pass arguments to reset-auth.js, e.g.:"
  echo "  ./reset-passwords.sh --show"
  echo "  ./reset-passwords.sh --clear-all"
  echo "  ./reset-passwords.sh --set-admin-password \"YourPassword\""
  exit 1
fi

# Escape args for remote shell
REMOTE_ARGS=""
for arg in "$@"; do
  REMOTE_ARGS+=" $(printf '%q' "$arg")"
done

ssh "${SSH_OPTS[@]}" "$REMOTE" \
  "cd $REMOTE_DIR && docker compose -f docker-compose.prod.yml --env-file deploy/aws/.env.production exec -T app node scripts/reset-auth.js${REMOTE_ARGS}"
