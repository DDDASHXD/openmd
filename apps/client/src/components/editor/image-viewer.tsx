
import { getWorkspaceFileUrl } from '@/lib/workspace-editor-kind'
import React from 'react'

export type ImageViewerProps = {
  path: string
}

export const ImageViewer = ({ path }: ImageViewerProps) => {
  return (
    <div className="bg-muted/20 flex min-h-0 min-w-0 flex-1 flex-col p-36">
      <img
        title={path}
        key={path}
        src={getWorkspaceFileUrl(path)}
        className="w-full h-full object-contain"
      />
    </div>
  )
}
