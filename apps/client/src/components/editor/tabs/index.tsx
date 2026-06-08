
import React from 'react'
import { useCollaborationStore } from '@/stores/collaboration.store'
import { useFilesStore, type OpenFile } from '@/stores/files.store'
import { cn } from '@workspace/ui/lib/utils'
import { Toggle } from '@workspace/ui/components/toggle'
import {
  getFoliagePath,
  hasFoliagePath,
  isTreeDirectoryDrag,
  setFoliageDragData,
} from '@/lib/foliage-dnd'
import { isMarkdownFile } from '@/lib/workspace-editor-kind'
import { Eye, X } from 'lucide-react'

const reorderTabIndex = (fromIndex: number, targetFinalIndex: number, length: number) => {
  let toAfterRemove = targetFinalIndex
  if (fromIndex < targetFinalIndex) {
    toAfterRemove = targetFinalIndex - 1
  }
  if (toAfterRemove < 0) {
    return 0
  }
  if (toAfterRemove > length - 1) {
    return length - 1
  }
  return toAfterRemove
}

const TabRow = ({
  groupId,
  path,
  name,
  tabIndex,
  isActive,
  openFiles,
}: {
  groupId: string
  path: string
  name: string
  tabIndex: number
  isActive: boolean
  openFiles: OpenFile[]
}) => {
  const closeFileInGroup = useFilesStore((state) => state.closeFileInGroup)
  const setActiveFileInGroup = useFilesStore((state) => state.setActiveFileInGroup)
  const reorderFilesInGroup = useFilesStore((state) => state.reorderFilesInGroup)
  const openFileInGroup = useFilesStore((state) => state.openFileInGroup)
  const setFileDragActive = useFilesStore((state) => state.setFileDragActive)

  const handleClose = (event: React.MouseEvent) => {
    event.stopPropagation()
    closeFileInGroup(groupId, path)
  }

  const handleDragStart = (event: React.DragEvent) => {
    setFoliageDragData(event.dataTransfer, path, { sourceGroupId: groupId })
    event.dataTransfer.effectAllowed = 'move'
    setFileDragActive(true)
    useFilesStore.getState().setTreeDragSource(path, false)
  }

  const handleDragEnd = () => {
    setFileDragActive(false)
  }

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
    const dragPath = getFoliagePath(event.dataTransfer)
    if (!dragPath) {
      return
    }

    const fromIndex = openFiles.findIndex((f) => f.path === dragPath)
    if (fromIndex === -1) {
      if (isTreeDirectoryDrag(event.dataTransfer)) {
        return
      }
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
      const before = event.clientX < rect.left + rect.width / 2
      const insertAt = before ? tabIndex : tabIndex + 1
      openFileInGroup(groupId, dragPath, insertAt)
      return
    }

    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    const before = event.clientX < rect.left + rect.width / 2
    const targetFinalIndex = before ? tabIndex : tabIndex + 1
    const toIndex = reorderTabIndex(fromIndex, targetFinalIndex, openFiles.length)
    reorderFilesInGroup(groupId, fromIndex, toIndex)
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={cn(
        'px-4 py-2 cursor-default border-r border-b flex items-center gap-2 select-none shrink-0',
        isActive && 'bg-background text-foreground border-b-0',
      )}
      onClick={() => setActiveFileInGroup(groupId, path)}
    >
      <span className="text-sm whitespace-nowrap">{name}</span>
      <button
        type="button"
        onClick={handleClose}
        className="hover:bg-muted-foreground/20 rounded p-0.5 transition-colors w-max whitespace-nowrap"
      >
        <X size={14} />
      </button>
    </div>
  )
}

const EditorTabs = ({ groupId }: { groupId: string }) => {
  const collaborators = useCollaborationStore((state) => state.collaborators)
  const group = useFilesStore((state) => state.groups[groupId])
  const previewOpen = useFilesStore((state) => state.previewModeByGroup[groupId] ?? false)
  const togglePreviewMode = useFilesStore((state) => state.togglePreviewMode)
  const reorderFilesInGroup = useFilesStore((state) => state.reorderFilesInGroup)
  const openFileInGroup = useFilesStore((state) => state.openFileInGroup)
  const setFileDragActive = useFilesStore((state) => state.setFileDragActive)

  const openFiles = group?.openFiles ?? []
  const activeFile = group?.activeFile ?? null
  const showPreviewToggle = Boolean(activeFile && isMarkdownFile(activeFile))
  const remoteCollaborators = collaborators.filter((collaborator) => !collaborator.isLocal)
  const showToolbar = openFiles.length > 0 && (showPreviewToggle || remoteCollaborators.length > 0)

  const handleStripDragOver = (event: React.DragEvent) => {
    if (hasFoliagePath(event.dataTransfer)) {
      event.preventDefault()
      event.dataTransfer.dropEffect = 'move'
    }
  }

  const handleStripDrop = (event: React.DragEvent) => {
    event.preventDefault()
    const dragPath = getFoliagePath(event.dataTransfer)
    if (!dragPath) {
      return
    }

    const fromIndex = openFiles.findIndex((f) => f.path === dragPath)
    if (fromIndex === -1) {
      if (!isTreeDirectoryDrag(event.dataTransfer)) {
        openFileInGroup(groupId, dragPath)
      }
      return
    }

    const targetFinalIndex = openFiles.length
    const toIndex = reorderTabIndex(fromIndex, targetFinalIndex, openFiles.length)
    reorderFilesInGroup(groupId, fromIndex, toIndex)
  }

  const handleStripDragStartCleanup = () => {
    setFileDragActive(false)
  }

  return (
    <div className="flex min-w-0 flex-col border-t">
      <div className="bg-muted flex min-w-0 items-stretch overflow-x-auto">
        {openFiles.map((file, index) => (
          <TabRow
            key={file.path}
            groupId={groupId}
            path={file.path}
            name={file.name}
            tabIndex={index}
            isActive={activeFile === file.path}
            openFiles={openFiles}
          />
        ))}
        <div
          role="presentation"
          className="min-w-8 flex-1 border-b"
          onDragOver={handleStripDragOver}
          onDrop={handleStripDrop}
          onDragEnd={handleStripDragStartCleanup}
        />
      </div>
      {showToolbar && (
        <div className="px-4 py-2 pl-6 flex gap-2 items-center border-b">
          {remoteCollaborators.length > 0 && (
            <>
              <div className="avatars flex">
                {remoteCollaborators.slice(0, 3).map((collaborator) => (
                  <div
                    key={collaborator.id}
                    className="size-6 bg-background rounded-full -ml-2 relative isolate p-[3px]"
                    title={collaborator.name}
                  >
                    <div
                      className="w-full h-full rounded-full border"
                      style={{ backgroundColor: collaborator.color }}
                    />
                  </div>
                ))}
              </div>
              <p className="text-xs">
                {remoteCollaborators.length === 1
                  ? '1 collaborator here'
                  : `${remoteCollaborators.length} collaborators here`}
              </p>
            </>
          )}
          {showPreviewToggle && (
            <Toggle
              pressed={previewOpen}
              onPressedChange={() => togglePreviewMode(groupId)}
              size="sm"
              variant="outline"
              className="ml-auto"
              aria-label={previewOpen ? 'Hide markdown preview' : 'Show markdown preview'}
              title={previewOpen ? 'Hide preview' : 'Show preview'}
            >
              <Eye />
            </Toggle>
          )}
        </div>
      )}
    </div>
  )
}

export default EditorTabs
