# OpenMD Desktop (Tauri)

Desktop shell that spawns an embedded `openmd-server`, shows the Obsidian-style launcher, and opens the editor workspace.

## Requirements

- Node.js >= 20
- Rust >= 1.88 via **rustup** (Homebrew Rust 1.86 is too old for Tauri 2)
- pnpm

## Development

From repository root:

```bash
pnpm install
pnpm --filter desktop setup:rust   # once: installs Rust 1.88 via rustup
pnpm desktop:dev
```

If you see `rustc 1.86.0 is not supported`, your shell is using Homebrew Rust instead of rustup. Run `setup:rust` and use `pnpm desktop:dev` (not `tauri dev` directly).

If you see `Unable to acquire lock at .../.next/dev/lock`, a previous dev server is still running:

```bash
pnpm --filter desktop dev:stop
pnpm desktop:dev
```

`tauri dev` runs `pnpm run dev:server` first, which starts `openmd-server` on `http://127.0.0.1:3000/launcher`. Tauri waits for that URL, then opens the desktop window.

On first launch the app:

1. Starts `openmd-server` with a shell workspace at `~/.openmd/shell`
2. Loads `http://127.0.0.1:<port>/launcher`
3. Restarts the server with the chosen project workspace when you open/create a project

## Build

```bash
pnpm desktop:build
```

This runs a static Next.js export (`apps/web/out`) and bundles the Tauri app.

## Releases

GitHub Releases are built automatically when you push a version tag:

```bash
git tag v0.0.1
git push origin v0.0.1
```

The `Release Desktop` workflow (`.github/workflows/release-desktop.yml` at the repo root) builds macOS (arm64 + x64), Windows, and Linux installers and uploads them to the GitHub release for that tag.

Bump `version` in `apps/desktop/src-tauri/tauri.conf.json` (and `Cargo.toml` if needed) before tagging so the release matches the app version.

### macOS "app is damaged" warning

GitHub release builds are ad-hoc signed (not notarized). After copying the app out of the DMG, macOS may block the first launch.

**Fix:**

```bash
xattr -cr /Applications/openmd.app
```

Or right-click **openmd.app** → **Open** → **Open** again.

For a fully trusted install (no workaround), set up Apple Developer code signing + notarization in CI. See [Tauri macOS signing](https://v2.tauri.app/distribute/sign/macos/).

## Tauri commands

| Command | Purpose |
|---------|---------|
| `pick_folder` | Native folder picker |
| `pick_save_location` | New project path picker |
| `create_project` | Write project scaffold |
| `start_local_server` | Spawn/restart embedded server |
| `stop_local_server` | Stop embedded server |
| `open_editor_window` | Resize to editor dimensions |
| `start_live_share` | Start relay tunnel client |
| `stop_live_share` | Stop relay tunnel client |
| `return_to_launcher` | Stop share/server and return to launcher |
