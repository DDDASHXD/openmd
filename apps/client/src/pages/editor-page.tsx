import React from 'react'
import { useNavigate } from 'react-router-dom'

import Sidebar from '@/components/sidebar/sidebar'
import { EditorLayoutRoot } from '@/components/editor/editor-layout-root'
import Menubar from '@/components/menubar'
import { useSessionStore } from '@/stores/session.store'
import Statusbar from '@/components/statusbar'
import { CommandPaletteContainer } from '@/components/command-palette'
import { LeafmarkDialogContainer } from '@/components/leafmark/leafmark-dialog-container'

export const EditorPage = () => {
  const navigate = useNavigate()
  const mode = useSessionStore((state) => state.mode)

  React.useEffect(() => {
    if (mode === 'launcher') {
      navigate('/launcher', { replace: true })
    }
  }, [mode, navigate])

  if (mode === 'launcher') {
    return null
  }

  return (
    <div className="w-screen h-screen flex flex-col">
      <Menubar />
      <div className="flex min-h-0 min-w-0 flex-1">
        <Sidebar />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-1">
          <EditorLayoutRoot />
        </div>
      </div>
      <Statusbar />
      <CommandPaletteContainer />
      <LeafmarkDialogContainer />
    </div>
  )
}
