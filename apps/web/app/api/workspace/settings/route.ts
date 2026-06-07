import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import process from 'process'

const defaultSettings = {
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

const getWorkspaceRoot = () => {
  // In dev mode with custom server, we need to match the server's workspace
  const serverWorkspace = process.env.OPENMD_WORKSPACE
  if (serverWorkspace) {
    return path.resolve(serverWorkspace)
  }
  // Default to process.cwd() which should be the workspace when running via server.mjs
  return process.cwd()
}

const getSettingsPath = () => path.join(getWorkspaceRoot(), '.openmd', 'settings.json')

const ensureOpenmdFolder = async () => {
  const openmdPath = path.join(getWorkspaceRoot(), '.openmd')
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
    const parsed = JSON.parse(content)

    // Merge with defaults to ensure all fields exist
    const merged = { ...defaultSettings, ...parsed }
    merged.editor = { ...defaultSettings.editor, ...(parsed.editor || {}) }
    merged.editor.minimap = { ...defaultSettings.editor.minimap, ...(parsed.editor?.minimap || {}) }
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
  } catch {
    // Return defaults if loading fails
    return { ...defaultSettings }
  }
}

const saveSettings = async (newSettings: Record<string, unknown>) => {
  await ensureOpenmdFolder()
  const settingsPath = getSettingsPath()

  // First load existing settings
  const existing = await loadSettings()

  // Merge with new settings
  const merged = {
    ...existing,
    ...newSettings,
    editor: { ...existing.editor, ...(newSettings.editor as Record<string, unknown> || {}) },
    workspace: { ...existing.workspace, ...(newSettings.workspace as Record<string, unknown> || {}) },
    leafmark: {
      ...existing.leafmark,
      ...(newSettings.leafmark as Record<string, unknown> || {}),
      buildOptions: {
        ...existing.leafmark?.buildOptions,
        ...((newSettings.leafmark as { buildOptions?: Record<string, unknown> } | undefined)?.buildOptions || {}),
      },
    },
  }

  await fs.writeFile(settingsPath, JSON.stringify(merged, null, 2), 'utf8')
  return merged
}

export async function GET() {
  try {
    await ensureOpenmdFolder()
    const settings = await loadSettings()
    return NextResponse.json({ settings })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to load settings.' },
      { status: 400 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>
    const settings = await saveSettings(body)
    return NextResponse.json({ settings })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to save settings.' },
      { status: 400 },
    )
  }
}
