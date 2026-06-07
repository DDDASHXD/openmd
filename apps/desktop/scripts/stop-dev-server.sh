#!/usr/bin/env sh
set -eu

PORT="${1:-3000}"

echo "Stopping processes on port ${PORT}..."
lsof -ti "tcp:${PORT}" | xargs kill -9 2>/dev/null || true

LOCK_PATH="$(cd "$(dirname "$0")/../../.." && pwd)/apps/web/.next/dev/lock"
if [ -f "$LOCK_PATH" ]; then
  rm -f "$LOCK_PATH"
  echo "Removed Next.js dev lock"
fi

echo "Done."
