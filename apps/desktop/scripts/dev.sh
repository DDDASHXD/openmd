#!/usr/bin/env sh
set -eu

# Prefer rustup shims over Homebrew rustc (Tauri 2 needs Rust >= 1.88).
export PATH="${HOME}/.cargo/bin:${PATH}"

if ! command -v rustc >/dev/null 2>&1; then
  echo "rustc not found. Run: pnpm --filter desktop setup:rust"
  exit 1
fi

version="$(rustc --version | awk '{print $2}')"
major="$(echo "$version" | cut -d. -f1)"
minor="$(echo "$version" | cut -d. -f2)"

if [ "$major" -lt 1 ] || { [ "$major" -eq 1 ] && [ "$minor" -lt 88 ]; }; then
  echo "Rust 1.88+ is required (found ${version})."
  echo "Homebrew Rust is too old for Tauri 2."
  echo "Run: pnpm --filter desktop setup:rust"
  exit 1
fi

exec pnpm exec tauri dev "$@"
