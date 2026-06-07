import { backendFetch, getBackendBaseUrl } from '@/lib/backend-client'

export type LeafmarkBuildOptions = {
  html?: boolean
  htmlOnly?: boolean
  noMergeCover?: boolean
  bundle?: string | null
  chapters?: string[]
}

export type LeafmarkFolder = {
  path: string
  isLeafmarkProject: boolean
}

export type LeafmarkTheme = {
  name: string
  description: string
}

export type LeafmarkStatus = {
  folder: string
  bundle: string | null
  input: string
  chapters: number
  words: number
  charsWithSpaces: number
  charsWithoutSpaces: number
}

export type LeafmarkProject = {
  folder: string
  isLeafmarkProject: boolean
  projectBase: string
  outputRoot: string
  config: Record<string, unknown>
  chapters: string[]
  bundles: string[]
  watching: boolean
}

export type LeafmarkBuildResult = {
  folder: string
  bundle?: string | null
  projectBase: string
  outputs: {
    pdf?: string
    html?: string
  }
}

const parseJson = async <T>(response: Response): Promise<T & { error?: string }> =>
  (await response.json()) as T & { error?: string }

const leafmarkFetch = async <T>(
  init: RequestInit & { action?: string; query?: Record<string, string> },
): Promise<T> => {
  const url = new URL('/api/workspace/leafmark', getBackendBaseUrl())

  if (init.query) {
    for (const [key, value] of Object.entries(init.query)) {
      url.searchParams.set(key, value)
    }
  }

  const response = await backendFetch(url.pathname + url.search, init)
  const data = await parseJson<T>(response)

  if (!response.ok) {
    throw new Error(data.error ?? 'Leafmark request failed.')
  }

  return data
}

export const fetchLeafmarkFolders = () =>
  leafmarkFetch<{ folders: LeafmarkFolder[] }>({
    method: 'GET',
    query: { action: 'folders' },
  })

export const fetchLeafmarkProject = (folder: string) =>
  leafmarkFetch<LeafmarkProject>({
    method: 'GET',
    query: { action: 'project', folder },
  })

export const fetchLeafmarkStatus = (folder: string, bundle?: string | null) =>
  leafmarkFetch<LeafmarkStatus>({
    method: 'GET',
    query: {
      action: 'status',
      folder,
      ...(bundle ? { bundle } : {}),
    },
  })

export const fetchLeafmarkThemes = () =>
  leafmarkFetch<{ themes: LeafmarkTheme[] }>({
    method: 'GET',
    query: { action: 'themes' },
  })

export const fetchLeafmarkWatchStatus = (folder: string) =>
  leafmarkFetch<{ watching: boolean; folder: string }>({
    method: 'GET',
    query: { action: 'watch-status', folder },
  })

export const postLeafmark = <T>(payload: Record<string, unknown>) =>
  leafmarkFetch<T>({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

export const buildLeafmark = (folder: string, options: LeafmarkBuildOptions = {}) =>
  postLeafmark<LeafmarkBuildResult>({ action: 'build', folder, options })

export const initLeafmarkProject = (folder: string) =>
  postLeafmark<LeafmarkProject>({ action: 'init', folder })

export const initLeafmarkTheme = (folder: string) =>
  postLeafmark<{ folder: string; message: string }>({ action: 'init-theme', folder })

export const useLeafmarkTheme = (folder: string, theme: string) =>
  postLeafmark<LeafmarkProject>({ action: 'use-theme', folder, theme })

export const updateLeafmarkConfig = (folder: string, config: Record<string, unknown>) =>
  postLeafmark<LeafmarkProject>({ action: 'update-config', folder, config })

export const updateLeafmarkOrder = (folder: string, order: string[]) =>
  postLeafmark<LeafmarkProject>({ action: 'update-order', folder, order })

export const startLeafmarkWatch = (folder: string, options: LeafmarkBuildOptions = {}) =>
  postLeafmark<{ watching: boolean; folder: string }>({
    action: 'watch-start',
    folder,
    options,
  })

export const stopLeafmarkWatch = (folder: string) =>
  postLeafmark<{ watching: boolean; folder: string }>({ action: 'watch-stop', folder })
