'use client'

import React from 'react'

import { getLocalServerUrl, isTauri } from '@/lib/tauri-client'
import { useSessionStore } from '@/stores/session.store'

export const DesktopBootstrap = () => {
  React.useEffect(() => {
    if (!isTauri()) {
      return
    }

    void (async () => {
      const serverUrl = await getLocalServerUrl()

      if (serverUrl) {
        useSessionStore.getState().setServerUrl(serverUrl)
      }
    })()
  }, [])

  return null
}
