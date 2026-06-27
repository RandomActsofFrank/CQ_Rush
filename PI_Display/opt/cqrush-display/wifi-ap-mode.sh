#!/bin/bash
# Start Wi‑Fi hotspot for initial CQ Rush Display setup.
set -euo pipefail

AP_SSID="${CQRUSH_DISPLAY_AP_SSID:-CQ-Rush-Display}"
AP_PASSWORD="${CQRUSH_DISPLAY_AP_PASSWORD:-cqrush-setup}"
WIFI_IFACE="${CQRUSH_WIFI_IFACE:-wlan0}"

if ! command -v nmcli >/dev/null 2>&1; then
  echo "NetworkManager (nmcli) is required" >&2
  exit 1
fi

nmcli radio wifi on || true
nmcli dev set "$WIFI_IFACE" managed yes || true

if nmcli -t -f NAME con show | grep -qx "cqrush-display-hotspot"; then
  nmcli con down "cqrush-display-hotspot" >/dev/null 2>&1 || true
  nmcli con delete "cqrush-display-hotspot" >/dev/null 2>&1 || true
fi

nmcli dev disconnect "$WIFI_IFACE" >/dev/null 2>&1 || true

if ! nmcli dev wifi hotspot ifname "$WIFI_IFACE" ssid "$AP_SSID" password "$AP_PASSWORD"; then
  echo "Failed to start hotspot on $WIFI_IFACE" >&2
  exit 1
fi

nmcli con modify Hotspot connection.id cqrush-display-hotspot
nmcli con modify cqrush-display-hotspot connection.autoconnect no

echo "Hotspot active: SSID=$AP_SSID"
