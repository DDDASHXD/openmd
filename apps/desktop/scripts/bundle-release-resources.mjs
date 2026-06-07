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

const bundledNodeArch = () => normalizeNodeArch(process.env.OPENMD_BUNDLE_NODE_ARCH ?? process.arch)

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const desktopDirectory = path.resolve(scriptDirectory, '..')
const repoRoot = path.resolve(desktopDirectory, '../..')
const resourcesDirectory = path.join(desktopDirectory, 'src-tauri/resources')
const serverDirectory = path.join(resourcesDirectory, 'openmd-server')
const relayDirectory = path.join(resourcesDirectory, 'openmd-relay')
const nodeDirectory = path.join(resourcesDirectory, 'node')

const nodeVersion = '20.19.5'

const nodeArchiveName = () => {
  const arch = bundledNodeArch()

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

const downloadBundledNode = async () => {
  const archiveName = nodeArchiveName()
  const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'openmd-node-'))

  await fs.rm(nodeDirectory, { recursive: true, force: true })
  await fs.mkdir(path.join(nodeDirectory, 'bin'), { recursive: true })

  if (process.platform === 'win32') {
    const archiveFile = `${archiveName}.zip`
    const downloadUrl = `https://nodejs.org/dist/v${nodeVersion}/${archiveFile}`
    const archivePath = path.join(tempDirectory, archiveFile)

    await downloadFile(downloadUrl, archivePath)
    runCommand(
      `powershell -NoProfile -Command "Expand-Archive -LiteralPath '${archivePath.replace(/'/g, "''")}' -DestinationPath '${tempDirectory.replace(/'/g, "''")}' -Force"`,
    )

    const extractedNode = path.join(tempDirectory, archiveName, 'node.exe')
    const targetNode = path.join(nodeDirectory, 'bin', 'node.exe')
    await fs.copyFile(extractedNode, targetNode)
  } else {
    const archiveFile = `${archiveName}.tar.gz`
    const downloadUrl = `https://nodejs.org/dist/v${nodeVersion}/${archiveFile}`
    const archivePath = path.join(tempDirectory, archiveFile)

    await downloadFile(downloadUrl, archivePath)
    runCommand(`tar -xzf "${archivePath}" -C "${tempDirectory}"`)

    const extractedNode = path.join(tempDirectory, archiveName, 'bin', 'node')
    const targetNode = path.join(nodeDirectory, 'bin', 'node')

    await fs.copyFile(extractedNode, targetNode)
    await fs.chmod(targetNode, 0o755)
  }

  await fs.rm(tempDirectory, { recursive: true, force: true })
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

const pruneBundledServer = async () => {
  const pathsToRemove = [
    path.join(serverDirectory, 'node_modules', '.bin'),
    path.join(serverDirectory, 'node_modules', 'next'),
    path.join(serverDirectory, 'apps'),
    path.join(serverDirectory, 'README.md'),
    path.join(serverDirectory, 'pnpm-lock.yaml'),
    path.join(serverDirectory, '.npmrc'),
  ]

  await Promise.all(
    pathsToRemove.map((target) => fs.rm(target, { recursive: true, force: true })),
  )

  const nodeModulesDirectory = path.join(serverDirectory, 'node_modules')

  try {
    await fs.access(nodeModulesDirectory)
    await removeBrokenSymlinks(nodeModulesDirectory)
  } catch {
    // node_modules already removed or missing.
  }
}

const copyRelayClient = async () => {
  await fs.rm(relayDirectory, { recursive: true, force: true })
  await fs.mkdir(relayDirectory, { recursive: true })

  await fs.cp(
    path.join(repoRoot, 'packages/openmd-relay/bin/openmd-relay-client.mjs'),
    path.join(relayDirectory, 'openmd-relay-client.mjs'),
  )
}

await fs.rm(resourcesDirectory, { recursive: true, force: true })
await fs.mkdir(resourcesDirectory, { recursive: true })

const deployTarget = path.join('apps', 'desktop', 'src-tauri', 'resources', 'openmd-server')

runCommand(
  `${pnpmCommand()} --filter @openmd/server deploy --config.node-linker=hoisted ${deployTarget}`,
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

await pruneBundledServer()

await copyRelayClient()
await downloadBundledNode()

console.log(`Bundled release resources at ${resourcesDirectory}`)
