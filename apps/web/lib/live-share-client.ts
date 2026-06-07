import { invoke } from '@tauri-apps/api/core'

import { backendFetch } from '@/lib/backend-client'
import { isTauri } from '@/lib/tauri-client'
import { useSessionStore } from '@/stores/session.store'

type RelaySessionResponse = {
  sessionId: string
  publicUrl: string
  error?: string
}

export const startLiveShare = async (): Promise<string> => {
  const relayUrl = useSessionStore.getState().relayUrl.replace(/\/+$/, '')

  const response = await fetch(`${relayUrl}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })

  const data = (await response.json()) as RelaySessionResponse

  if (!response.ok || !data.publicUrl) {
    throw new Error(data.error ?? 'Unable to create live share session.')
  }

  if (isTauri()) {
    await invoke('start_live_share', {
      relayUrl,
      sessionId: data.sessionId,
    })
  } else {
    const health = await backendFetch('/api/health')
    const healthData = (await health.json()) as { ok?: boolean }

    if (!healthData.ok) {
      throw new Error('Local server is not running.')
    }

    console.info(
      `Live share session ${data.sessionId} created. Run: openmd-relay-client --relay-url ${relayUrl} --session-id ${data.sessionId} --local-port ${window.location.port || '3000'}`,
    )
  }

  useSessionStore.getState().setShareUrl(data.publicUrl)
  useSessionStore.getState().setMode('live-share-host')

  return data.publicUrl
}

export const stopLiveShare = async (): Promise<void> => {
  const shareUrl = useSessionStore.getState().shareUrl

  if (!shareUrl) {
    return
  }

  const relayUrl = useSessionStore.getState().relayUrl.replace(/\/+$/, '')
  const sessionId = shareUrl.split('/p/')[1]?.split('/')[0]

  if (sessionId) {
    await fetch(`${relayUrl}/sessions/${sessionId}`, { method: 'DELETE' }).catch(() => undefined)
  }

  if (isTauri()) {
    await invoke('stop_live_share').catch(() => undefined)
  }

  useSessionStore.getState().setShareUrl(null)

  if (useSessionStore.getState().mode === 'live-share-host') {
    useSessionStore.getState().setMode('local')
  }
}
