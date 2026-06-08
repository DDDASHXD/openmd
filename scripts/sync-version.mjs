import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { parseSemver } from './lib/version.mjs'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDirectory, '..')
const versionFilePath = path.join(repoRoot, 'VERSION')

const packageJsonPaths = [
  'package.json',
  'apps/client/package.json',
  'apps/desktop/package.json',
  'packages/foliage-server/package.json',
  'packages/foliage-relay/package.json',
]

const tauriConfPath = 'apps/desktop/src-tauri/tauri.conf.json'
const cargoTomlPath = 'apps/desktop/src-tauri/Cargo.toml'

const readVersion = async () => {
  const raw = await fs.readFile(versionFilePath, 'utf8')
  const version = raw.trim()
  parseSemver(version)
  return version
}

const updatePackageJson = async (relativePath, version) => {
  const filePath = path.join(repoRoot, relativePath)
  const packageJson = JSON.parse(await fs.readFile(filePath, 'utf8'))
  packageJson.version = version
  await fs.writeFile(filePath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8')
}

const updateTauriConf = async (version) => {
  const filePath = path.join(repoRoot, tauriConfPath)
  const tauriConf = JSON.parse(await fs.readFile(filePath, 'utf8'))
  tauriConf.version = version
  await fs.writeFile(filePath, `${JSON.stringify(tauriConf, null, 2)}\n`, 'utf8')
}

const updateCargoToml = async (version) => {
  const filePath = path.join(repoRoot, cargoTomlPath)
  const cargoToml = await fs.readFile(filePath, 'utf8')
  const updated = cargoToml.replace(
    /^version\s*=\s*"[^"]+"$/m,
    `version = "${version}"`,
  )

  if (updated === cargoToml) {
    throw new Error(`Unable to update version in ${cargoTomlPath}.`)
  }

  await fs.writeFile(filePath, updated, 'utf8')
}

const readPackageVersion = async (relativePath) => {
  const filePath = path.join(repoRoot, relativePath)
  const packageJson = JSON.parse(await fs.readFile(filePath, 'utf8'))
  return packageJson.version
}

const readTauriVersion = async () => {
  const filePath = path.join(repoRoot, tauriConfPath)
  const tauriConf = JSON.parse(await fs.readFile(filePath, 'utf8'))
  return tauriConf.version
}

const readCargoVersion = async () => {
  const filePath = path.join(repoRoot, cargoTomlPath)
  const cargoToml = await fs.readFile(filePath, 'utf8')
  const match = cargoToml.match(/^version\s*=\s*"([^"]+)"/m)

  if (!match) {
    throw new Error(`Unable to read version from ${cargoTomlPath}.`)
  }

  return match[1]
}

const collectVersionState = async () => {
  const sourceVersion = await readVersion()

  const entries = [
    { label: 'VERSION', value: sourceVersion },
    ...(await Promise.all(
      packageJsonPaths.map(async (relativePath) => ({
        label: relativePath,
        value: await readPackageVersion(relativePath),
      })),
    )),
    { label: tauriConfPath, value: await readTauriVersion() },
    { label: cargoTomlPath, value: await readCargoVersion() },
  ]

  return { sourceVersion, entries }
}

const checkVersions = async () => {
  const { sourceVersion, entries } = await collectVersionState()
  const mismatches = entries.filter((entry) => entry.value !== sourceVersion)

  if (mismatches.length === 0) {
    console.log(`Version check passed (${sourceVersion}).`)
    return
  }

  console.error(`Version check failed. SOURCE OF TRUTH: VERSION = ${sourceVersion}`)
  console.error('')

  for (const entry of mismatches) {
    console.error(`  ${entry.label}: ${entry.value}`)
  }

  console.error('')
  console.error('Run: pnpm version:sync')
  process.exit(1)
}

const syncVersions = async () => {
  const version = await readVersion()

  for (const relativePath of packageJsonPaths) {
    await updatePackageJson(relativePath, version)
  }

  await updateTauriConf(version)
  await updateCargoToml(version)

  console.log(`Synced version ${version} across release artifacts.`)
}

const isCheckMode = process.argv.includes('--check')

if (isCheckMode) {
  await checkVersions()
} else {
  await syncVersions()
}
