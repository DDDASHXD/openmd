
import { MonacoEditor } from '@/components/editor/monaco-editor'
import { MarkdownPreview } from '@/components/editor/markdown-preview'
import { PdfViewer } from '@/components/editor/pdf-viewer'
import { getWorkspaceEditorKind, isMarkdownFile } from '@/lib/workspace-editor-kind'
import { getFoliagePath, hasFoliagePath, isTreeDirectoryDrag } from '@/lib/foliage-dnd'
import { useFilesStore } from '@/stores/files.store'
import React from 'react'
import { Group, Panel, Separator } from 'react-resizable-panels'
import { ImageViewer } from './image-viewer'

export type EditorPaneProps = {
  groupId: string
}

export const EditorPane = ({ groupId }: EditorPaneProps) => {
  const activeFile = useFilesStore((state) => state.groups[groupId]?.activeFile ?? null)
  const previewOpen = useFilesStore((state) => state.previewModeByGroup[groupId] ?? false)
  const openFileInGroup = useFilesStore((state) => state.openFileInGroup)
  const kind = activeFile ? getWorkspaceEditorKind(activeFile) : null
  const showMarkdownPreview = Boolean(activeFile && previewOpen && isMarkdownFile(activeFile))

  const handleDragOver = (event: React.DragEvent) => {
    if (!hasFoliagePath(event.dataTransfer)) {
      return
    }
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    if (isTreeDirectoryDrag(event.dataTransfer)) {
      return
    }
    const path = getFoliagePath(event.dataTransfer)
    if (!path) {
      return
    }
    openFileInGroup(groupId, path)
  }

  const displayEditor = (filePath: string) => {
    switch (kind) {
      case 'text':
        if (showMarkdownPreview) {
          return (
            <Group orientation="horizontal" className="h-full min-h-0 min-w-0 flex-1">
              <Panel defaultSize={50} minSize={20} className="min-h-0 min-w-0">
                <MonacoEditor groupId={groupId} />
              </Panel>
              <Separator className="bg-border w-1 shrink-0" />
              <Panel defaultSize={50} minSize={20} className="min-h-0 min-w-0">
                <MarkdownPreview path={filePath} />
              </Panel>
            </Group>
          )
        }

        return <MonacoEditor groupId={groupId} />
      case 'pdf':
        return <PdfViewer path={filePath} />
      case 'image':
        return <ImageViewer path={filePath} />
      default:
        return null
    }
  }

  return (
    <div
      className="relative flex h-full min-w-0 flex-1 flex-col"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {!activeFile && (
        <div className="bg-background text-muted-foreground flex min-h-0 min-w-0 flex-1 items-center justify-center text-sm">
          Select a file
        </div>
      )}
      {activeFile && displayEditor(activeFile)}
    </div>
  )
}
