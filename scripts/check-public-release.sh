#!/usr/bin/env bash
# Regression check: fail if personal deployment details appear in tracked project files.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Patterns that must not appear in public documentation or source (case-insensitive where noted)
FORBIDDEN=(
  'cqrush\.kostyun'
  '18\.226\.81'
  '982005835358'
  'i-0311ae8f'
  '/etc/ssl/'
  'ssls\.com'
  'hamlog-app-key\.pem ec2-user@'
)

# File globs to scan (exclude gitignored secrets and dependencies)
SCAN_PATHS=(
  '*.md'
  '*.json'
  '*.js'
  '*.html'
  '*.sh'
  '*.yml'
  '*.example'
  'LICENSE'
  'CHANGELOG.md'
)

EXCLUDES=(
  '--glob' '!node_modules/**'
  '--glob' '!client/build/**'
  '--glob' '!**/package-lock.json'
  '--glob' '!scripts/check-public-release.sh'
  '--glob' '!deploy/aws/.env.production'
  '--glob' '!deploy/aws/.aws-deploy-state'
)

fail=0

echo "==> Scanning for personal deployment identifiers..."

for pattern in "${FORBIDDEN[@]}"; do
  matches="$(rg -i -n "$pattern" "${EXCLUDES[@]}" "${SCAN_PATHS[@]}" . 2>/dev/null || true)"
  if [ -n "$matches" ]; then
    echo ""
    echo "FAIL: forbidden pattern /${pattern}/ found:"
    echo "$matches"
    fail=1
  fi
done

# Ensure gitignored secret files are not tracked
for secret in deploy/aws/.env.production deploy/aws/.aws-deploy-state; do
  if git ls-files --error-unmatch "$secret" >/dev/null 2>&1; then
    echo ""
    echo "FAIL: secret file is tracked by git: $secret"
    fail=1
  fi
done

if [ "$fail" -ne 0 ]; then
  echo ""
  echo "Public release check failed."
  exit 1
fi

echo "OK — no personal AWS/SSL deployment identifiers found in scanned files."
exit 0
