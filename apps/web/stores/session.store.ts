import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type SessionMode = 'launcher' | 'local' | 'server' | 'live-share-host' | 'live-share-guest'

export type RecentProject = {
  id: string
  label: string
  kind: 'local' | 'server' | 'live-share'
  workspacePath?: string
  serverUrl?: string
  lastOpenedAt: string
}

type SessionStore = {
  mode: SessionMode
  workspacePath: string | null
  serverUrl: string | null
  relayUrl: string
  shareUrl: string | null
  recents: RecentProject[]

  setMode: (mode: SessionMode) => void
  setWorkspacePath: (path: string | null) => void
  setServerUrl: (url: string | null) => void
  setRelayUrl: (url: string) => void
  setShareUrl: (url: string | null) => void
  addRecent: (project: Omit<RecentProject, 'lastOpenedAt'>) => void
  removeRecent: (id: string) => void
  clearSession: () => void
  startLocalSession: (workspacePath: string, label?: string) => void
  startRemoteSession: (serverUrl: string, label: string, kind: 'server' | 'live-share') => void
}

const defaultRelayUrl = 'https://openmd.skxv.dev'

const createRecentId = (project: Omit<RecentProject, 'lastOpenedAt' | 'id'>) => {
  if (project.kind === 'local' && project.workspacePath) {
    return `local:${project.workspacePath}`
  }

  if (project.serverUrl) {
    return `${project.kind}:${project.serverUrl}`
  }

  return `${project.kind}:${project.label}`
}

export const useSessionStore = create<SessionStore>()(
  persist(
    (set, get) => ({
      mode: 'launcher',
      workspacePath: null,
      serverUrl: null,
      relayUrl: defaultRelayUrl,
      shareUrl: null,
      recents: [],

      setMode: (mode) => set({ mode }),
      setWorkspacePath: (workspacePath) => set({ workspacePath }),
      setServerUrl: (serverUrl) => set({ serverUrl }),
      setRelayUrl: (relayUrl) => set({ relayUrl }),
      setShareUrl: (shareUrl) => set({ shareUrl }),

      addRecent: (project) => {
        const id = createRecentId(project)
        const entry: RecentProject = {
          ...project,
          id,
          lastOpenedAt: new Date().toISOString(),
        }

        const filtered = get().recents.filter((item) => item.id !== id)

        set({
          recents: [entry, ...filtered].slice(0, 20),
        })
      },

      removeRecent: (id) => {
        set({ recents: get().recents.filter((item) => item.id !== id) })
      },

      clearSession: () => {
        set({
          mode: 'launcher',
          workspacePath: null,
          serverUrl: null,
          shareUrl: null,
        })
      },

      startLocalSession: (workspacePath, label) => {
        const name = label ?? workspacePath.split(/[/\\]/).pop() ?? workspacePath

        set({
          mode: 'local',
          workspacePath,
          serverUrl: null,
          shareUrl: null,
        })

        get().addRecent({
          id: `local:${workspacePath}`,
          label: name,
          kind: 'local',
          workspacePath,
        })
      },

      startRemoteSession: (serverUrl, label, kind) => {
        set({
          mode: kind === 'live-share' ? 'live-share-guest' : 'server',
          workspacePath: null,
          serverUrl,
          shareUrl: kind === 'live-share' ? serverUrl : null,
        })

        get().addRecent({
          id: `${kind}:${serverUrl}`,
          label,
          kind,
          serverUrl,
        })
      },
    }),
    {
      name: 'openmd-session',
      partialize: (state) => ({
        mode: state.mode,
        workspacePath: state.workspacePath,
        serverUrl: state.serverUrl,
        shareUrl: state.shareUrl,
        relayUrl: state.relayUrl,
        recents: state.recents,
      }),
    },
  ),
)
