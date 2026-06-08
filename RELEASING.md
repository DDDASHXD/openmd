# Releasing Foliage

This repo uses a single source of truth for the product version and automated GitHub Actions for desktop builds.

## Version source of truth

The release version lives in the root [`VERSION`](./VERSION) file.

`pnpm version:sync` copies that value into every release artifact:

| File | Purpose |
|------|---------|
| `package.json` | Root npm package |
| `apps/client/package.json` | Vite client |
| `apps/desktop/package.json` | Desktop workspace |
| `packages/foliage-server/package.json` | Headless server |
| `packages/foliage-relay/package.json` | Relay server |
| `apps/desktop/src-tauri/tauri.conf.json` | Tauri bundle version |
| `apps/desktop/src-tauri/Cargo.toml` | Rust crate version |

The client UI reads the same value at build time through `VITE_FOLIAGE_VERSION`.

Internal workspace packages (`packages/ui`, shared configs) stay at `0.0.0` and are not part of the release version.

## Everyday commands

```bash
# Confirm every release file matches VERSION
pnpm version:check

# Apply VERSION to all release files (after editing VERSION manually)
pnpm version:sync
```

CI runs `pnpm version:check` on every push and pull request to `main`.

## Cut a release

Pick one bump type:

```bash
pnpm release:patch   # 0.0.4 -> 0.0.5
pnpm release:minor   # 0.0.4 -> 0.1.0
pnpm release:major   # 0.0.4 -> 1.0.0
```

Or set an explicit version:

```bash
pnpm release -- 0.1.0
```

What the release script does:

1. Updates `VERSION`
2. Runs `pnpm version:sync`
3. Commits the version files with message `release: vX.Y.Z`
4. Creates git tag `vX.Y.Z`

By default it stops there and prints the push commands. To push immediately:

```bash
pnpm release:patch -- --push
```

Preview without writing anything:

```bash
pnpm release:patch -- --dry-run
```

Bump only, no git commit/tag:

```bash
pnpm release:patch -- --no-git
```

## Publish desktop builds

After you push the tag:

```bash
git push origin main
git push origin v0.0.5
```

GitHub Actions workflow [`.github/workflows/release-desktop.yml`](./.github/workflows/release-desktop.yml) runs on every `v*` tag and builds:

- macOS Apple Silicon (`.dmg`)
- macOS Intel (`.dmg`)
- Windows (`.exe`)
- Linux (`.deb` / `.AppImage`)

Assets are attached to the matching GitHub Release.

### Manual release trigger

You can also run the workflow from the GitHub Actions UI with **workflow_dispatch**. The tag you provide must match `VERSION` exactly (for example tag `v0.0.5` when `VERSION` contains `0.0.5`).

## Recommended release checklist

1. Merge release work to `main`
2. `pnpm typecheck && pnpm lint`
3. `pnpm release:patch` (or minor/major)
4. `git push origin main && git push origin vX.Y.Z`
5. Watch the **Release Desktop** workflow on GitHub
6. Verify installers from the GitHub Release page

## Troubleshooting

**CI fails version check**

```bash
pnpm version:sync
git add -A
git commit -m "chore: sync release versions"
```

**Release workflow fails tag check**

The git tag must be `v` + the exact contents of `VERSION`. Re-tag or re-run the release script.

**Local desktop build version looks wrong**

```bash
pnpm version:sync
pnpm desktop:build
```
