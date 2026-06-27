#!/bin/bash
# Sync runtime files into pi-gen stage before image build.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FILES_DIR="$SCRIPT_DIR/pi-gen-stage/files"

rm -rf "$FILES_DIR"
mkdir -p "$FILES_DIR/opt/cqrush-display" "$FILES_DIR/etc/cqrush-display" "$FILES_DIR/etc/systemd/system" "$FILES_DIR/etc/X11/xinit"

rsync -a "$SCRIPT_DIR/opt/cqrush-display/" "$FILES_DIR/opt/cqrush-display/"
install -m 644 "$SCRIPT_DIR/config/config.example.json" "$FILES_DIR/etc/cqrush-display/config.json"
install -m 644 "$SCRIPT_DIR/systemd/cqrush-display.service" "$FILES_DIR/etc/systemd/system/"
install -m 644 "$SCRIPT_DIR/systemd/cqrush-display-x.service" "$FILES_DIR/etc/systemd/system/"
install -m 755 "$SCRIPT_DIR/overlay/etc/X11/xinit/xinitrc" "$FILES_DIR/etc/X11/xinit/xinitrc"

echo "Synced pi-gen stage files to $FILES_DIR"
