'use client'

import {
  Menubar as MenubarRoot,
  MenubarContent,
  MenubarGroup,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarTrigger,
} from '@workspace/ui/components/menubar'
import { useRouter } from 'next/navigation'
import React from 'react'

import { useCommandPalette } from '@/hooks/use-command-palette'
import { executeMenuAction } from '@/lib/menu-actions'
import { isTauri } from '@/lib/tauri-client'
const Menubar = () => {
  const router = useRouter()
  const { setOpen: setCommandPaletteOpen, navigateToPath } = useCommandPalette()

  if (isTauri()) {
    return null
  }

  const runAction = (action: Parameters<typeof executeMenuAction>[0]) => {
    void executeMenuAction(action, {
      navigateToLauncher: () => {
        router.push('/launcher')
      },
      openAbout: () => {
        setCommandPaletteOpen(true)
        navigateToPath(['help.about'])
      },
    })
  }

  return (
    <MenubarRoot className="bg-secondary border-0">
      <MenubarMenu>
        <MenubarTrigger className="font-bold">Openmd</MenubarTrigger>
        <MenubarContent>
          <MenubarItem onClick={() => void runAction('about')}>About Openmd</MenubarItem>
          <MenubarSeparator />
          <MenubarItem onClick={() => void runAction('report_bug')}>Report a bug</MenubarItem>
        </MenubarContent>
      </MenubarMenu>

      <MenubarMenu>
        <MenubarTrigger>File</MenubarTrigger>
        <MenubarContent>
          <MenubarGroup>
            <MenubarItem onClick={() => void runAction('open_project')}>Open project…</MenubarItem>
            <MenubarItem onClick={() => void runAction('close_project')}>Close project</MenubarItem>
          </MenubarGroup>
          <MenubarSeparator />
          <MenubarGroup>
            <MenubarItem onClick={() => void runAction('leafmark')}>Leafmark…</MenubarItem>
            <MenubarItem onClick={() => void runAction('export')}>Export</MenubarItem>
            <MenubarItem onClick={() => void runAction('live_share')}>Start live share…</MenubarItem>
          </MenubarGroup>
        </MenubarContent>
      </MenubarMenu>
    </MenubarRoot>
  )
}

export default Menubar
