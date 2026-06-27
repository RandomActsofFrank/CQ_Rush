#!/bin/bash
# pi-gen stage: install CQ Rush Display packages and enable services.
set -euo pipefail

on_chroot << 'EOF'
set -euo pipefail
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

systemctl enable cqrush-display-x.service
systemctl enable cqrush-display.service
EOF
