import { runLeafmarkExport as runExport } from './leafmark-server.mjs'

export const resolveLeafmarkExportDir = async (workspaceRoot) => {
  const projectDir = `${workspaceRoot}/project`

  try {
    const { statSync } = await import('node:fs')
    if (statSync(projectDir).isDirectory()) {
      return projectDir
    }
  } catch {
    // No project folder at workspace root.
  }

  return workspaceRoot
}

export const runLeafmarkExport = async (workspaceRoot, relativeFolder = '', options = {}) => {
  let folder = relativeFolder

  if (!folder) {
    const { statSync } = await import('node:fs')
    const { join } = await import('node:path')

    try {
      if (statSync(join(workspaceRoot, 'project')).isDirectory()) {
        folder = 'project'
      }
    } catch {
      folder = '.'
    }
  }

  return runExport(workspaceRoot, folder, options)
}
