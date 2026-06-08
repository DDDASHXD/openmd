
import { EditorLeaf } from '@/components/editor/editor-leaf'
import type { LayoutNode } from '@/lib/editor-layout'
import { useFilesStore } from '@/stores/files.store'
import { cn } from '@workspace/ui/lib/utils'
import { Group, Panel, Separator } from 'react-resizable-panels'
import React from 'react'

const LayoutBranch = ({ node }: { node: LayoutNode }) => {
  if (node.type === 'leaf') {
    return (
      <Panel defaultSize={50} minSize={12} className="min-h-0 min-w-0">
        <div className="flex h-full min-h-0 min-w-0 flex-col">
          <EditorLeaf groupId={node.groupId} />
        </div>
      </Panel>
    )
  }

  return (
    <Panel defaultSize={50} minSize={12} className="min-h-0 min-w-0">
      <div className="h-full min-h-0 min-w-0">
        <Group orientation={node.orientation} className="h-full min-h-0 w-full">
          <LayoutBranch node={node.first} />
          <Separator
            className={cn(
              'bg-border shrink-0',
              node.orientation === 'horizontal' ? 'w-1' : 'h-1 w-full',
            )}
          />
          <LayoutBranch node={node.second} />
        </Group>
      </div>
    </Panel>
  )
}

export const EditorLayoutRoot = () => {
  const layoutRoot = useFilesStore((state) => state.layoutRoot)

  React.useEffect(() => {
    const clearFileDrag = () => {
      const s = useFilesStore.getState()
      s.setFileDragActive(false)
      s.clearTreeDragUi()
    }
    document.addEventListener('dragend', clearFileDrag, true)
    return () => document.removeEventListener('dragend', clearFileDrag, true)
  }, [])

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <Group orientation="horizontal" className="min-h-0 min-w-0 flex-1">
        <LayoutBranch node={layoutRoot} />
      </Group>
    </div>
  )
}
