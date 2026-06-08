import { execSync } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const normalizeNodeArch = (arch) => {
  if (arch === 'x86_64') {
    return 'x64'
  }

  if (arch === 'aarch64') {
    return 'arm64'
  }

  return arch
}

const targetTriple = () => {
  const arch = normalizeNodeArch(process.env.FOLIAGE_BUNDLE_NODE_ARCH ?? process.arch)

  if (process.platform === 'darwin') {
    return arch === 'arm64' ? 'aarch64-apple-darwin' : 'x86_64-apple-darwin'
  }

  if (process.platform === 'linux') {
    return `${arch === 'arm64' ? 'aarch64' : 'x86_64'}-unknown-linux-gnu`
  }

  if (process.platform === 'win32') {
    return 'x86_64-pc-windows-msvc.exe'
  }

  throw new Error(`Unsupported platform for bundled Node.js: ${process.platform}`)
}

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const desktopDirectory = path.resolve(scriptDirectory, '..')
const repoRoot = path.resolve(desktopDirectory, '../..')
const tauriDirectory = path.join(desktopDirectory, 'src-tauri')
const resourcesDirectory = path.join(tauriDirectory, 'resources')
const serverDirectory = path.join(resourcesDirectory, 'foliage-server')
const binariesDirectory = path.join(tauriDirectory, 'binaries')

const nodeVersion = '20.19.5'

const nodeArchiveName = () => {
  const arch = normalizeNodeArch(process.env.FOLIAGE_BUNDLE_NODE_ARCH ?? process.arch)

  if (process.platform === 'darwin') {
    return `node-v${nodeVersion}-darwin-${arch}`
  }

  if (process.platform === 'linux') {
    return `node-v${nodeVersion}-linux-${arch}`
  }

  if (process.platform === 'win32') {
    return `node-v${nodeVersion}-win-${arch === 'ia32' ? 'x86' : arch}`
  }

  throw new Error(`Unsupported platform for bundled Node.js: ${process.platform}`)
}

const downloadFile = async (url, destination) => {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`)
  }

  await fs.writeFile(destination, Buffer.from(await response.arrayBuffer()))
}

const runCommand = (command, options) => {
  execSync(command, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      CI: process.env.CI ?? 'true',
    },
    ...options,
  })
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

const removeBrokenSymlinks = async (rootDirectory) => {
  const walk = async (directory) => {
    let entries

    try {
      entries = await fs.readdir(directory, { withFileTypes: true })
    } catch {
      return
    }

    await Promise.all(
      entries.map(async (entry) => {
        const entryPath = path.join(directory, entry.name)

        if (entry.isSymbolicLink()) {
          try {
            await fs.stat(entryPath)
          } catch {
            await fs.unlink(entryPath)
          }

          return
        }

        if (entry.isDirectory()) {
          await walk(entryPath)
        }
      }),
    )
  }

  await walk(rootDirectory)
}

const downloadBundledNodeSidecar = async () => {
  const triple = targetTriple()
  const sidecarName = `node-${triple}`
  const sidecarPath = path.join(binariesDirectory, sidecarName)

  await fs.mkdir(binariesDirectory, { recursive: true })

  try {
    await fs.access(sidecarPath)
    console.log(`Reusing bundled Node sidecar at ${sidecarPath}`)
    return
  } catch {
    // Download sidecar below.
  }

  const archiveName = nodeArchiveName()
  const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'foliage-node-'))

  if (process.platform === 'win32') {
    const archiveFile = `${archiveName}.zip`
    const downloadUrl = `https://nodejs.org/dist/v${nodeVersion}/${archiveFile}`
    const archivePath = path.join(tempDirectory, archiveFile)

    await downloadFile(downloadUrl, archivePath)
    runCommand(
      `powershell -NoProfile -Command "Expand-Archive -LiteralPath '${archivePath.replace(/'/g, "''")}' -DestinationPath '${tempDirectory.replace(/'/g, "''")}' -Force"`,
    )

    const extractedNode = path.join(tempDirectory, archiveName, 'node.exe')
    await fs.copyFile(extractedNode, sidecarPath)
  } else {
    const archiveFile = `${archiveName}.tar.gz`
    const downloadUrl = `https://nodejs.org/dist/v${nodeVersion}/${archiveFile}`
    const archivePath = path.join(tempDirectory, archiveFile)

    await downloadFile(downloadUrl, archivePath)
    runCommand(`tar -xzf "${archivePath}" -C "${tempDirectory}"`)

    const extractedNode = path.join(tempDirectory, archiveName, 'bin', 'node')
    await fs.copyFile(extractedNode, sidecarPath)
    await fs.chmod(sidecarPath, 0o755)
  }

  await fs.rm(tempDirectory, { recursive: true, force: true })

  console.log(`Bundled Node sidecar at ${sidecarPath}`)
}

const deployServer = async () => {
  const deployTarget = path.join('apps', 'desktop', 'src-tauri', 'resources', 'foliage-server')

  runCommand(
    `${pnpmCommand()} --filter foliage-server deploy --config.node-linker=hoisted ${deployTarget}`,
    { cwd: repoRoot },
  )

  const deployedServerDirectory = path.join(serverDirectory)
  await fs.writeFile(
    path.join(deployedServerDirectory, '.npmrc'),
    'node-linker=hoisted\n',
  )

  runCommand(`${pnpmCommand()} install --prod --ignore-workspace`, {
    cwd: deployedServerDirectory,
  })

  const nodeModulesDirectory = path.join(deployedServerDirectory, 'node_modules')

  try {
    await fs.access(nodeModulesDirectory)
    await removeBrokenSymlinks(nodeModulesDirectory)
  } catch {
    // node_modules missing.
  }
}

await fs.rm(resourcesDirectory, { recursive: true, force: true })
await fs.mkdir(resourcesDirectory, { recursive: true })

await deployServer()
await downloadBundledNodeSidecar()

console.log(`Bundled release resources at ${resourcesDirectory}`)
