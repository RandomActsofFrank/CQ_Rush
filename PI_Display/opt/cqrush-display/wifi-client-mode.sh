#!/bin/bash
# Stop setup hotspot and restore client Wi‑Fi mode.
set -euo pipefail

WIFI_IFACE="${CQRUSH_WIFI_IFACE:-wlan0}"

if nmcli -t -f NAME con show | grep -qx "cqrush-display-hotspot"; then
  nmcli con down cqrush-display-hotspot >/dev/null 2>&1 || true
  nmcli con delete cqrush-display-hotspot >/dev/null 2>&1 || true
fi

nmcli dev disconnect "$WIFI_IFACE" >/dev/null 2>&1 || true
nmcli radio wifi on || true
