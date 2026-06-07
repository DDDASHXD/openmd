import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const desktopDirectory = path.resolve(scriptDirectory, '..')
const webDirectory = path.resolve(desktopDirectory, '../web')

const runNodeScript = (scriptPath) => {
  const result = spawnSync(process.execPath, [scriptPath], {
    stdio: 'inherit',
    env: process.env,
  })

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

runNodeScript(path.join(desktopDirectory, 'scripts/bundle-release-resources.mjs'))
runNodeScript(path.join(webDirectory, 'scripts/build-tauri.mjs'))
