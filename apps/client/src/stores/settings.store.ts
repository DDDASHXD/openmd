import { backendFetch } from '@/lib/backend-client'
import { create } from 'zustand'

export type WorkspaceSettings = {
  theme: 'dark' | 'light'
  editor: {
    fontSize: number
    minimap: { enabled: boolean }
    scrollBeyondLastLine: boolean
    wordWrap: 'off' | 'on' | 'wordWrapColumn' | 'bounded'
    tabSize: number
    markdownPrettierFormat: boolean
    markdownPrettierPrintWidth: number
    markdownPrettierDebounceMs: number
    rulers: number[]
  }
  workspace: {
    maxDirectoryEntries: number
    maxUploadBytes: number
    ignoredDirectories: string[]
    showHiddenFiles: boolean
  }
  leafmark?: {
    projectFolder: string
    buildOptions: {
      output?: string
      outputFormat?: 'pdf' | 'docx'
      html?: boolean
      htmlOnly?: boolean
      noMergeCover?: boolean
    }
  }
}

const defaultSettings: WorkspaceSettings = {
  theme: 'dark',
  editor: {
    fontSize: 14,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    wordWrap: 'off',
    tabSize: 2,
    // Note: Automatic formatting on type is disabled - use Format Document command instead
    markdownPrettierFormat: false,
    markdownPrettierPrintWidth: 88,
    markdownPrettierDebounceMs: 2000,
    rulers: [],
  },
  workspace: {
    maxDirectoryEntries: 500,
    maxUploadBytes: 104857600,
    ignoredDirectories: ['.git', '.next', '.turbo', '.foliage'],
    showHiddenFiles: false,
  },
  leafmark: {
    projectFolder: 'project',
    buildOptions: {
      output: 'dist',
      outputFormat: 'pdf',
      html: false,
      htmlOnly: false,
      noMergeCover: false,
    },
  },
}

interface SettingsStore {
  settings: WorkspaceSettings
  isLoading: boolean
  error: string | null

  // Actions
  loadSettings: (reload?: boolean) => Promise<void>
  updateSettings: (partialSettings: Partial<WorkspaceSettings>) => Promise<void>
  updateEditorSettings: (editorSettings: Partial<WorkspaceSettings['editor']>) => Promise<void>
  updateWorkspaceSettings: (workspaceSettings: Partial<WorkspaceSettings['workspace']>) => Promise<void>
}

const fetchSettings = async (reload = false): Promise<WorkspaceSettings> => {
  const url = reload ? '/api/workspace/settings?reload=true' : '/api/workspace/settings'
  const response = await backendFetch(url)
  const data = (await response.json()) as { settings?: WorkspaceSettings; error?: string }

  if (!response.ok) {
    throw new Error(data.error ?? 'Unable to load settings.')
  }

  if (!data.settings) {
    throw new Error('Invalid settings response.')
  }

  return data.settings
}

const saveSettings = async (newSettings: Partial<WorkspaceSettings>): Promise<WorkspaceSettings> => {
  const response = await backendFetch('/api/workspace/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newSettings),
  })

  const data = (await response.json()) as { settings?: WorkspaceSettings; error?: string }

  if (!response.ok) {
    throw new Error(data.error ?? 'Unable to save settings.')
  }

  if (!data.settings) {
    throw new Error('Invalid settings response.')
  }

  return data.settings
}

export const useSettingsStore = create<SettingsStore>()((set, get) => ({
  settings: { ...defaultSettings },
  isLoading: false,
  error: null,

  loadSettings: async (reload = false) => {
    set({ isLoading: true, error: null })

    try {
      const settings = await fetchSettings(reload)
      set({ settings, isLoading: false })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load settings.',
        isLoading: false,
      })
    }
  },

  updateSettings: async (partialSettings) => {
    set({ isLoading: true, error: null })

    try {
      const updated = await saveSettings(partialSettings)
      set({ settings: updated, isLoading: false })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to save settings.',
        isLoading: false,
      })
    }
  },

  updateEditorSettings: async (editorSettings) => {
    const { settings } = get()
    await get().updateSettings({
      editor: { ...settings.editor, ...editorSettings },
    })
  },

  updateWorkspaceSettings: async (workspaceSettings) => {
    const { settings } = get()
    await get().updateSettings({
      workspace: { ...settings.workspace, ...workspaceSettings },
    })
  },
}))
