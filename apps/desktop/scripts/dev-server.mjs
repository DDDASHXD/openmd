import { execSync } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { startServer } from '@openmd/server'

const DEV_PORT = 3000
const DEV_HOST = '127.0.0.1'
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDirectory, '../../..')
const appDirectory = path.join(repoRoot, 'apps/web')
const shellWorkspace = path.join(os.homedir(), '.openmd', 'shell')
const lockPath = path.join(appDirectory, '.next/dev/lock')

const isHealthy = async () => {
  try {
    const response = await fetch(`http://${DEV_HOST}:${DEV_PORT}/api/health`, {
      signal: AbortSignal.timeout(1500),
    })

    if (!response.ok) {
      return false
    }

    const data = await response.json()
    return data.ok === true
  } catch {
    return false
  }
}

const killPort = (port) => {
  try {
    execSync(`lsof -ti tcp:${port} | xargs kill -9 2>/dev/null || true`, { stdio: 'ignore' })
  } catch {
    // No process on this port.
  }
}

const removeStaleLock = async () => {
  try {
    await fs.unlink(lockPath)
    console.log('Removed stale Next.js dev lock')
  } catch {
    // Lock file not present.
  }
}

await fs.mkdir(shellWorkspace, { recursive: true })

if (await isHealthy()) {
  console.log(`Reusing openmd dev server at http://${DEV_HOST}:${DEV_PORT}/launcher`)
  // Keep this process alive while Tauri dev runs.
  await new Promise(() => {})
}

killPort(DEV_PORT)
await removeStaleLock()

console.log(`Starting openmd dev server on http://${DEV_HOST}:${DEV_PORT}/launcher`)
console.log(`Shell workspace: ${shellWorkspace}`)

await startServer({
  workspaceRoot: shellWorkspace,
  port: DEV_PORT,
  hostname: DEV_HOST,
  appDirectory,
  serveNext: true,
})
