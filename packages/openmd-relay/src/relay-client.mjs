import process from 'node:process'
import { WebSocket } from 'ws'

const getArgumentValue = (name) => {
  const index = process.argv.indexOf(name)
  const value = index === -1 ? undefined : process.argv[index + 1]
  return value && !value.startsWith('--') ? value : undefined
}

const relayUrl = (getArgumentValue('--relay-url') ?? 'https://openmd.skxv.dev').replace(/\/+$/, '')
const sessionId = getArgumentValue('--session-id')
const localPort = Number.parseInt(getArgumentValue('--local-port') ?? '3000', 10)

if (!sessionId) {
  console.error('Missing --session-id')
  process.exit(1)
}

const relayWsUrl = relayUrl.replace(/^http/, 'ws') + `/tunnel/${sessionId}`
const localBase = `http://127.0.0.1:${localPort}`

const socket = new WebSocket(relayWsUrl)

socket.on('open', () => {
  console.log(`Relay client connected for session ${sessionId}`)
})

socket.on('message', (raw) => {
  void (async () => {
    try {
      const message = JSON.parse(raw.toString())

      if (message.type === 'request') {
        const targetUrl = `${localBase}${message.path}`
        const body = message.body ? Buffer.from(message.body, 'base64') : undefined

        const response = await fetch(targetUrl, {
          method: message.method ?? 'GET',
          headers: message.headers ?? {},
          body: body && message.method !== 'GET' && message.method !== 'HEAD' ? body : undefined,
        })

        const responseBody = Buffer.from(await response.arrayBuffer())

        socket.send(
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

socket.on('close', () => {
  console.log('Relay client disconnected')
  process.exit(0)
})

socket.on('error', (error) => {
  console.error('Relay socket error:', error)
  process.exit(1)
})
