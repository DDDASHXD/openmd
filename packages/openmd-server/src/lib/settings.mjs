import fs from 'node:fs/promises'
import path from 'node:path'

export const defaultSettings = {
  theme: 'dark',
  editor: {
    fontSize: 14,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    wordWrap: 'off',
    tabSize: 2,
    markdownPrettierFormat: false,
    markdownPrettierPrintWidth: 88,
    markdownPrettierDebounceMs: 2000,
    rulers: [],
  },
  workspace: {
    maxDirectoryEntries: 500,
    maxUploadBytes: 104857600,
    ignoredDirectories: ['.git', '.next', '.turbo', '.openmd'],
    showHiddenFiles: false,
  },
  leafmark: {
    projectFolder: 'project',
    buildOptions: {
      html: false,
      htmlOnly: false,
      noMergeCover: false,
    },
  },
}

const mergeSettings = (parsed = {}) => {
  const merged = { ...defaultSettings, ...parsed }
  merged.editor = { ...defaultSettings.editor, ...(parsed.editor || {}) }
  merged.editor.minimap = {
    ...defaultSettings.editor.minimap,
    ...(parsed.editor?.minimap || {}),
  }
  merged.workspace = { ...defaultSettings.workspace, ...(parsed.workspace || {}) }
  merged.leafmark = {
    ...defaultSettings.leafmark,
    ...(parsed.leafmark || {}),
    buildOptions: {
      ...defaultSettings.leafmark.buildOptions,
      ...(parsed.leafmark?.buildOptions || {}),
    },
  }

  return merged
}

export const createSettingsHandlers = (workspaceRoot) => {
  const getSettingsPath = () => path.join(workspaceRoot, '.openmd', 'settings.json')

  const ensureOpenmdFolder = async () => {
    const openmdPath = path.join(workspaceRoot, '.openmd')

    try {
      await fs.mkdir(openmdPath, { recursive: true })
    } catch {
      // Folder may already exist
    }
  }

  const loadSettings = async () => {
    const settingsPath = getSettingsPath()

    try {
      const content = await fs.readFile(settingsPath, 'utf8')
      return mergeSettings(JSON.parse(content))
    } catch {
      return mergeSettings({})
    }
  }

  const saveSettings = async (newSettings) => {
    await ensureOpenmdFolder()
    const settingsPath = getSettingsPath()
    const existing = await loadSettings()
    const merged = mergeSettings({
      ...existing,
      ...newSettings,
      editor: { ...existing.editor, ...(newSettings.editor || {}) },
      workspace: { ...existing.workspace, ...(newSettings.workspace || {}) },
      leafmark: {
        ...existing.leafmark,
        ...(newSettings.leafmark || {}),
        buildOptions: {
          ...existing.leafmark?.buildOptions,
          ...(newSettings.leafmark?.buildOptions || {}),
        },
      },
    })

    await fs.writeFile(settingsPath, JSON.stringify(merged, null, 2), 'utf8')
    return merged
  }

  return { ensureOpenmdFolder, loadSettings, saveSettings }
}
