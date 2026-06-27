#!/bin/bash
# Decide whether to run setup AP portal or prepare display kiosk.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${CQRUSH_DISPLAY_CONFIG:-/etc/cqrush-display/config.json}"
BOOT_SETUP_FLAG="/boot/firmware/cqrush-display-setup"
LEGACY_BOOT_SETUP_FLAG="/boot/cqrush-display-setup"
SETUP_PORT="${CQRUSH_SETUP_PORT:-8080}"
READY_FILE="/run/cqrush-display-ready"

mkdir -p /etc/cqrush-display
rm -f "$READY_FILE"

force_setup=0
if [ -f "$BOOT_SETUP_FLAG" ] || [ -f "$LEGACY_BOOT_SETUP_FLAG" ]; then
  force_setup=1
  rm -f "$BOOT_SETUP_FLAG" "$LEGACY_BOOT_SETUP_FLAG"
  if [ -f "$CONFIG_FILE" ]; then
    CONFIG_FILE="$CONFIG_FILE" python3 - <<'PY'
import json, os
path = os.environ["CONFIG_FILE"]
with open(path, encoding="utf-8") as fh:
    cfg = json.load(fh)
cfg["setup_complete"] = False
with open(path, "w", encoding="utf-8") as fh:
    json.dump(cfg, fh, indent=2)
    fh.write("\n")
PY
  fi
fi

setup_complete=0
if [ -f "$CONFIG_FILE" ]; then
  setup_complete="$(CONFIG_FILE="$CONFIG_FILE" python3 - <<'PY'
import json, os
path = os.environ["CONFIG_FILE"]
try:
    with open(path, encoding="utf-8") as fh:
        cfg = json.load(fh)
    print(1 if cfg.get("setup_complete") else 0)
except Exception:
    print(0)
PY
)"
fi

if [ "$force_setup" -eq 1 ] || [ "$setup_complete" -eq 0 ]; then
  echo "Starting CQ Rush Display setup mode"
  "$SCRIPT_DIR/wifi-ap-mode.sh"
  export CQRUSH_SETUP_BIND=0.0.0.0
  export CQRUSH_SETUP_PORT="$SETUP_PORT"
  exec python3 "$SCRIPT_DIR/setup_server.py"
fi

echo "Starting CQ Rush Display kiosk mode"
"$SCRIPT_DIR/wifi-client-mode.sh" || true
touch "$READY_FILE"

while true; do
  sleep 3600
done
