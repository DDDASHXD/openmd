import { execSync } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  bumpSemver,
  fromReleaseTag,
  parseSemver,
  toReleaseTag,
} from './lib/version.mjs'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDirectory, '..')
const versionFilePath = path.join(repoRoot, 'VERSION')

const usage = `Usage:
  pnpm release:patch
  pnpm release:minor
  pnpm release:major
  pnpm release -- 1.2.3

Options:
  --dry-run   Print the planned release without writing files or creating a git tag
  --no-git    Bump and sync only; skip commit and tag
  --push      Push commit and tag to origin after creating them`

const readArgs = () => {
  const args = process.argv.slice(2)
  const flags = new Set(args.filter((arg) => arg.startsWith('--')))
  const positional = args.filter((arg) => !arg.startsWith('--'))

  return {
    dryRun: flags.has('--dry-run'),
    noGit: flags.has('--no-git'),
    push: flags.has('--push'),
    positional,
  }
}

const readCurrentVersion = async () => {
  const raw = await fs.readFile(versionFilePath, 'utf8')
  const version = raw.trim()
  parseSemver(version)
  return version
}

const writeVersion = async (version) => {
  await fs.writeFile(versionFilePath, `${version}\n`, 'utf8')
}

const run = (command) => {
  execSync(command, {
    cwd: repoRoot,
    stdio: 'inherit',
  })
}

const resolveNextVersion = (currentVersion, positional) => {
  if (positional.length === 0) {
    throw new Error('Release target is required.\n\n' + usage)
  }

  const target = positional[0]

  if (target === 'patch' || target === 'minor' || target === 'major') {
    return bumpSemver(currentVersion, target)
  }

  if (target.startsWith('v')) {
    return fromReleaseTag(target)
  }

  parseSemver(target)
  return target
}

const { dryRun, noGit, push, positional } = readArgs()

try {
  const currentVersion = await readCurrentVersion()
  const nextVersion = resolveNextVersion(currentVersion, positional)
  const releaseTag = toReleaseTag(nextVersion)

  console.log(`Release plan: ${currentVersion} -> ${nextVersion} (${releaseTag})`)

  if (dryRun) {
    console.log('Dry run complete. No files or git state were changed.')
    process.exit(0)
  }

  await writeVersion(nextVersion)
  run('node scripts/sync-version.mjs')

  if (noGit) {
    console.log('')
    console.log(`Version bumped to ${nextVersion}.`)
    console.log('Skipped git commit and tag (--no-git).')
    process.exit(0)
  }

  run('git add VERSION package.json apps/client/package.json apps/desktop/package.json packages/foliage-server/package.json packages/foliage-relay/package.json apps/desktop/src-tauri/tauri.conf.json apps/desktop/src-tauri/Cargo.toml')
  run(`git commit -m "release: ${releaseTag}"`)
  run(`git tag ${releaseTag}`)

  console.log('')
  console.log(`Created ${releaseTag}.`)

  if (push) {
    run('git push origin HEAD')
    run(`git push origin ${releaseTag}`)
    console.log('')
    console.log('Pushed commit and tag. GitHub Actions will build desktop release assets.')
  } else {
    console.log('')
    console.log('Next steps:')
    console.log(`  git push origin HEAD`)
    console.log(`  git push origin ${releaseTag}`)
    console.log('')
    console.log('Pushing the tag triggers the Release Desktop workflow on GitHub Actions.')
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  console.error('')
  console.error(usage)
  process.exit(1)
}
