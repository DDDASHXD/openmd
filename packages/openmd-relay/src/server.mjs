import { createServer } from 'node:http'
import { randomBytes } from 'node:crypto'
import process from 'node:process'
import { WebSocketServer } from 'ws'

const sessions = new Map()
const pendingRequests = new Map()

const getArgumentValue = (name) => {
  const index = process.argv.indexOf(name)
  const value = index === -1 ? undefined : process.argv[index + 1]
  return value && !value.startsWith('--') ? value : undefined
}

const port = Number.parseInt(getArgumentValue('--port') ?? process.env.PORT ?? '8788', 10)
const publicBase =
  getArgumentValue('--public-base') ?? process.env.OPENMD_RELAY_PUBLIC_BASE ?? `http://127.0.0.1:${port}`
const sessionTtlMs = Number.parseInt(process.env.OPENMD_RELAY_SESSION_TTL_MS ?? '86400000', 10)

const corsHeaders = (request) => {
  const origin = request.headers.origin ?? '*'

  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
    'access-control-allow-headers': 'Content-Type, Authorization',
    'access-control-allow-credentials': 'true',
  }
}

const sendJson = (response, status, data, request) => {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    ...(request ? corsHeaders(request) : {}),
  })
  response.end(JSON.stringify(data))
}

const createSessionId = () => randomBytes(8).toString('hex')

const cleanupSession = (sessionId) => {
  const session = sessions.get(sessionId)

  if (!session) {
    return
  }

  if (session.tunnel?.readyState === 1) {
    session.tunnel.close()
  }

  sessions.delete(sessionId)
}

const proxyHttpThroughTunnel = (sessionId, request, response, bodyBuffer = Buffer.alloc(0)) =>
  new Promise((resolve, reject) => {
    const session = sessions.get(sessionId)

    if (!session?.tunnel || session.tunnel.readyState !== 1) {
      reject(new Error('Tunnel is not connected.'))
      return
    }

    const requestId = randomBytes(6).toString('hex')
    const timeout = setTimeout(() => {
      pendingRequests.delete(requestId)
      reject(new Error('Tunnel request timed out.'))
    }, 30000)

    pendingRequests.set(requestId, {
      resolve: (payload) => {
        clearTimeout(timeout)
        response.writeHead(payload.status ?? 502, payload.headers ?? {})
        response.end(Buffer.from(payload.body ?? '', 'base64'))
        resolve()
      },
      reject: (error) => {
        clearTimeout(timeout)
        reject(error)
      },
    })

    session.tunnel.send(
      JSON.stringify({
        type: 'request',
        id: requestId,
        method: request.method,
        path: request.url,
        headers: request.headers,
        body: bodyBuffer.toString('base64'),
      }),
    )
  })

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host}`)

  if (request.method === 'OPTIONS') {
    response.writeHead(204, corsHeaders(request))
    response.end()
    return
  }

  if (url.pathname === '/api/health' && request.method === 'GET') {
    sendJson(response, 200, { ok: true, service: 'openmd-relay' }, request)
    return
  }

  if (url.pathname === '/sessions' && request.method === 'POST') {
    const sessionId = createSessionId()
    const publicUrl = `${publicBase.replace(/\/+$/, '')}/p/${sessionId}`

    sessions.set(sessionId, {
      createdAt: Date.now(),
      tunnel: null,
      publicUrl,
    })

    sendJson(response, 201, { sessionId, publicUrl }, request)
    return
  }

  if (url.pathname.startsWith('/sessions/') && request.method === 'DELETE') {
    const sessionId = url.pathname.replace('/sessions/', '').split('/')[0]
    cleanupSession(sessionId)
    sendJson(response, 200, { ok: true }, request)
    return
  }

  const proxyMatch = url.pathname.match(/^\/p\/([^/]+)(\/.*)?$/)

  if (proxyMatch) {
    const sessionId = proxyMatch[1]
    const proxiedPath = proxyMatch[2] ?? '/'
    const session = sessions.get(sessionId)

    if (!session) {
      sendJson(response, 404, { error: 'Session not found.' }, request)
      return
    }

    if (Date.now() - session.createdAt > sessionTtlMs) {
      cleanupSession(sessionId)
      sendJson(response, 410, { error: 'Session expired.' }, request)
      return
    }

    const chunks = []

    request.on('data', (chunk) => chunks.push(chunk))
    request.on('end', () => {
      const body = Buffer.concat(chunks)
      const proxiedRequest = {
        ...request,
        url: proxiedPath + url.search,
      }

      void proxyHttpThroughTunnel(sessionId, proxiedRequest, response, body).catch((error) => {
        sendJson(
          response,
          502,
          { error: error instanceof Error ? error.message : 'Proxy failed.' },
          request,
        )
      })
    })

    return
  }

  sendJson(response, 404, { error: 'Not found.' }, request)
})

const tunnelServer = new WebSocketServer({ noServer: true })

tunnelServer.on('connection', (socket, request) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host}`)
  const sessionId = url.pathname.replace(/^\/tunnel\/?/, '').split('/')[0]

  if (!sessionId || !sessions.has(sessionId)) {
    socket.close()
    return
  }

  const session = sessions.get(sessionId)
  session.tunnel = socket

  socket.on('message', (raw) => {
    try {
      const message = JSON.parse(raw.toString())

      if (message.type === 'response' && message.id) {
        const pending = pendingRequests.get(message.id)

        if (pending) {
          pendingRequests.delete(message.id)
          pending.resolve(message)
        }
      }
    } catch {
      // Ignore malformed tunnel messages.
    }
  })

  socket.on('close', () => {
    if (session.tunnel === socket) {
      session.tunnel = null
    }
  })
})

server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host}`)

  if (url.pathname.startsWith('/tunnel/')) {
    tunnelServer.handleUpgrade(request, socket, head, (webSocket) => {
      tunnelServer.emit('connection', webSocket, request)
    })
    return
  }

  const proxyMatch = url.pathname.match(/^\/p\/([^/]+)(\/.*)?$/)

  if (proxyMatch) {
    const sessionId = proxyMatch[1]
    const proxiedPath = proxyMatch[2] ?? '/'
    const session = sessions.get(sessionId)

    if (!session?.tunnel || session.tunnel.readyState !== 1) {
      socket.destroy()
      return
    }

    const requestId = randomBytes(6).toString('hex')

    pendingRequests.set(requestId, {
      resolve: () => {},
      reject: () => socket.destroy(),
    })

    session.tunnel.send(
      JSON.stringify({
        type: 'upgrade',
        id: requestId,
        path: proxiedPath + url.search,
        headers: request.headers,
      }),
    )

    socket.destroy()
    return
  }

  socket.destroy()
})

server.listen(port, () => {
  console.log(`openmd-relay listening on ${port}`)
  console.log(`Public base: ${publicBase}`)
})
