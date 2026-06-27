#!/bin/bash
# pi-gen stage config for CQ Rush Display image.
set -euo pipefail

# Keep stage2 base image and append display layer.
if [ -f "${STAGE_DIR}/SKIP_IMAGES" ]; then
  rm -f "${STAGE_DIR}/SKIP_IMAGES"
fi
