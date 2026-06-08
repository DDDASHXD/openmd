import { spawn } from 'node:child_process'
import { execSync } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DEV_SERVER_PORT = 8787
const DEV_VITE_PORT = 5173
const DEV_HOST = '127.0.0.1'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const desktopDirectory = path.resolve(scriptDirectory, '..')
const repoRoot = path.resolve(desktopDirectory, '../..')
const shellWorkspace = path.join(os.homedir(), '.foliage', 'shell')
const serverScript = path.join(repoRoot, 'packages/foliage-server/bin/foliage-server.mjs')

let serverChild = null
let viteChild = null

const isServerHealthy = async () => {
  try {
    const response = await fetch(`http://${DEV_HOST}:${DEV_SERVER_PORT}/api/health`, {
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

const isViteHealthy = async () => {
  try {
    const response = await fetch(`http://${DEV_HOST}:${DEV_VITE_PORT}/launcher`, {
      signal: AbortSignal.timeout(1500),
    })

    return response.ok
  } catch {
    return false
  }
}

const waitForServerHealthy = async (deadlineMs = 60_000) => {
  const startedAt = Date.now()

  while (Date.now() - startedAt < deadlineMs) {
    if (await isServerHealthy()) {
      return
    }

    await new Promise((resolve) => setTimeout(resolve, 250))
  }

  throw new Error(`Server did not become ready on http://${DEV_HOST}:${DEV_SERVER_PORT}`)
}

const waitForViteHealthy = async (deadlineMs = 60_000) => {
  const startedAt = Date.now()

  while (Date.now() - startedAt < deadlineMs) {
    if (await isViteHealthy()) {
      return
    }

    await new Promise((resolve) => setTimeout(resolve, 250))
  }

  throw new Error(`Vite did not become ready on http://${DEV_HOST}:${DEV_VITE_PORT}/launcher`)
}

const killPort = (port) => {
  try {
    if (process.platform === 'win32') {
      execSync(
        `powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"`,
        { stdio: 'ignore' },
      )
      return
    }

    execSync(`lsof -ti tcp:${port} | xargs kill -9 2>/dev/null || true`, { stdio: 'ignore' })
  } catch {
    // No process on this port.
  }
}

const killDetachedChild = (child) => {
  if (!child || child.killed) {
    return
  }

  try {
    if (process.platform !== 'win32' && child.pid) {
      process.kill(-child.pid, 'SIGTERM')
      return
    }
  } catch {
    // Fall through to direct child kill.
  }

  child.kill('SIGTERM')
}

const pnpmCommand = () => {
  if (process.platform !== 'win32') {
    return 'pnpm'
  }

  if (process.env.PNPM_HOME) {
    return path.join(process.env.PNPM_HOME, 'pnpm.cmd')
  }

  return 'pnpm.cmd'
}

const spawnDetached = (command, args, options = {}) => {
  const spawnOptions = {
    cwd: repoRoot,
    stdio: 'inherit',
    env: process.env,
    ...options,
  }

  if (process.platform !== 'win32') {
    spawnOptions.detached = true
  }

  const child = spawn(command, args, spawnOptions)

  if (process.platform !== 'win32') {
    child.unref()
  }

  return child
}

let keepAliveTimer = null

const startKeepAlive = () => {
  // When reusing detached server/vite, nothing else refs the event loop and Node exits
  // immediately (Tauri reports beforeDevCommand as failed). A noop interval prevents that.
  keepAliveTimer = setInterval(() => {}, 60_000)
}

const stopKeepAlive = () => {
  if (keepAliveTimer) {
    clearInterval(keepAliveTimer)
    keepAliveTimer = null
  }
}

const hangUntilSignal = () =>
  new Promise((resolve) => {
    const onStop = (reason) => {
      stopKeepAlive()
      resolve(reason)
    }

    process.once('SIGINT', () => onStop('sigint'))
    process.once('SIGTERM', () => onStop('sigterm'))
  })

process.on('SIGINT', () => {
  killDetachedChild(serverChild)
  killDetachedChild(viteChild)
  killPort(DEV_SERVER_PORT)
  killPort(DEV_VITE_PORT)
  stopKeepAlive()
  process.exit(0)
})

process.on('SIGTERM', () => {
  // Tauri restarts beforeDevCommand on Rust rebuilds. Leave detached children running
  // so the next run can reuse them.
  stopKeepAlive()
  process.exit(0)
})

try {
  await fs.mkdir(shellWorkspace, { recursive: true })

  const serverAlreadyRunning = await isServerHealthy()

  if (!serverAlreadyRunning) {
    killPort(DEV_SERVER_PORT)

    console.log(`Starting foliage-server on http://${DEV_HOST}:${DEV_SERVER_PORT}`)
    console.log(`Shell workspace: ${shellWorkspace}`)

    serverChild = spawnDetached(process.execPath, [
      serverScript,
      '--headless',
      '--workspace',
      shellWorkspace,
      '--port',
      String(DEV_SERVER_PORT),
      '--hostname',
      DEV_HOST,
    ])

    serverChild.on('exit', (code, signal) => {
      if (signal === 'SIGTERM' || signal === 'SIGINT') {
        return
      }

      console.error(`foliage-server exited (${code ?? signal ?? 'unknown'})`)
      process.exit(code ?? 1)
    })

    await waitForServerHealthy()
    console.log(`Server ready at http://${DEV_HOST}:${DEV_SERVER_PORT}`)
  } else {
    console.log(`Reusing foliage-server at http://${DEV_HOST}:${DEV_SERVER_PORT}`)
  }

  const viteAlreadyRunning = await isViteHealthy()

  if (viteAlreadyRunning) {
    console.log(`Reusing Vite client at http://${DEV_HOST}:${DEV_VITE_PORT}/launcher`)
  } else {
    killPort(DEV_VITE_PORT)

    console.log(`Starting Vite client on http://${DEV_HOST}:${DEV_VITE_PORT}/launcher`)

    viteChild = spawnDetached(pnpmCommand(), ['--filter', 'client', 'dev'], {
      shell: process.platform === 'win32',
      env: {
        ...process.env,
        FORCE_COLOR: '1',
      },
    })

    viteChild.on('exit', (code, signal) => {
      if (signal === 'SIGTERM' || signal === 'SIGINT') {
        return
      }

      console.error(`Vite exited (${code ?? signal ?? 'unknown'})`)
      process.exit(code ?? 1)
    })

    await waitForViteHealthy()
    console.log(`Vite ready at http://${DEV_HOST}:${DEV_VITE_PORT}/launcher`)
  }

  startKeepAlive()
  await hangUntilSignal()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}
