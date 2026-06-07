import { create } from 'zustand'
import {
  useLeafmarkTheme,
  buildLeafmark,
  fetchLeafmarkFolders,
  fetchLeafmarkProject,
  fetchLeafmarkStatus,
  fetchLeafmarkThemes,
  fetchLeafmarkWatchStatus,
  initLeafmarkProject,
  initLeafmarkTheme,
  startLeafmarkWatch,
  stopLeafmarkWatch,
  updateLeafmarkConfig,
  updateLeafmarkOrder,
  type LeafmarkBuildOptions,
  type LeafmarkBuildResult,
  type LeafmarkFolder,
  type LeafmarkProject,
  type LeafmarkStatus,
  type LeafmarkTheme,
} from '@/lib/leafmark-client'
import { useFilesStore } from '@/stores/files.store'
import { useSettingsStore } from '@/stores/settings.store'

interface LeafmarkStore {
  dialogOpen: boolean
  loading: boolean
  busyAction: string | null
  error: string | null
  lastBuild: LeafmarkBuildResult | null
  lastLog: string | null

  folders: LeafmarkFolder[]
  project: LeafmarkProject | null
  status: LeafmarkStatus | null
  themes: LeafmarkTheme[]
  selectedFolder: string
  buildOptions: LeafmarkBuildOptions
  selectedBundle: string | null
  chapterOrder: string[]
  configJson: string
  themeUrl: string

  setDialogOpen: (open: boolean) => void
  setSelectedFolder: (folder: string) => void
  setBuildOptions: (options: Partial<LeafmarkBuildOptions>) => void
  setSelectedBundle: (bundle: string | null) => void
  setChapterOrder: (order: string[]) => void
  setConfigJson: (value: string) => void
  setThemeUrl: (value: string) => void
  clearError: () => void

  openDialog: () => Promise<void>
  refreshAll: () => Promise<void>
  loadFolders: () => Promise<void>
  loadProject: () => Promise<void>
  loadStatus: () => Promise<void>
  loadThemes: () => Promise<void>
  initProject: () => Promise<void>
  initThemeScaffold: () => Promise<void>
  applyTheme: (theme: string) => Promise<void>
  applyThemeFromUrl: () => Promise<void>
  saveChapterOrder: () => Promise<void>
  saveConfig: () => Promise<void>
  runBuild: () => Promise<LeafmarkBuildResult | null>
  toggleWatch: () => Promise<void>
}

const defaultBuildOptions: LeafmarkBuildOptions = {
  html: false,
  htmlOnly: false,
  noMergeCover: false,
}

const getPreferredFolder = (folders: LeafmarkFolder[]) => {
  const settingsFolder = useSettingsStore.getState().settings.leafmark?.projectFolder

  if (settingsFolder && folders.some((folder) => folder.path === settingsFolder)) {
    return settingsFolder
  }

  const projectFolder = folders.find((folder) => folder.path === 'project')
  if (projectFolder) {
    return projectFolder.path
  }

  const leafmarkFolder = folders.find((folder) => folder.isLeafmarkProject)
  if (leafmarkFolder) {
    return leafmarkFolder.path
  }

  return folders[0]?.path ?? '.'
}

export const useLeafmarkStore = create<LeafmarkStore>()((set, get) => ({
  dialogOpen: false,
  loading: false,
  busyAction: null,
  error: null,
  lastBuild: null,
  lastLog: null,

  folders: [],
  project: null,
  status: null,
  themes: [],
  selectedFolder: '.',
  buildOptions: { ...defaultBuildOptions },
  selectedBundle: null,
  chapterOrder: [],
  configJson: '{}',
  themeUrl: '',

  setDialogOpen: (dialogOpen) => set({ dialogOpen }),
  setSelectedFolder: (selectedFolder) => {
    set({ selectedFolder })
    const current = useSettingsStore.getState().settings
    void useSettingsStore.getState().updateSettings({
      leafmark: {
        projectFolder: selectedFolder,
        buildOptions: current.leafmark?.buildOptions ?? { ...defaultBuildOptions },
      },
    })
    void get().refreshAll()
  },
  setBuildOptions: (options) => {
    const buildOptions = { ...get().buildOptions, ...options }
    set({ buildOptions })
    const current = useSettingsStore.getState().settings
    void useSettingsStore.getState().updateSettings({
      leafmark: {
        projectFolder: current.leafmark?.projectFolder ?? get().selectedFolder,
        buildOptions,
      },
    })
  },
  setSelectedBundle: (selectedBundle) => {
    set({ selectedBundle })
    void get().loadStatus()
  },
  setChapterOrder: (chapterOrder) => set({ chapterOrder }),
  setConfigJson: (configJson) => set({ configJson }),
  setThemeUrl: (themeUrl) => set({ themeUrl }),
  clearError: () => set({ error: null }),

  openDialog: async () => {
    const settings = useSettingsStore.getState().settings
    const savedOptions = settings.leafmark?.buildOptions ?? defaultBuildOptions

    set({
      dialogOpen: true,
      error: null,
      buildOptions: { ...defaultBuildOptions, ...savedOptions },
      selectedFolder: settings.leafmark?.projectFolder ?? '.',
    })

    await get().refreshAll()
  },

  refreshAll: async () => {
    set({ loading: true, error: null })

    try {
      await get().loadFolders()
      await Promise.all([get().loadProject(), get().loadStatus(), get().loadThemes()])
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load Leafmark data.',
      })
    } finally {
      set({ loading: false })
    }
  },

  loadFolders: async () => {
    const { folders } = await fetchLeafmarkFolders()
    const selectedFolder = get().selectedFolder
    const nextFolder = folders.some((folder) => folder.path === selectedFolder)
      ? selectedFolder
      : getPreferredFolder(folders)

    set({ folders, selectedFolder: nextFolder })
  },

  loadProject: async () => {
    const folder = get().selectedFolder
    const project = await fetchLeafmarkProject(folder)
    const watchStatus = await fetchLeafmarkWatchStatus(folder)

    set({
      project: { ...project, watching: watchStatus.watching },
      chapterOrder: [...project.chapters],
      configJson: JSON.stringify(project.config ?? {}, null, 2),
      selectedBundle: project.bundles.includes(get().selectedBundle ?? '')
        ? get().selectedBundle
        : null,
    })
  },

  loadStatus: async () => {
    const { selectedFolder, selectedBundle } = get()
    const status = await fetchLeafmarkStatus(selectedFolder, selectedBundle)
    set({ status })
  },

  loadThemes: async () => {
    const { themes } = await fetchLeafmarkThemes()
    set({ themes })
  },

  initProject: async () => {
    set({ busyAction: 'init', error: null })

    try {
      await initLeafmarkProject(get().selectedFolder)
      useFilesStore.getState().bumpWorkspace()
      await get().refreshAll()
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to initialize project.' })
    } finally {
      set({ busyAction: null })
    }
  },

  initThemeScaffold: async () => {
    set({ busyAction: 'init-theme', error: null })

    try {
      await initLeafmarkTheme(get().selectedFolder)
      useFilesStore.getState().bumpWorkspace()
      await get().refreshAll()
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to initialize theme.' })
    } finally {
      set({ busyAction: null })
    }
  },

  applyTheme: async (theme) => {
    set({ busyAction: 'theme', error: null })

    try {
      await useLeafmarkTheme(get().selectedFolder, theme)
      useFilesStore.getState().bumpWorkspace()
      await get().loadProject()
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to apply theme.' })
    } finally {
      set({ busyAction: null })
    }
  },

  applyThemeFromUrl: async () => {
    const theme = get().themeUrl.trim()

    if (!theme) {
      set({ error: 'Enter a theme name or GitHub URL.' })
      return
    }

    await get().applyTheme(theme)
    set({ themeUrl: '' })
  },

  saveChapterOrder: async () => {
    set({ busyAction: 'order', error: null })

    try {
      const project = await updateLeafmarkOrder(get().selectedFolder, get().chapterOrder)
      set({ project, chapterOrder: [...project.chapters] })
      await get().loadStatus()
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to save chapter order.' })
    } finally {
      set({ busyAction: null })
    }
  },

  saveConfig: async () => {
    set({ busyAction: 'config', error: null })

    try {
      const config = JSON.parse(get().configJson) as Record<string, unknown>
      const project = await updateLeafmarkConfig(get().selectedFolder, config)
      set({
        project,
        configJson: JSON.stringify(project.config ?? {}, null, 2),
        chapterOrder: [...project.chapters],
      })
      await get().loadStatus()
    } catch (error) {
      set({
        error:
          error instanceof Error
            ? error.message
            : 'Failed to save config. Check that the JSON is valid.',
      })
    } finally {
      set({ busyAction: null })
    }
  },

  runBuild: async () => {
    set({ busyAction: 'build', error: null, lastLog: null })

    try {
      const result = await buildLeafmark(get().selectedFolder, {
        ...get().buildOptions,
        bundle: get().selectedBundle,
      })

      set({ lastBuild: result, lastLog: 'Build completed successfully.' })
      useFilesStore.getState().bumpWorkspace()

      if (result.outputs.pdf) {
        useFilesStore.getState().openFile(result.outputs.pdf)
      } else if (result.outputs.html) {
        useFilesStore.getState().openFile(result.outputs.html)
      }

      return result
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Build failed.'
      set({ error: message, lastLog: message })
      return null
    } finally {
      set({ busyAction: null })
    }
  },

  toggleWatch: async () => {
    const { selectedFolder, buildOptions, project } = get()

    if (!project) {
      return
    }

    set({ busyAction: 'watch', error: null })

    try {
      if (project.watching) {
        await stopLeafmarkWatch(selectedFolder)
      } else {
        await startLeafmarkWatch(selectedFolder, {
          ...buildOptions,
          bundle: get().selectedBundle,
        })
      }

      await get().loadProject()
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to toggle watch mode.' })
    } finally {
      set({ busyAction: null })
    }
  },
}))
