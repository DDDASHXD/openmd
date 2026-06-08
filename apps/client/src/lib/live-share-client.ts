import { backendFetch } from '@/lib/backend-client'
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

  const startResponse = await backendFetch('/api/live-share/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      relayUrl,
      sessionId: data.sessionId,
    }),
  })

  const startData = (await startResponse.json()) as { error?: string }

  if (!startResponse.ok) {
    throw new Error(startData.error ?? 'Unable to start live share tunnel.')
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

  await backendFetch('/api/live-share/stop', { method: 'POST' }).catch(() => undefined)

  useSessionStore.getState().setShareUrl(null)

  if (useSessionStore.getState().mode === 'live-share-host') {
    useSessionStore.getState().setMode('local')
  }
}
