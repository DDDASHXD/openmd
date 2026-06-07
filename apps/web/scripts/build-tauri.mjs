import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const webDirectory = path.resolve(scriptDirectory, '..')
const apiDirectory = path.join(webDirectory, 'app/api')
const apiStashDirectory = path.join(webDirectory, '.tauri-api-stash')

const require = createRequire(path.join(webDirectory, 'package.json'))
const nextBuildScript = require.resolve('next/dist/bin/next')

const stashApiRoutes = async () => {
  try {
    await fs.access(apiDirectory)
    await fs.rm(apiStashDirectory, { recursive: true, force: true })
    await fs.rename(apiDirectory, apiStashDirectory)
  } catch {
    // API routes already stashed or not present.
  }
}

const restoreApiRoutes = async () => {
  try {
    await fs.access(apiStashDirectory)
    await fs.rm(apiDirectory, { recursive: true, force: true })
    await fs.rename(apiStashDirectory, apiDirectory)
  } catch {
    // Nothing to restore.
  }
}

const runNextBuild = () =>
  new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [nextBuildScript, 'build'], {
      cwd: webDirectory,
      stdio: 'inherit',
      env: {
        ...process.env,
        TAURI_BUILD: '1',
      },
    })

    child.on('error', reject)
    child.on('close', (code) => {
      resolve(code ?? 1)
    })
  })

await stashApiRoutes()

const exitCode = await runNextBuild()

await restoreApiRoutes()

process.exit(exitCode)
