'use client'

import { LauncherView } from '@/components/launcher'
import { useSessionStore } from '@/stores/session.store'
import { useRouter } from 'next/navigation'
import React from 'react'

export default function LauncherPage() {
  const router = useRouter()
  const mode = useSessionStore((state) => state.mode)

  React.useEffect(() => {
    if (mode !== 'launcher') {
      router.replace('/')
    }
  }, [mode, router])

  if (mode !== 'launcher') {
    return null
  }

  return <LauncherView />
}
