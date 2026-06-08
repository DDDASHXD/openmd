const SEMVER_PATTERN = /^(\d+)\.(\d+)\.(\d+)$/

export const parseSemver = (version) => {
  const match = version.trim().match(SEMVER_PATTERN)

  if (!match) {
    throw new Error(`Invalid semver "${version}". Expected format: MAJOR.MINOR.PATCH`)
  }

  return {
    major: Number.parseInt(match[1], 10),
    minor: Number.parseInt(match[2], 10),
    patch: Number.parseInt(match[3], 10),
  }
}

export const formatSemver = ({ major, minor, patch }) => `${major}.${minor}.${patch}`

export const bumpSemver = (version, bumpType) => {
  const parts = parseSemver(version)

  if (bumpType === 'major') {
    return formatSemver({ major: parts.major + 1, minor: 0, patch: 0 })
  }

  if (bumpType === 'minor') {
    return formatSemver({ major: parts.major, minor: parts.minor + 1, patch: 0 })
  }

  if (bumpType === 'patch') {
    return formatSemver({
      major: parts.major,
      minor: parts.minor,
      patch: parts.patch + 1,
    })
  }

  throw new Error(`Unknown bump type "${bumpType}". Use patch, minor, or major.`)
}

export const toReleaseTag = (version) => `v${version}`

export const fromReleaseTag = (tag) => {
  const normalized = tag.trim()

  if (!normalized.startsWith('v')) {
    throw new Error(`Release tag must start with "v" (received "${tag}").`)
  }

  const version = normalized.slice(1)
  parseSemver(version)

  return version
}
