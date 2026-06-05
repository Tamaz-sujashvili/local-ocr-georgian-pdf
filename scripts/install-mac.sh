#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/dist/mac-arm64/Local OCR.app"
DEST="${1:-$HOME/Applications/Local OCR.app}"

if [[ ! -d "$SRC" ]]; then
  echo "Build the app first: npm run desktop:pack" >&2
  exit 1
fi

echo "Stopping running Local OCR instances..."
pgrep -f "Local OCR.app/Contents/MacOS/Local OCR" | xargs -r kill -9 2>/dev/null || true
pgrep -f "$ROOT/node_modules/.bin/electron" | xargs -r kill -9 2>/dev/null || true
lsof -t -i:8765 2>/dev/null | xargs -r kill -9 2>/dev/null || true
sleep 1

echo "Installing to $DEST"
rm -rf "$DEST"
ditto "$SRC" "$DEST"
codesign --force --deep --sign - "$DEST" >/dev/null 2>&1 || true

echo "Installed to: $DEST"
echo "Launch with: open \"$DEST\""
