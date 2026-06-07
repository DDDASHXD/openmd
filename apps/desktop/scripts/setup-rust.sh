#!/usr/bin/env sh
set -eu

export PATH="${HOME}/.cargo/bin:${PATH}"

if ! command -v rustup >/dev/null 2>&1; then
  echo "Rust 1.88+ is required for the Tauri desktop app."
  echo ""
  echo "Install rustup:"
  echo "  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
  echo ""
  echo "Then run:"
  echo "  pnpm --filter desktop setup:rust"
  exit 1
fi

rustup toolchain install 1.88.0 --profile minimal
rustup default 1.88.0
rustc --version
