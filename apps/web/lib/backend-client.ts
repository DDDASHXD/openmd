import { useSessionStore } from '@/stores/session.store'

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, '')

export const getBackendBaseUrl = (): string => {
  if (typeof window === 'undefined') {
    return ''
  }

  const override = useSessionStore.getState().serverUrl

  if (override) {
    return normalizeBaseUrl(override)
  }

  return window.location.origin
}

export const getBackendWebSocketBase = (): string => {
  const baseUrl = getBackendBaseUrl()
  const parsed = new URL(baseUrl)
  const protocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:'

  return `${protocol}//${parsed.host}`
}

export const getCollaborationWsUrl = (): string => {
  return `${getBackendWebSocketBase()}/collaboration`
}

export const backendFetch = async (path: string, init?: RequestInit): Promise<Response> => {
  const url = path.startsWith('http') ? path : `${getBackendBaseUrl()}${path}`

  return fetch(url, init)
}

export const getWorkspaceFileUrl = (relativePath: string): string => {
  return `${getBackendBaseUrl()}/api/workspace/file?path=${encodeURIComponent(relativePath)}`
}

export const checkServerHealth = async (serverUrl: string): Promise<boolean> => {
  try {
    const response = await fetch(`${normalizeBaseUrl(serverUrl)}/api/health`)

    if (!response.ok) {
      return false
    }

    const data = (await response.json()) as { ok?: boolean }
    return data.ok === true
  } catch {
    return false
  }
}
