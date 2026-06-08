
import { getWorkspaceFileUrl } from '@/lib/workspace-editor-kind'
import React from 'react'

export type PdfViewerProps = {
  path: string
}

export const PdfViewer = ({ path }: PdfViewerProps) => {
  return (
    <div className="bg-muted/20 flex min-h-0 min-w-0 flex-1 flex-col">
      <iframe
        title={path}
        key={path}
        src={getWorkspaceFileUrl(path)}
        className="h-full min-h-0 w-full min-w-0 flex-1 border-0"
      />
    </div>
  )
}
