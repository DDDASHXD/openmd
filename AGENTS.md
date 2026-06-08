# Foliage – Agent Handbook

This document is for automated agents and new contributors. It explains how the repo is organized, where behavior actually runs, and how to extend it without breaking layout, the workspace API, or collaboration.

## What this project is

Foliage is a local-first markdown/code workspace: file tree, multi-pane editor (Monaco for text), tiling via drag-to-edge splits, and Yjs-based collaboration over WebSockets. The desktop app is a Tauri shell around a Vite + React client (`apps/client`). All filesystem, collaboration, Leafmark, and live-share tunneling run in `packages/foliage-server`.

Package manager: **pnpm** (see root `packageManager`). Node **>= 20**. Orchestration: **Turborepo** (`turbo.json`).

## Repository layout

| Path | Role |
|------|------|
| `apps/client/` | Vite + React UI (launcher, editor, dialogs) |
| `apps/desktop/` | Tauri shell, Node sidecar lifecycle, native menu |
| `packages/foliage-server/` | **Authoritative runtime** for workspace API, collaboration WS, Leafmark, live share |
| `packages/foliage-relay/` | Relay server for cloud live share |
| `packages/ui/` | Shared shadcn-style components (`@workspace/ui`) |
| `packages/eslint-config/`, `packages/typescript-config/` | Shared tooling |

Workspace APIs live only in `packages/foliage-server/src/create-server.mjs`. The client calls them via `lib/backend-client.ts` (`backendFetch`, `getCollaborationWsUrl`).

Environment: the server uses the `--workspace` CLI argument (default `process.cwd()`) as `workspaceRoot` and sets `FOLIAGE_WORKSPACE`.

## Commands

From repository root:

- `pnpm install` – install monorepo deps
- `pnpm typecheck` – TypeScript across workspaces
- `pnpm lint` / `pnpm format` – via Turbo
- `pnpm dev` – Tauri dev with WebView devtools + `RUST_LOG=debug` (Vite on :5173, server on :8787)
- `pnpm desktop:dev` – alias for `pnpm dev`
- `pnpm desktop:build` – production desktop bundle
- `pnpm server:headless` – sample headless server on :8787

From `apps/client`:

- `pnpm run dev` – Vite dev server (proxies `/api` and `/collaboration` to :8787)
- `pnpm run build` – production static client build
- `pnpm run typecheck` – `tsc --noEmit`

**Note:** Do not start a long-running dev server in agent automation unless the user explicitly asks.

Standalone server: `pnpx foliage-server --workspace /path --port 8787`

## Application architecture

### Desktop runtime

```text
Tauri webview (apps/client)
  -> HTTP/WS to embedded foliage-server sidecar (127.0.0.1:<port>)
  -> workspace PATCH switching (no respawn per project)
```

- Dev: `apps/desktop/scripts/dev.mjs` starts headless server on **8787** and Vite on **5173**.
- Prod: Rust spawns bundled Node sidecar from `src-tauri/binaries/node-{triple}`; UI is `apps/client/dist`.

### Shell layout

- `apps/client/src/pages/editor-page.tsx` – `h-screen` column: menubar, **`flex-1 min-h-0`** main row (sidebar + editor), statusbar.
- `components/sidebar/sidebar.tsx` – Workspace tree, CRUD/move via `backendFetch` to `/api/workspace`.
- `components/editor/editor-layout-root.tsx` – `react-resizable-panels` `Group`/`Panel`/`Separator`. **Separators:** horizontal splits use `w-1`; vertical splits use `h-1 w-full`.
- `stores/files.store.ts` – Zustand layout/tabs/DnD state.
- `lib/editor-layout.ts` – Pure split tree helpers.

### Editors and file types

- `lib/workspace-editor-kind.ts` – Maps extensions to `text` | `pdf` | `image`.
- `components/editor/editor-pane.tsx` – Chooses Monaco, PDF, or image viewer.
- Binary files: `GET /api/workspace/file` from foliage-server.

### Collaboration

- Yjs + `y-monaco` + `y-websocket`; WS URL from `getCollaborationWsUrl()`.
- Server seeds Y.Doc from disk and debounce-saves back to filesystem.
- Production Tauri builds need CSP `connect-src` for `http://127.0.0.1:* ws://127.0.0.1:*`.

### Live share

- UI creates relay session on cloud relay (`POST /sessions`).
- Client calls `POST /api/live-share/start` on local server (tunnel runs inside foliage-server).
- Stop via `POST /api/live-share/stop`.

### Drag and drop conventions

- `FOLIAGE_PATH_MIME`, `FOLIAGE_SOURCE_GROUP_MIME`, `FOLIAGE_IS_DIR_MIME` in `lib/foliage-dnd.ts`.
- Tree moves use **PATCH** `/api/workspace` with `{ path, toDirectory }`.
- Global cleanup: `editor-layout-root.tsx` listens for `dragend` (capture).

## Code style and project rules (important)

- **React:** Arrow function components; hooks as `React.useState`, `React.useEffect`, etc.
- **New TS/TSX files:** **kebab-case** file names with dashes.
- **HTTP:** Prefer **PATCH** for partial updates / moves; don't use PUT for the same role.
- **Package manager:** **pnpm** only.
- **Scope:** Minimal, task-focused diffs.

## How to add a feature (checklist)

1. **Data / API:** Implement in `packages/foliage-server` first. Validate paths stay inside `workspaceRoot`.
2. **Client state:** Extend stores under `apps/client/src/stores/`.
3. **Layout:** New scrollable/flex regions need **`min-h-0`** (and usually `min-w-0`).
4. **Panels:** Use `splitLeaf` / store actions; match `Separator` styling to `Group` orientation.
5. **Types:** Run `pnpm typecheck` after changes.
6. **UI:** Prefer `@workspace/ui` patterns.

## Troubleshooting hints

- **Editor height collapsed:** Check editor page main row has `flex-1 min-h-0` through the flex chain.
- **Vertical split resize dead:** Separator needs `h-1 w-full` inside vertical `Group`.
- **Tree move to root fails:** Root list and file rows must participate in drop targeting.
- **Dev API 404:** Ensure foliage-server is running on :8787; Vite proxies `/api` there.
- **Windows CMD flashes:** Server must be a single Tauri sidecar; avoid spawning extra Node processes from Rust.

## Related docs

- `README.md` – user-facing run instructions
- `apps/desktop/README.md` – Tauri dev/build notes
- `packages/foliage-server/README.md` – server deployment
