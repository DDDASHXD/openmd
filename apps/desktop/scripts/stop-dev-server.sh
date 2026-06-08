#!/usr/bin/env sh
set -eu

for PORT in 8787 5173; do
  lsof -ti tcp:"$PORT" | xargs kill -9 2>/dev/null || true
done

echo "Stopped dev server processes on ports 8787 and 5173."
