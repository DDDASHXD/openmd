'use client'

import React from 'react'
import { useCollaborationStore } from '@/stores/collaboration.store'
import { useSessionStore } from '@/stores/session.store'

const Statusbar = () => {
  const connectionStatus = useCollaborationStore((state) => state.connectionStatus)
  const collaborators = useCollaborationStore((state) => state.collaborators)
  const mode = useSessionStore((state) => state.mode)
  const shareUrl = useSessionStore((state) => state.shareUrl)

  const remoteCollaborators = collaborators.filter((collaborator) => !collaborator.isLocal)
  const showConnectionStatus =
    mode === 'server' ||
    mode === 'live-share-host' ||
    mode === 'live-share-guest' ||
    remoteCollaborators.length > 0

  return (
    <div className="w-full bg-secondary border-t px-2 py-1 text-xs flex items-center gap-4">
      {showConnectionStatus && (
        <span>
          Websocket: <span className="capitalize">{connectionStatus}</span>
        </span>
      )}
      {shareUrl && (
        <span className="text-muted-foreground truncate">Live share: {shareUrl}</span>
      )}
    </div>
  )
}

export default Statusbar
