# foliage-server

Authoritative Foliage workspace runtime: filesystem API, Yjs collaboration, Leafmark builds, and live-share relay tunneling.

## Headless mode (default)

API and WebSocket only. Use for embedded desktop sidecars, LAN servers, or VPS deployments.

```bash
foliage-server \
  --workspace /path/to/project \
  --port 8787 \
  --headless \
  --hostname 0.0.0.0
```

Desktop clients connect with **Connect to server** in the launcher.

## Health check

```bash
curl http://127.0.0.1:8787/api/health
```

## Live share

```bash
curl -X POST http://127.0.0.1:8787/api/live-share/start \
  -H 'Content-Type: application/json' \
  -d '{"relayUrl":"https://foliage.skxv.dev","sessionId":"<id>"}'

curl -X POST http://127.0.0.1:8787/api/live-share/stop
```

## Create project scaffold

```bash
curl -X POST http://127.0.0.1:8787/api/workspace/project \
  -H 'Content-Type: application/json' \
  -d '{"path":"/path/to/new-project"}'
```

Creates:

```
project/
  _frontmatter.md
  chapter-1.md
other/
.foliage/settings.json
```

## Environment

| Variable | Purpose |
|----------|---------|
| `FOLIAGE_WORKSPACE` | Workspace root (set automatically from `--workspace`) |
| `PORT` | Default listen port |
| `HOSTNAME` | Bind address (default `0.0.0.0`) |

## Docker example (headless)

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN corepack enable && pnpm install --frozen-lockfile
EXPOSE 8787
CMD ["node", "packages/foliage-server/bin/foliage-server.mjs", "--workspace", "/data", "--port", "8787", "--headless", "--hostname", "0.0.0.0"]
```

Mount your project at `/data` and publish port `8787`.
