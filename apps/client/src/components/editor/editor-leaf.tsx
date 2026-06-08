
import EditorTabs from '@/components/editor/tabs'
import { EditorPane } from '@/components/editor/editor-pane'
import type { EditorSide } from '@/lib/editor-layout'
import { getFoliagePath, getFoliageSourceGroup, isTreeDirectoryDrag } from '@/lib/foliage-dnd'
import { useFilesStore } from '@/stores/files.store'
import { cn } from '@workspace/ui/lib/utils'
import React from 'react'

const EDGE_ZONES: { side: EditorSide; className: string }[] = [
  { side: 'left', className: 'absolute inset-y-0 left-0 z-20 w-10' },
  { side: 'right', className: 'absolute inset-y-0 right-0 z-20 w-10' },
  { side: 'top', className: 'absolute inset-x-0 top-0 z-20 h-10' },
  { side: 'bottom', className: 'absolute inset-x-0 bottom-0 z-20 h-10' },
]

export type EditorLeafProps = {
  groupId: string
}

export const EditorLeaf = ({ groupId }: EditorLeafProps) => {
  const setFocusedGroup = useFilesStore((state) => state.setFocusedGroup)
  const moveFileToSplit = useFilesStore((state) => state.moveFileToSplit)
  const setFileDragActive = useFilesStore((state) => state.setFileDragActive)
  const fileDragActive = useFilesStore((state) => state.fileDragActive)
  const [edgeHover, setEdgeHover] = React.useState<EditorSide | null>(null)

  const handleEdgeDrop = (event: React.DragEvent, side: EditorSide) => {
    event.preventDefault()
    event.stopPropagation()
    setEdgeHover(null)
    try {
      if (isTreeDirectoryDrag(event.dataTransfer)) {
        return
      }

      const path = getFoliagePath(event.dataTransfer)
      if (!path) {
        return
      }
      const sourceGroupId = getFoliageSourceGroup(event.dataTransfer)
      moveFileToSplit({
        path,
        sourceGroupId,
        targetGroupId: groupId,
        side,
      })
    } finally {
      setFileDragActive(false)
    }
  }

  return (
    <div
      className="bg-background flex min-h-0 min-w-0 flex-1 flex-col"
      onPointerDown={() => setFocusedGroup(groupId)}
    >
      <EditorTabs groupId={groupId} />
      <div className="relative min-h-0 flex-1">
        <EditorPane groupId={groupId} />
        {fileDragActive
          ? EDGE_ZONES.map(({ side, className }) => (
              <div
                key={side}
                role="presentation"
                className={cn(
                  className,
                  'pointer-events-auto transition-colors',
                  edgeHover === side ? 'bg-primary/30' : 'bg-primary/5 hover:bg-primary/15',
                )}
                onDragEnter={() => setEdgeHover(side)}
                onDragLeave={() => setEdgeHover(null)}
                onDragOver={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  event.dataTransfer.dropEffect = 'move'
                }}
                onDrop={(event) => handleEdgeDrop(event, side)}
              />
            ))
          : null}
      </div>
    </div>
  )
}
