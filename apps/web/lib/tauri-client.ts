import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'

import { useSessionStore } from '@/stores/session.store'

const isTauriRuntime = () => {
  if (typeof window === 'undefined') {
    return false
  }

  return '__TAURI_INTERNALS__' in window || '__TAURI__' in window
}

export const isTauri = () => isTauriRuntime()

const pickDirectory = async (title: string): Promise<string | null> => {
  const result = await open({
    directory: true,
    multiple: false,
    title,
  })

  if (result === null) {
    return null
  }

  return typeof result === 'string' ? result : null
}

export const pickFolder = async (): Promise<string | null> => {
  if (isTauriRuntime()) {
    return pickDirectory('Open project folder')
  }

  const fallback = window.prompt('Enter folder path:')
  return fallback?.trim() || null
}

export const pickParentDirectory = async (): Promise<string | null> => {
  if (isTauriRuntime()) {
    return pickDirectory('Choose where to create the project')
  }

  const fallback = window.prompt('Enter parent folder path:')
  return fallback?.trim() || null
}

export const createProjectOnDisk = async (projectPath: string): Promise<void> => {
  if (isTauriRuntime()) {
    await invoke('create_project', { path: projectPath })
    return
  }

  const { backendFetch } = await import('@/lib/backend-client')
  const response = await backendFetch('/api/workspace/project', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: projectPath }),
  })

  const data = (await response.json()) as { error?: string }

  if (!response.ok) {
    throw new Error(data.error ?? 'Unable to create project.')
  }
}

export const getLocalServerUrl = async (): Promise<string | null> => {
  if (!isTauriRuntime()) {
    return null
  }

  return invoke<string | null>('get_local_server_url')
}

export const startLocalServer = async (workspacePath: string): Promise<{ port: number } | null> => {
  if (isTauriRuntime()) {
    const result = await invoke<{ port: number }>('start_local_server', { workspacePath })

    if (result?.port) {
      useSessionStore.getState().setServerUrl(`http://127.0.0.1:${result.port}`)
    }

    return result
  }

  return null
}

export const stopLocalServer = async (): Promise<void> => {
  if (isTauriRuntime()) {
    await invoke('stop_local_server')
  }
}

export const openEditorWindow = async (): Promise<void> => {
  if (isTauriRuntime()) {
    await invoke('open_editor_window')
  }
}

export const returnToLauncher = async (): Promise<void> => {
  if (isTauriRuntime()) {
    await invoke('return_to_launcher')
  }
}
