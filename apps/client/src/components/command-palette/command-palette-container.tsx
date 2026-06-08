
import React from 'react'
import { CommandPalette } from './command-palette'
import { useCommandPalette } from '@/hooks/use-command-palette'

export const CommandPaletteContainer = (): React.ReactElement | null => {
  const {
    open,
    setOpen,
    path,
    navigateToCommand,
    goBack,
    currentCommands,
    canGoBack,
  } = useCommandPalette()

  return (
    <CommandPalette
      open={open}
      onOpenChange={setOpen}
      path={path}
      onNavigate={navigateToCommand}
      onGoBack={goBack}
      canGoBack={canGoBack}
      currentCommands={currentCommands}
    />
  )
}
