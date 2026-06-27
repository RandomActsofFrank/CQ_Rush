#!/bin/bash
# Install CQ Rush Pi Display files onto a running Raspberry Pi OS device.
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root: sudo $0"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PI_DISPLAY_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TARGET="/opt/cqrush-display"

echo "==> Installing CQ Rush Display to $TARGET"
install -d "$TARGET"
rsync -a --delete \
  "$PI_DISPLAY_ROOT/opt/cqrush-display/" \
  "$TARGET/"

chmod 755 "$TARGET"/*.sh
chmod 644 "$TARGET/setup_server.py"

install -d /etc/cqrush-display
if [ ! -f /etc/cqrush-display/config.json ]; then
  install -m 644 "$PI_DISPLAY_ROOT/config/config.example.json" /etc/cqrush-display/config.json
fi

install -d /etc/X11/xinit
install -m 755 "$PI_DISPLAY_ROOT/overlay/etc/X11/xinit/xinitrc" /etc/X11/xinit/xinitrc

install -d /etc/systemd/system
install -m 644 "$PI_DISPLAY_ROOT/systemd/cqrush-display.service" /etc/systemd/system/
install -m 644 "$PI_DISPLAY_ROOT/systemd/cqrush-display-x.service" /etc/systemd/system/

echo "==> Installing packages (this may take a few minutes)"
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y \
  network-manager \
  python3-flask \
  chromium \
  xserver-xorg \
  x11-xserver-utils \
  xinit \
  openbox \
  unclutter \
  rsync

echo "==> Enabling services"
systemctl daemon-reload
systemctl enable cqrush-display-x.service
systemctl enable cqrush-display.service

echo ""
echo "============================================"
echo " CQ Rush Pi Display installed"
echo ""
echo " Reboot to start setup hotspot:"
echo "   SSID: CQ-Rush-Display"
echo "   Password: cqrush-setup"
echo "   Setup page: http://10.42.0.1:8080"
echo ""
echo " To re-enter setup later:"
echo "   sudo touch /boot/firmware/cqrush-display-setup"
echo "   sudo reboot"
echo "============================================"
