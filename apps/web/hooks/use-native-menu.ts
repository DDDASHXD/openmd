'use client'

import { listen } from '@tauri-apps/api/event'
import { useRouter } from 'next/navigation'
import React from 'react'

import { useCommandPalette } from '@/hooks/use-command-palette'
import { executeMenuAction, type MenuActionId } from '@/lib/menu-actions'
import { isTauri } from '@/lib/tauri-client'

const menuActionIds = new Set<MenuActionId>([
  'open_project',
  'close_project',
  'leafmark',
  'export',
  'live_share',
  'about',
  'report_bug',
])

const isMenuActionId = (value: string): value is MenuActionId => menuActionIds.has(value as MenuActionId)

export const useNativeMenu = () => {
  const router = useRouter()
  const { setOpen: setCommandPaletteOpen, navigateToPath } = useCommandPalette()

  React.useEffect(() => {
    if (!isTauri()) {
      return
    }

    let unlisten: (() => void) | undefined

    void listen<string>('menu-action', (event) => {
      if (!isMenuActionId(event.payload)) {
        return
      }

      void executeMenuAction(event.payload, {
        navigateToLauncher: () => {
          router.push('/launcher')
        },
        openAbout: () => {
          setCommandPaletteOpen(true)
          navigateToPath(['help.about'])
        },
      })
    }).then((dispose) => {
      unlisten = dispose
    })

    return () => {
      unlisten?.()
    }
  }, [navigateToPath, router, setCommandPaletteOpen])
}
