import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDirectory, '../../..')
const { WebSocket } = require(
  path.join(repoRoot, 'packages/foliage-server/node_modules/ws'),
)
const testWorkspace = path.join(repoRoot, 'test-workspace')
const testFile = 'ws-gate-test.md'
const testFilePath = path.join(testWorkspace, testFile)
const port = 8791

const waitForHealth = async () => {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`, {
        signal: AbortSignal.timeout(500),
      })

      if (response.ok) {
        return
      }
    } catch {
      // Retry until server is ready.
    }

    await new Promise((resolve) => setTimeout(resolve, 250))
  }

  throw new Error(`Server did not become healthy on port ${port}.`)
}

await fs.mkdir(testWorkspace, { recursive: true })
await fs.writeFile(testFilePath, '# WS gate test\n', 'utf8')

const server = spawn(
  process.execPath,
  [
    path.join(repoRoot, 'packages/foliage-server/bin/foliage-server.mjs'),
    '--headless',
    '--workspace',
    testWorkspace,
    '--port',
    String(port),
    '--hostname',
    '127.0.0.1',
  ],
  {
    cwd: repoRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
  },
)

let serverOutput = ''

server.stdout.on('data', (chunk) => {
  serverOutput += chunk.toString()
})

server.stderr.on('data', (chunk) => {
  serverOutput += chunk.toString()
})

const stopServer = () => {
  if (!server.killed) {
    server.kill('SIGTERM')
  }
}

process.on('exit', stopServer)
process.on('SIGINT', () => {
  stopServer()
  process.exit(1)
})

try {
  await waitForHealth()

  const wsUrl = `ws://127.0.0.1:${port}/collaboration/${encodeURIComponent(testFile)}`

  await new Promise((resolve, reject) => {
    const socket = new WebSocket(wsUrl)
    const timeout = setTimeout(() => {
      socket.terminate()
      reject(new Error('WebSocket connection timed out.'))
    }, 5000)

    socket.once('open', () => {
      clearTimeout(timeout)
      socket.close()
      resolve(undefined)
    })

    socket.once('error', (error) => {
      clearTimeout(timeout)
      reject(error)
    })
  })

  console.log('Collaboration WebSocket gate: PASS')
  console.log(`  ${wsUrl}`)
} catch (error) {
  console.error('Collaboration WebSocket gate: FAIL')
  console.error(error instanceof Error ? error.message : error)

  if (serverOutput.trim()) {
    console.error('Server output:')
    console.error(serverOutput.trim())
  }

  process.exitCode = 1
} finally {
  stopServer()
  await fs.rm(testFilePath, { force: true })
}
