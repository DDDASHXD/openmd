import React from 'react'
import { useNavigate } from 'react-router-dom'

import { LauncherView } from '@/components/launcher'
import { useSessionStore } from '@/stores/session.store'

export const LauncherPage = () => {
  const navigate = useNavigate()
  const mode = useSessionStore((state) => state.mode)

  React.useEffect(() => {
    if (mode !== 'launcher') {
      navigate('/', { replace: true })
    }
  }, [mode, navigate])

  if (mode !== 'launcher') {
    return null
  }

  return <LauncherView />
}
