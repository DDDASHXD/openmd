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
pnpm --filter web build
pnpm --filter desktop build
```

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
