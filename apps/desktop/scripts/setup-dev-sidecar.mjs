import { execSync } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const binariesDirectory = path.join(scriptDirectory, '../src-tauri/binaries')

const targetTriple = () => {
  const arch = process.arch === 'arm64' ? 'aarch64' : 'x86_64'

  if (process.platform === 'darwin') {
    return `${arch}-apple-darwin`
  }

  if (process.platform === 'linux') {
    return `${arch}-unknown-linux-gnu`
  }

  if (process.platform === 'win32') {
    return 'x86_64-pc-windows-msvc.exe'
  }

  throw new Error(`Unsupported platform: ${process.platform}`)
}

const resolveNodeBinary = () => {
  if (process.platform === 'win32') {
    return execSync('where node', { encoding: 'utf8' }).trim().split(/\r?\n/)[0]
  }

  return execSync('which node', { encoding: 'utf8' }).trim()
}

const triple = targetTriple()
const sidecarName = `node-${triple}`
const sidecarPath = path.join(binariesDirectory, sidecarName)
const nodeBinary = resolveNodeBinary()

await fs.mkdir(binariesDirectory, { recursive: true })

try {
  await fs.unlink(sidecarPath)
} catch {
  // Sidecar not present yet.
}

if (process.platform === 'win32') {
  await fs.copyFile(nodeBinary, sidecarPath)
} else {
  await fs.symlink(nodeBinary, sidecarPath)
}

console.log(`Dev sidecar ready: ${sidecarPath} -> ${nodeBinary}`)
