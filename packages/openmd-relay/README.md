# @openmd/relay

Reverse-tunnel relay for OpenMD live share. Hosts register an outbound tunnel; guests reach the host through a public URL.

## Hosted default

Production default relay URL: `https://openmd.skxv.dev`

Desktop app settings allow overriding this for self-hosted relays.

## Run a relay

```bash
openmd-relay --port 8788 --public-base https://relay.example.com
```

Environment:

| Variable | Purpose |
|----------|---------|
| `OPENMD_RELAY_PUBLIC_BASE` | Public URL shown to users (e.g. `https://openmd.skxv.dev`) |
| `OPENMD_RELAY_SESSION_TTL_MS` | Session lifetime (default 24h) |

## API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Relay health |
| `/sessions` | POST | Create session, returns `{ sessionId, publicUrl }` |
| `/sessions/:id` | DELETE | Tear down session |
| `/tunnel/:sessionId` | WS | Host outbound tunnel |
| `/p/:sessionId/*` | * | Guest proxy to host |

## Host tunnel client

After creating a session, the host runs:

```bash
openmd-relay-client \
  --relay-url https://openmd.skxv.dev \
  --session-id <sessionId> \
  --local-port 3000
```

The Tauri desktop app starts this automatically when you choose **File → Start live share**.

## Self-hosted

Deploy the same `openmd-relay` binary behind your domain (Coolify, Docker, systemd). Point desktop **Relay URL** to your instance.

```bash
docker run -p 8788:8788 \
  -e OPENMD_RELAY_PUBLIC_BASE=https://relay.my.domain \
  node:20 node packages/openmd-relay/bin/openmd-relay.mjs --port 8788
```
