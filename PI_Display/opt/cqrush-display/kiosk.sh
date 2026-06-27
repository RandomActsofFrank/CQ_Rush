#!/bin/bash
# Launch Chromium in kiosk mode for the configured CQ Rush display URL.
set -euo pipefail

CONFIG_FILE="${CQRUSH_DISPLAY_CONFIG:-/etc/cqrush-display/config.json}"
export DISPLAY="${DISPLAY:-:0}"

if [ ! -f "$CONFIG_FILE" ]; then
  echo "Missing config: $CONFIG_FILE" >&2
  exit 1
fi

DISPLAY_URL="$(CONFIG_FILE="$CONFIG_FILE" python3 - <<'PY'
import json, os, sys
path = os.environ["CONFIG_FILE"]
with open(path, encoding="utf-8") as fh:
    cfg = json.load(fh)
url = (cfg.get("display_url") or "").strip()
if not url:
    sys.exit(1)
print(url)
PY
)" || {
  echo "display_url not configured" >&2
  exit 1
}

# Wait for network before loading remote display pages.
for _ in $(seq 1 30); do
  if nmcli -t -f CONNECTIVITY g >/dev/null 2>&1; then
    state="$(nmcli -t -f CONNECTIVITY g 2>/dev/null | head -n1)"
    if [ "$state" = "full" ] || [ "$state" = "limited" ]; then
      break
    fi
  fi
  sleep 2
done

CHROMIUM=""
for candidate in chromium-browser chromium google-chrome; do
  if command -v "$candidate" >/dev/null 2>&1; then
    CHROMIUM="$candidate"
    break
  fi
done

if [ -z "$CHROMIUM" ]; then
  echo "Chromium not installed" >&2
  exit 1
fi

exec "$CHROMIUM" \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --disable-translate \
  --check-for-update-interval=31536000 \
  --disk-cache-dir=/tmp/chromium-cache \
  "$DISPLAY_URL"
