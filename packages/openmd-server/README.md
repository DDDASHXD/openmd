# @openmd/server

Authoritative OpenMD workspace runtime: filesystem API, Yjs collaboration, and optional Next.js UI hosting.

## Modes

### Full mode (desktop / dev)

Serves the Next.js UI plus all workspace APIs and WebSockets.

```bash
openmd-server \
  --workspace /path/to/project \
  --port 3000 \
  --app-dir /path/to/openmd/apps/web
```

### Headless mode (persistent remote server)

API and WebSocket only. Use this for always-on team servers or VPS deployments.

```bash
openmd-server \
  --workspace /path/to/project \
  --port 8787 \
  --headless \
  --hostname 0.0.0.0
```

Clients connect with **Connect to server** in the launcher and use the server URL (for example `https://notes.example.com:8787`).

## Health check

```bash
curl http://127.0.0.1:8787/api/health
```

## Create project scaffold

```bash
curl -X POST http://127.0.0.1:3000/api/workspace/project \
  -H 'Content-Type: application/json' \
  -d '{"path":"/path/to/new-project"}'
```

Creates:

```
project/
  _frontmatter.md
  chapter-1.md
other/
.openmd/settings.json
```

## Environment

| Variable | Purpose |
|----------|---------|
| `OPENMD_WORKSPACE` | Workspace root (set automatically from `--workspace`) |
| `OPENMD_APP_ROOT` | Next.js app directory for Leafmark resolution |
| `PORT` | Default listen port |
| `HOSTNAME` | Bind address (default `0.0.0.0`) |

## Docker example (headless)

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN corepack enable && pnpm install --frozen-lockfile
EXPOSE 8787
CMD ["node", "packages/openmd-server/bin/openmd-server.mjs", "--workspace", "/data", "--port", "8787", "--headless", "--hostname", "0.0.0.0"]
```

Mount your project at `/data` and publish port `8787`.
