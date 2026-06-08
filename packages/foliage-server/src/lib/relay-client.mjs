import { WebSocket } from 'ws'

export const createRelayClient = ({ relayUrl, sessionId, localPort }) => {
  const normalizedRelayUrl = relayUrl.replace(/\/+$/, '')
  const relayWsUrl = normalizedRelayUrl.replace(/^http/, 'ws') + `/tunnel/${sessionId}`
  const localBase = `http://127.0.0.1:${localPort}`

  let socket = null
  let state = {
    active: false,
    sessionId: null,
    relayUrl: null,
  }

  const getStatus = () => ({ ...state })

  const stop = () => {
    if (socket) {
      const current = socket
      socket = null
      current.removeAllListeners()
      if (current.readyState === WebSocket.OPEN || current.readyState === WebSocket.CONNECTING) {
        current.close()
      }
    }

    state = {
      active: false,
      sessionId: null,
      relayUrl: null,
    }
  }

  const start = () =>
    new Promise((resolve, reject) => {
      stop()

      const nextSocket = new WebSocket(relayWsUrl)
      socket = nextSocket

      nextSocket.on('open', () => {
        state = {
          active: true,
          sessionId,
          relayUrl: normalizedRelayUrl,
        }
        resolve(getStatus())
      })

      nextSocket.on('message', (raw) => {
        void (async () => {
          try {
            const message = JSON.parse(raw.toString())

            if (message.type !== 'request' || !socket || socket !== nextSocket) {
              return
            }

            const targetUrl = `${localBase}${message.path}`
            const body = message.body ? Buffer.from(message.body, 'base64') : undefined

            const response = await fetch(targetUrl, {
              method: message.method ?? 'GET',
              headers: message.headers ?? {},
              body:
                body && message.method !== 'GET' && message.method !== 'HEAD' ? body : undefined,
            })

            const responseBody = Buffer.from(await response.arrayBuffer())

            if (socket === nextSocket && nextSocket.readyState === WebSocket.OPEN) {
              nextSocket.send(
                JSON.stringify({
                  type: 'response',
                  id: message.id,
                  status: response.status,
                  headers: Object.fromEntries(response.headers.entries()),
                  body: responseBody.toString('base64'),
                }),
              )
            }
          } catch (error) {
            console.error('Relay client error:', error)
          }
        })()
      })

      nextSocket.on('error', (error) => {
        if (socket === nextSocket) {
          stop()
          reject(error)
        }
      })

      nextSocket.on('close', () => {
        if (socket === nextSocket) {
          stop()
        }
      })
    })

  return {
    start,
    stop,
    getStatus,
  }
}
