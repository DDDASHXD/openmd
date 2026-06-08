
import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

import { checkServerHealth } from '@/lib/backend-client'
import { getLocalServerUrl, isTauri } from '@/lib/tauri-client'
import { useSessionStore } from '@/stores/session.store'

export const DesktopBootstrap = () => {
  const navigate = useNavigate()
  const location = useLocation()

  React.useEffect(() => {
    if (!isTauri()) {
      return
    }

    void (async () => {
      const onLauncherRoute = location.pathname.startsWith('/launcher')

      if (onLauncherRoute) {
        useSessionStore.getState().clearSession()
      }

      const serverUrl = await getLocalServerUrl()

      if (!serverUrl) {
        if (!onLauncherRoute) {
          useSessionStore.getState().clearSession()
          navigate('/launcher', { replace: true })
        }

        return
      }

      useSessionStore.getState().setServerUrl(serverUrl)

      if (!onLauncherRoute) {
        const healthy = await checkServerHealth(serverUrl)

        if (!healthy) {
          useSessionStore.getState().clearSession()
          navigate('/launcher', { replace: true })
        }
      }
    })()
  }, [location.pathname, navigate])

  return null
}
