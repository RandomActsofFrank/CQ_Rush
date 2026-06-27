#!/bin/bash
# Build a flashable Raspberry Pi image for CQ Rush Display (Pi Zero / Zero 2 W / Zero W).
#
# Raspberry Pi boards boot from .img SD card images, not PC-style ISO files.
# This script outputs: PI_Display/build/cqrush-display-pi.img
#
# Requirements: Debian/Ubuntu Linux, sudo, ~20 GB free disk, git, coreutils.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="$SCRIPT_DIR/build"
WORK_DIR="$SCRIPT_DIR/.work"
PI_GEN_DIR="${PI_GEN_DIR:-$WORK_DIR/pi-gen}"
PI_GEN_REPO="${PI_GEN_REPO:-https://github.com/RPi-Distro/pi-gen.git}"
PI_GEN_BRANCH="${PI_GEN_BRANCH:-master}"
STAGE_SOURCE="$SCRIPT_DIR/pi-gen-stage"
IMAGE_NAME="${IMAGE_NAME:-cqrush-display-pi}"

if [ "$(uname -s)" != "Linux" ]; then
  echo "Pi image builds require Linux (Debian/Ubuntu VM or CI host)."
  echo "On macOS, use a Linux VM or GitHub Actions, or flash Raspberry Pi OS Lite"
  echo "and run: sudo PI_Display/install-on-device.sh"
  exit 1
fi

if [ "$(id -u)" -ne 0 ] && ! sudo -n true 2>/dev/null; then
  echo "This script needs sudo to run pi-gen (debootstrap/chroot)."
  exit 1
fi

run_root() {
  if [ "$(id -u)" -eq 0 ]; then
    "$@"
  else
    sudo "$@"
  fi
}

echo "==> Preparing build directories"
mkdir -p "$BUILD_DIR" "$WORK_DIR"

if [ ! -d "$PI_GEN_DIR/.git" ]; then
  echo "==> Cloning pi-gen"
  git clone --depth 1 --branch "$PI_GEN_BRANCH" "$PI_GEN_REPO" "$PI_GEN_DIR"
fi

echo "==> Syncing custom pi-gen stage"
"$SCRIPT_DIR/sync-pi-gen-files.sh"
STAGE_TARGET="$PI_GEN_DIR/stage-cqrush-display"
rm -rf "$STAGE_TARGET"
mkdir -p "$STAGE_TARGET/files"
cp -a "$SCRIPT_DIR/pi-gen-stage/00-config.sh" "$SCRIPT_DIR/pi-gen-stage/02-run.sh" "$STAGE_TARGET/"
cp -a "$SCRIPT_DIR/pi-gen-stage/files/." "$STAGE_TARGET/files/"
chmod +x "$STAGE_TARGET/"*.sh

echo "==> Configuring pi-gen"
cat > "$PI_GEN_DIR/config" <<EOF
IMG_NAME="${IMAGE_NAME}"
ENABLE_SSH=1
STAGE_LIST="stage0 stage1 stage2 stage-cqrush-display"
USE_QCOW2=0
USE_QEMU=0
EOF

if [ -f "$PI_GEN_DIR/stage2/SKIP_IMAGES" ]; then
  rm -f "$PI_GEN_DIR/stage2/SKIP_IMAGES"
fi
if [ -f "$PI_GEN_DIR/stage-cqrush-display/SKIP_IMAGES" ]; then
  rm -f "$PI_GEN_DIR/stage-cqrush-display/SKIP_IMAGES"
fi

echo "==> Building image (this can take 30–90 minutes on first run)"
run_root bash -lc "cd '$PI_GEN_DIR' && ./build.sh"

BUILT_IMG="$(find "$PI_GEN_DIR/deploy" -maxdepth 1 -type f -name '*.img' | sort | tail -n1)"
if [ -z "$BUILT_IMG" ] || [ ! -f "$BUILT_IMG" ]; then
  echo "Build finished but no .img was found in $PI_GEN_DIR/deploy" >&2
  exit 1
fi

OUTPUT_IMG="$BUILD_DIR/${IMAGE_NAME}.img"
cp -f "$BUILT_IMG" "$OUTPUT_IMG"

if command -v xz >/dev/null 2>&1; then
  echo "==> Compressing image"
  xz -z -f -k "$OUTPUT_IMG"
fi

echo ""
echo "============================================"
echo " Build complete"
echo " Image:  $OUTPUT_IMG"
if [ -f "${OUTPUT_IMG}.xz" ]; then
  echo " Compressed: ${OUTPUT_IMG}.xz"
fi
echo ""
echo " Flash with Raspberry Pi Imager or:"
echo "   sudo dd if=$OUTPUT_IMG of=/dev/sdX bs=4M status=progress conv=fsync"
echo ""
echo " First boot:"
echo "   1. Connect to Wi‑Fi hotspot CQ-Rush-Display (password cqrush-setup)"
echo "   2. Open http://10.42.0.1:8080"
echo "   3. Scan Wi‑Fi, enter display URL (/display page), save"
echo "============================================"
