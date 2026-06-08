#!/usr/bin/env sh
set -eu

cd "$(dirname "$0")/.."

SRC="$PWD/node_modules/monaco-editor/min/vs"
DEST_DIR="$PWD/public/monaco"
DEST="$DEST_DIR/vs"

if [ ! -d "$SRC" ]; then
  echo "Monaco source not found: $SRC" >&2
  echo "Run: pnpm install (from repo root)" >&2
  exit 1
fi

rm -rf "$DEST_DIR"
mkdir -p "$DEST_DIR"
ln -sf "$SRC" "$DEST"

echo "Monaco assets ready."
echo "  $SRC"
echo "  -> $DEST"
