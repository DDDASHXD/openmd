# OpenMD – Agent Handbook

This document is for automated agents and new contributors. It explains how the repo is organized, where behavior actually runs, and how to extend it without breaking layout, the workspace API, or collaboration.

## What this project is

OpenMD is a local-first markdown/code workspace UI: file tree, multi-pane editor (Monaco for text), tiling via drag-to-edge splits, and Yjs-based collaboration over WebSockets. The desktop/CLI entry is `openmd` (see `bin/openmd.mjs`), which boots the custom Node server in `apps/web/server.mjs`.

Package manager: **pnpm** (see root `packageManager`). Node **>= 20**. Orchestration: **Turborepo** (`turbo.json`).

## Repository layout

| Path | Role |
|------|------|
| `apps/web/` | Next.js 16 app (UI, `app/`, components, API route files) |
| `apps/web/server.mjs` | **Authoritative runtime** for HTTP upgrade, workspace file API, and collaboration WS |
| `bin/openmd.mjs` | Delegates to `apps/web/server.mjs` |
| `packages/ui/` | Shared shadcn-style components (`@workspace/ui`) |
| `packages/eslint-config/`, `packages/typescript-config/` | Shared tooling |

Workspace APIs exist both as **Next route handlers** under `apps/web/app/api/workspace/` and as **inline handlers inside `server.mjs`**. In normal dev/prod you run **`node server.mjs`** (or `pnpm dev` in `apps/web`). The custom server **handles `/api/workspace` and `/api/workspace/file` before Next**. Treat `server.mjs` as the source of truth for those endpoints; keep Next routes in sync if you rely on `next dev` without the custom server (they can drift otherwise).

Environment: **`OPENMD_WORKSPACE`** is used by some Next route code to resolve paths; the custom server uses the `--workspace` CLI argument (default `process.cwd()`) as `workspaceRoot`. When changing filesystem behavior, verify both paths.

## Commands

From repository root:

- `pnpm install` – install monorepo deps
- `pnpm typecheck` – TypeScript across workspaces
- `pnpm lint` / `pnpm format` – via Turbo
- `pnpm dev` – Turbo `dev` (see each package’s script)

From `apps/web`:

- `pnpm run typecheck` – `tsc --noEmit`
- `pnpm run dev` – runs `server.mjs` (inspect `apps/web/package.json` for the default `--workspace` path; adjust for your machine or pass args consistently)
- `pnpm run build` / `pnpm start` – Next build + production server

**Note:** Do not start a long-running dev server in agent automation unless the user explicitly asks.

End users can also run `pnpx openmd` / `pnpx openmd --workspace /path` (see root `README.md`).

## Application architecture (web app)

### Shell layout

- `apps/web/app/page.tsx` – `h-screen` column: menubar, **`flex-1 min-h-0`** main row (sidebar + editor), statusbar. The main row **must** use `flex-1 min-h-0` (not only `h-full`) so nested `flex-1` editors get a real height.
- `components/sidebar/sidebar.tsx` – Workspace tree, CRUD/move via `fetch` to `/api/workspace`. Drag-and-drop uses custom MIME types from `lib/openmd-dnd.ts` and highlight logic from `lib/workspace-tree-dnd.ts`.
- `components/editor/editor-layout-root.tsx` – `react-resizable-panels` `Group`/`Panel`/`Separator`. Nested splits mirror `lib/editor-layout.ts`. **Separators:** horizontal splits use a vertical grip (`w-1`); vertical (stacked) splits use a horizontal grip (`h-1 w-full`) so the hit area has non-zero size on the flex main axis.
- `stores/files.store.ts` – Zustand: `layoutRoot`, `groups` (tabs per pane), `openFile`, `openFileInGroup`, `moveFileToSplit`, `applyPathMove`, workspace revision, drag UX (`treeDragSource*`, `workspaceDropHighlight`, `clearTreeDragUi`).
- `lib/editor-layout.ts` – Pure tree of leaves and splits; `splitLeaf`, `removeLeafGroupNode`, `mergeSide` (`left`/`right` → horizontal group; `top`/`bottom` → vertical group).

### Editors and file types

- `lib/workspace-editor-kind.ts` – Maps extensions to `text` | `pdf` | `image`.
- `components/editor/editor-pane.tsx` – Chooses `MonacoEditor`, `PdfViewer`, or `ImageViewer` from `getWorkspaceEditorKind`.
- To add a type: extend `getWorkspaceEditorKind`, add a viewer component, wire it in `editor-pane.tsx`, and ensure `app/api/workspace/file/route.ts` and/or `server.mjs` serve the right `Content-Type` (see existing MIME map in the file route).

### Collaboration

- Yjs + `y-monaco` + `y-websocket`; provider URL from `monaco-editor.tsx` (`/collaboration` WebSocket).
- `server.mjs` wires Yjs `setupWSConnection` for the collaboration path. Be careful with binding lifecycle (avoid double-destroy on tab close).

### Drag and drop conventions

- `OPENMD_PATH_MIME`, `OPENMD_SOURCE_GROUP_MIME`, `OPENMD_IS_DIR_MIME` in `lib/openmd-dnd.ts`. Use **`OPENMD_IS_DIR_MIME`** so dropping a **folder** does not open it as a file.
- Tree moves use **PATCH** `/api/workspace` with `{ path, toDirectory }`. **Do not use PUT** for these APIs unless the user explicitly requires it.
- Global cleanup: `editor-layout-root.tsx` listens for `dragend` (capture) to reset file/tree drag UI.

## Code style and project rules (important)

Align with existing files and team conventions:

- **React:** Arrow function components; hooks as `React.useState`, `React.useEffect`, etc.
- **New TS/TSX files:** Use **kebab-case** file names with **dashes** (e.g. `editor-layout-root.tsx`), not camelCase or PascalCase file names.
- **HTTP:** Prefer **PATCH** for partial updates / moves where the API already does; don’t introduce PUT for the same role.
- **Package manager:** This repo uses **pnpm** only; don’t mix npm/yarn/bun instructions in scripts you add.
- **Scope:** Make minimal, task-focused diffs; don’t refactor unrelated code or add unsolicited READMEs.

## How to add a feature (checklist)

1. **Data / API:** If it touches the filesystem, implement in `server.mjs` first, then mirror types and behavior in Next routes if they must work standalone. Validate paths stay inside `workspaceRoot` (same checks as existing `resolveWorkspacePath` patterns).
2. **Client state:** Prefer extending `files.store.ts` or small dedicated stores under `apps/web/stores/` rather than ad-hoc context.
3. **Layout:** Any new scrollable or flex region in the editor shell needs **`min-h-0`** (and usually `min-w-0`) on the flex chain so children can shrink and scroll.
4. **Panels:** If you add split levels, use `splitLeaf` / store actions; match `Separator` styling to **Group orientation** (see above).
5. **Types:** Run `pnpm typecheck` from root or `apps/web` after changes.
6. **UI components:** Prefer `@workspace/ui` patterns; new shadcn-style pieces often go under `packages/ui` per root `README.md`.

## Troubleshooting hints

- **Editor height collapsed to a few pixels:** Check `page.tsx` main row has `flex-1 min-h-0`; check `EditorLayoutRoot` / panels use `flex-1` and `min-h-0` through the chain.
- **Vertical split resize dead:** Separator likely has only `w-1` inside a vertical `Group`; use `h-1 w-full` for that orientation.
- **Tree move to root fails:** Root list area and **file** rows must participate in drop targeting (parent directory of the file is often `''` for root-level files). See `lib/workspace-tree-dnd.ts` and sidebar handlers.
- **Workspace path wrong in API:** Confirm whether the request hit `server.mjs` or a Next route; align `OPENMD_WORKSPACE` / `--workspace` behavior.

## Related docs

- `README.md` – user-facing run instructions and shadcn component paths.
- `packages/ui`, `packages/eslint-config`, `packages/typescript-config` – shared package READMEs where present.

When in doubt, search for an existing similar feature (e.g. PDF viewer, PATCH move, drag MIME) and mirror its structure.
