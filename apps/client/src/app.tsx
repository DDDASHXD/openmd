import React from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

import { DesktopBootstrap } from '@/components/desktop-bootstrap'
import { MenuOverlays } from '@/components/menu-overlays'
import { NativeMenuListener } from '@/components/native-menu-listener'
import { ThemeProvider } from '@/components/theme-provider'
import { SettingsProvider } from '@/components/settings-provider'
import { CommandPaletteProvider } from '@/hooks/use-command-palette'
import { EditorPage } from '@/pages/editor-page'
import { LauncherPage } from '@/pages/launcher-page'

export const App = () => {
  return (
    <ThemeProvider>
      <SettingsProvider>
        <CommandPaletteProvider>
          <DesktopBootstrap />
          <NativeMenuListener />
          <Routes>
            <Route path="/launcher" element={<LauncherPage />} />
            <Route path="/" element={<EditorPage />} />
            <Route path="*" element={<Navigate to="/launcher" replace />} />
          </Routes>
          <MenuOverlays />
        </CommandPaletteProvider>
      </SettingsProvider>
    </ThemeProvider>
  )
}
