# Foliage Desktop (Tauri)

Desktop shell that runs an embedded `foliage-server` sidecar, shows the launcher, and opens the editor workspace.

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

`pnpm desktop:dev` runs:

1. `setup-dev-sidecar.mjs` – symlinks system Node into `src-tauri/binaries/node-{triple}` for Tauri dev
2. `dev.mjs` (beforeDevCommand) – starts `foliage-server` on `http://127.0.0.1:8787` and Vite on `http://127.0.0.1:5173`
3. `tauri dev` – opens the webview at `http://127.0.0.1:5173/launcher`

If ports are stuck:

```bash
pnpm --filter desktop dev:stop
pnpm desktop:dev
```

On first launch the app:

1. Adopts or starts `foliage-server` with shell workspace `~/.foliage/shell`
2. Switches workspace via `PATCH /api/workspace/session` when you open/create a project (no server respawn)

## Build

```bash
pnpm desktop:build
```

This builds the Vite client (`apps/client/dist`), bundles `foliage-server` + Node sidecar, and packages the Tauri app.

## Releases

Push a version tag to trigger the `Release Desktop` workflow:

```bash
git tag v0.0.1
git push origin v0.0.1
```

Bump `version` in `apps/desktop/src-tauri/tauri.conf.json` before tagging.

### macOS "app is damaged" warning

```bash
xattr -cr /Applications/foliage.app
```

Or right-click **foliage.app** → **Open**.

## Tauri commands

| Command | Purpose |
|---------|---------|
| `get_local_server_url` | Current embedded server URL |
| `start_local_server` | Switch workspace on running server |
| `stop_local_server` | Stop embedded server |
| `open_editor_window` | Resize to editor dimensions |
| `return_to_launcher` | Return to launcher workspace/size |

Filesystem and live-share actions use the server HTTP API from the client (no separate Rust spawns).
