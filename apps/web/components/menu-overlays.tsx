'use client'

import React from 'react'

import { AlertDialog } from '@/components/dialogs/alert-dialog'
import { LiveShareDialog } from '@/components/live-share'
import { useMenuUiStore } from '@/stores/menu-ui.store'

export const MenuOverlays = () => {
  const liveShareOpen = useMenuUiStore((state) => state.liveShareOpen)
  const setLiveShareOpen = useMenuUiStore((state) => state.setLiveShareOpen)
  const exportErrorOpen = useMenuUiStore((state) => state.exportErrorOpen)
  const exportErrorMessage = useMenuUiStore((state) => state.exportErrorMessage)
  const clearExportError = useMenuUiStore((state) => state.clearExportError)

  return (
    <>
      <LiveShareDialog open={liveShareOpen} onOpenChange={setLiveShareOpen} />
      <AlertDialog
        open={exportErrorOpen}
        onOpenChange={(open) => {
          if (!open) {
            clearExportError()
          }
        }}
        title="Export failed"
        description={exportErrorMessage}
        onConfirm={clearExportError}
      />
    </>
  )
}
