
import { backendFetch } from '@/lib/backend-client'
import { useFilesStore, type WorkspaceEntry } from '@/stores/files.store'
import { useSettingsStore } from '@/stores/settings.store'
import { hasAnyOpenEditor } from '@/lib/editor-layout'
import {
  FOLIAGE_IS_DIR_MIME,
  getFoliagePath,
  hasFoliagePath,
  setFoliageDragData,
} from '@/lib/foliage-dnd'
import {
  getDropTargetDirectory,
  getWorkspaceParentDir,
  type WorkspaceDropHighlight,
} from '@/lib/workspace-tree-dnd'
import { cn } from '@workspace/ui/lib/utils'
import React from 'react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@workspace/ui/components/context-menu'
import { AlertDialog } from '@/components/dialogs/alert-dialog'
import { ConfirmDialog } from '@/components/dialogs/confirm-dialog'
import { PromptDialog } from '@/components/dialogs/prompt-dialog'

type WorkspaceResponse = {
  root: {
    name: string
    path: string
  }
  entries: WorkspaceEntry[]
  error?: string
}

type CreateEntryResponse = {
  entry: WorkspaceEntry
  error?: string
}

type DeleteEntryResponse = {
  entry: WorkspaceEntry
  error?: string
}

const getEntries = async (path: string) => {
  const response = await backendFetch(`/api/workspace?path=${encodeURIComponent(path)}`)
  const data = (await response.json()) as WorkspaceResponse

  if (!response.ok) {
    throw new Error(data.error ?? 'Unable to load workspace.')
  }

  return data
}

const createEntry = async (path: string, name: string, type: 'file' | 'directory') => {
  const response = await backendFetch('/api/workspace', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, name, type }),
  })
  const data = (await response.json()) as CreateEntryResponse

  if (!response.ok) {
    throw new Error(data.error ?? `Failed to create ${type}.`)
  }

  return data.entry
}

const deleteEntry = async (path: string) => {
  const response = await backendFetch('/api/workspace', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  })
  const data = (await response.json()) as DeleteEntryResponse

  if (!response.ok) {
    throw new Error(data.error ?? 'Failed to delete item.')
  }

  return data.entry
}

const moveEntry = async (path: string, toDirectory: string) => {
  const response = await backendFetch('/api/workspace', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, toDirectory }),
  })
  const data = (await response.json()) as {
    from?: string
    to?: string
    type?: string
    error?: string
  }

  if (!response.ok) {
    throw new Error(data.error ?? 'Failed to move item.')
  }

  if (!data.from || !data.to || !data.type) {
    throw new Error('Invalid move response.')
  }

  return {
    from: data.from,
    to: data.to,
    type: data.type as 'directory' | 'file',
  }
}

const isInvalidTreeMove = (dragPath: string, dragIsDir: boolean, toDir: string) => {
  if (dragPath === toDir) {
    return true
  }

  if (dragIsDir) {
    const prefix = `${dragPath}/`
    if (toDir === dragPath || toDir.startsWith(prefix)) {
      return true
    }
  }

  return false
}

const updateTreeDropHighlight = (event: React.DragEvent, highlight: WorkspaceDropHighlight) => {
  const types = [...event.dataTransfer.types].map((type) => type.toLowerCase())
  const isInternal = hasFoliagePath(event.dataTransfer)
  const isExternalFiles = types.includes('files')

  if (!isInternal && !isExternalFiles) {
    return
  }

  event.preventDefault()
  event.stopPropagation()

  if (isExternalFiles && !isInternal) {
    event.dataTransfer.dropEffect = 'copy'
    useFilesStore.getState().setWorkspaceDropHighlight(highlight)
    return
  }

  if (!isInternal) {
    return
  }

  const toDir = getDropTargetDirectory(highlight)
  const store = useFilesStore.getState()
  const src = store.treeDragSourcePath
  const isSrcDir = store.treeDragSourceIsDirectory
  if (src && isInvalidTreeMove(src, isSrcDir, toDir)) {
    event.dataTransfer.dropEffect = 'none'
    store.setWorkspaceDropHighlight(null)
    return
  }
  event.dataTransfer.dropEffect = 'move'
  store.setWorkspaceDropHighlight(highlight)
}

const DirectoryChildren = ({
  path,
  depth,
  refreshSignal = 0,
  onWorkspaceDrop,
}: {
  path: string
  depth: number
  refreshSignal?: number
  onWorkspaceDrop: (event: React.DragEvent, toDirectory: string, onSuccess: () => void) => void
}) => {
  const [entries, setEntries] = React.useState<WorkspaceEntry[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const openFile = useFilesStore((state) => state.openFile)
  const workspaceRevision = useFilesStore((state) => state.workspaceRevision)
  const showHiddenFiles = useSettingsStore((state) => state.settings.workspace.showHiddenFiles)

  const loadEntries = React.useCallback(() => {
    let cancelled = false

    setLoading(true)
    setError(null)

    void getEntries(path)
      .then((data) => {
        if (cancelled) {
          return
        }

        setEntries(data.entries)

        if (path === '' && !hasAnyOpenEditor(useFilesStore.getState().groups)) {
          const firstFile = data.entries.find((entry) => entry.type === 'file')

          if (firstFile) {
            openFile(firstFile.path)
          }
        }
      })
      .catch((requestError: unknown) => {
        if (cancelled) {
          return
        }

        setError(requestError instanceof Error ? requestError.message : 'Unable to load folder.')
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [path, openFile])

  React.useEffect(() => {
    const cleanup = loadEntries()
    return cleanup
  }, [loadEntries, refreshSignal, workspaceRevision])

  const filteredEntries = React.useMemo(() => {
    if (showHiddenFiles) {
      return entries
    }
    return entries.filter((entry) => !entry.name.startsWith('.'))
  }, [entries, showHiddenFiles])

  if (loading) {
    return (
      <div
        className="text-muted-foreground px-2 py-1 text-xs"
        style={{ paddingLeft: depth * 14 + 8 }}
      >
        Loading...
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-destructive px-2 py-1 text-xs" style={{ paddingLeft: depth * 14 + 8 }}>
        {error}
      </div>
    )
  }

  return (
    <>
      {filteredEntries.map((entry) => (
        <TreeItem
          key={entry.path}
          entry={entry}
          depth={depth}
          onDirectoryChange={loadEntries}
          onWorkspaceDrop={onWorkspaceDrop}
        />
      ))}
    </>
  )
}

const TreeItem = ({
  entry,
  depth,
  onDirectoryChange,
  onWorkspaceDrop,
}: {
  entry: WorkspaceEntry
  depth: number
  onDirectoryChange?: () => void
  onWorkspaceDrop: (event: React.DragEvent, toDirectory: string, onSuccess: () => void) => void
}) => {
  const [open, setOpen] = React.useState(false)
  const activeEditorPath = useFilesStore(
    (state) => state.groups[state.focusedGroupId]?.activeFile ?? null,
  )
  const openFile = useFilesStore((state) => state.openFile)
  const setFileDragActive = useFilesStore((state) => state.setFileDragActive)
  const workspaceDropHighlight = useFilesStore((state) => state.workspaceDropHighlight)
  const isDirectory = entry.type === 'directory'
  const [childRefreshKey, setChildRefreshKey] = React.useState(0)

  const [promptOpen, setPromptOpen] = React.useState(false)
  const [promptType, setPromptType] = React.useState<'file' | 'directory'>('file')
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const [errorAlertOpen, setErrorAlertOpen] = React.useState(false)
  const [errorAlertMessage, setErrorAlertMessage] = React.useState('')

  const isDropTarget =
    (isDirectory &&
      workspaceDropHighlight?.kind === 'folder' &&
      workspaceDropHighlight.path === entry.path) ||
    (!isDirectory &&
      workspaceDropHighlight?.kind === 'sibling-of-file' &&
      workspaceDropHighlight.filePath === entry.path)

  const handleDragStart = (event: React.DragEvent) => {
    setFoliageDragData(event.dataTransfer, entry.path, {
      isDirectory: entry.type === 'directory',
    })
    event.dataTransfer.effectAllowed = 'move'
    setFileDragActive(true)
    useFilesStore.getState().setTreeDragSource(entry.path, entry.type === 'directory')
  }

  const handleDragEnd = () => {
    setFileDragActive(false)
    useFilesStore.getState().clearTreeDragUi()
  }

  const handleFileDragOver = (event: React.DragEvent) => {
    updateTreeDropHighlight(event, { kind: 'sibling-of-file', filePath: entry.path })
  }

  const handleFolderDragOver = (event: React.DragEvent) => {
    updateTreeDropHighlight(event, { kind: 'folder', path: entry.path })
  }

  const handleDrop = (event: React.DragEvent, targetPath: string) => {
    onWorkspaceDrop(event, targetPath, () => onDirectoryChange?.())
  }

  const handleCreate = (type: 'file' | 'directory') => {
    setPromptType(type)
    setPromptOpen(true)
  }

  const handlePromptConfirm = async (name: string) => {
    if (!name) {
      return
    }

    try {
      const createdEntry = await createEntry(entry.path, name, promptType)

      setOpen(true)
      setChildRefreshKey((value) => value + 1)
      onDirectoryChange?.()

      if (createdEntry.type === 'file') {
        openFile(createdEntry.path)
      }
    } catch (error) {
      setErrorAlertMessage(
        error instanceof Error ? error.message : `Failed to create ${promptType}.`,
      )
      setErrorAlertOpen(true)
    }
  }

  const handlePromptCancel = () => {
    setPromptOpen(false)
  }

  const closeDeletedFiles = (deletedPath: string, deletedType: WorkspaceEntry['type']) => {
    const store = useFilesStore.getState()
    const deletedPrefix = `${deletedPath}/`
    const paths = new Set<string>()

    for (const g of Object.values(store.groups)) {
      for (const f of g.openFiles) {
        if (
          f.path === deletedPath ||
          (deletedType === 'directory' && f.path.startsWith(deletedPrefix))
        ) {
          paths.add(f.path)
        }
      }
    }

    for (const p of paths) {
      store.closeFileEverywhere(p)
    }
  }

  const handleDelete = () => {
    setConfirmOpen(true)
  }

  const handleConfirmConfirm = async () => {
    try {
      const deletedEntry = await deleteEntry(entry.path)

      closeDeletedFiles(deletedEntry.path, deletedEntry.type)
      onDirectoryChange?.()
    } catch (error) {
      setErrorAlertMessage(error instanceof Error ? error.message : 'Failed to delete item.')
      setErrorAlertOpen(true)
    }
  }

  const handleConfirmCancel = () => {
    setConfirmOpen(false)
  }

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger
          render={
            <button
              type="button"
              draggable
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragOver={isDirectory ? handleFolderDragOver : handleFileDragOver}
              onDrop={(event) => {
                if (isDirectory) {
                  handleDrop(event, entry.path)
                } else {
                  handleDrop(event, getWorkspaceParentDir(entry.path))
                }
              }}
              onClick={() => {
                if (isDirectory) {
                  setOpen((value) => !value)
                } else {
                  openFile(entry.path)
                }
              }}
            />
          }
          className={cn(
            'hover:bg-muted flex h-7 w-full items-center gap-1 truncate px-2 text-left text-sm',
            activeEditorPath === entry.path && 'bg-muted text-foreground',
            isDirectory && 'cursor-pointer',
            isDropTarget && 'bg-primary/15 ring-primary/50 ring-2 ring-inset',
          )}
          style={{ paddingLeft: depth * 14 + 8 }}
          title={entry.path}
        >
          <span className="text-muted-foreground flex h-4 w-4 shrink-0 items-center justify-center text-xs">
            {isDirectory ? (open ? '⌄' : '›') : ''}
          </span>
          <span className={cn('truncate', isDirectory && 'text-foreground')}>{entry.name}</span>
        </ContextMenuTrigger>
        {isDirectory && (
          <ContextMenuContent>
            <ContextMenuItem onClick={() => void handleCreate('file')}>New File</ContextMenuItem>
            <ContextMenuItem onClick={() => void handleCreate('directory')}>
              New Folder
            </ContextMenuItem>
            <ContextMenuItem variant="destructive" onClick={() => void handleDelete()}>
              Delete
            </ContextMenuItem>
          </ContextMenuContent>
        )}
        {!isDirectory && (
          <ContextMenuContent>
            <ContextMenuItem variant="destructive" onClick={() => void handleDelete()}>
              Delete
            </ContextMenuItem>
          </ContextMenuContent>
        )}
      </ContextMenu>
      {isDirectory && open && (
        <DirectoryChildren
          path={entry.path}
          depth={depth + 1}
          refreshSignal={childRefreshKey}
          onWorkspaceDrop={onWorkspaceDrop}
        />
      )}
      <PromptDialog
        open={promptOpen}
        onOpenChange={setPromptOpen}
        title={`Create new ${promptType === 'file' ? 'file' : 'folder'}`}
        description={`Enter name for new ${promptType === 'file' ? 'file' : 'folder'} in "${entry.name}":`}
        onConfirm={handlePromptConfirm}
        onCancel={handlePromptCancel}
      />
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Confirm Delete"
        description={`Delete ${entry.type === 'directory' ? 'folder' : 'file'} "${entry.name}"?`}
        onConfirm={handleConfirmConfirm}
        onCancel={handleConfirmCancel}
        variant="destructive"
        confirmText="Delete"
      />
      <AlertDialog
        open={errorAlertOpen}
        onOpenChange={setErrorAlertOpen}
        description={errorAlertMessage}
        onConfirm={() => setErrorAlertOpen(false)}
      />
    </>
  )
}

const Sidebar = () => {
  const rootName = useFilesStore((state) => state.rootName)
  const setRootName = useFilesStore((state) => state.setRootName)
  const setFileDragActive = useFilesStore((state) => state.setFileDragActive)
  const workspaceDropHighlight = useFilesStore((state) => state.workspaceDropHighlight)
  const [refreshKey, setRefreshKey] = React.useState(0)

  const [promptOpen, setPromptOpen] = React.useState(false)
  const [promptType, setPromptType] = React.useState<'file' | 'directory'>('file')
  const [errorAlertOpen, setErrorAlertOpen] = React.useState(false)
  const [errorAlertMessage, setErrorAlertMessage] = React.useState('')

  const refreshRoot = React.useCallback(() => {
    setRefreshKey((k) => k + 1)
  }, [])

  const handleRootDragOver = (event: React.DragEvent) => {
    updateTreeDropHighlight(event, { kind: 'root' })
  }

  const handleRootDrop = (event: React.DragEvent) => {
    handleWorkspaceDrop(event, '', refreshRoot)
  }

  const handleRootDragEnd = () => {
    setFileDragActive(false)
    useFilesStore.getState().clearTreeDragUi()
  }

  const handleCreateRoot = (type: 'file' | 'directory') => {
    setPromptType(type)
    setPromptOpen(true)
  }

  const handlePromptConfirm = async (name: string) => {
    if (!name) {
      return
    }

    try {
      const createdEntry = await createEntry('', name, promptType)

      refreshRoot()

      if (createdEntry.type === 'file') {
        useFilesStore.getState().openFile(createdEntry.path)
      }
    } catch (error) {
      setErrorAlertMessage(
        error instanceof Error ? error.message : `Failed to create ${promptType}.`,
      )
      setErrorAlertOpen(true)
    }
  }

  const handlePromptCancel = () => {
    setPromptOpen(false)
  }

  React.useEffect(() => {
    let cancelled = false

    void getEntries('')
      .then((data) => {
        if (!cancelled) {
          setRootName(data.root.name)
        }
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [setRootName, refreshKey])

  const [uploadErrorAlertOpen, setUploadErrorAlertOpen] = React.useState(false)
  const [uploadErrorMessage, setUploadErrorMessage] = React.useState('')
  const [moveErrorAlertOpen, setMoveErrorAlertOpen] = React.useState(false)
  const [moveErrorMessage, setMoveErrorMessage] = React.useState('')

  const showUploadError = (message: string) => {
    setUploadErrorMessage(message)
    setUploadErrorAlertOpen(true)
  }

  const showMoveError = (message: string) => {
    setMoveErrorMessage(message)
    setMoveErrorAlertOpen(true)
  }

  const handleWorkspaceDrop = (
    event: React.DragEvent,
    toDirectory: string,
    onSuccess: () => void,
  ) => {
    event.preventDefault()
    event.stopPropagation()
    useFilesStore.getState().clearTreeDragUi()

    const hasInternalPath = hasFoliagePath(event.dataTransfer)
    const fileList = event.dataTransfer.files

    if (!hasInternalPath && fileList.length > 0) {
      event.dataTransfer.dropEffect = 'copy'
      void (async () => {
        for (const file of Array.from(fileList)) {
          const destPath = toDirectory ? `${toDirectory}/${file.name}` : file.name
          const formData = new FormData()
          formData.append('path', destPath)
          formData.append('file', file)

          try {
            const response = await backendFetch('/api/workspace', {
              method: 'PUT',
              body: formData,
            })

            if (!response.ok) {
              let msg = `Failed to upload ${file.name}`
              try {
                const data = (await response.json()) as { error?: string }
                msg = data.error ?? msg
              } catch {
                try {
                  msg = ((await response.text()) || msg).slice(0, 500)
                } catch {
                  /* ignore */
                }
              }
              throw new Error(msg)
            }
          } catch (error) {
            showUploadError(
              error instanceof Error ? error.message : `Failed to upload ${file.name}.`,
            )
            return
          }
        }
        useFilesStore.getState().bumpWorkspace()
        onSuccess()
      })()
      return
    }

    if (!hasInternalPath) {
      return
    }

    const dragPath = getFoliagePath(event.dataTransfer)
    const isDirDrag = event.dataTransfer.getData(FOLIAGE_IS_DIR_MIME) === '1'
    if (!dragPath || isInvalidTreeMove(dragPath, isDirDrag, toDirectory)) {
      return
    }

    void moveEntry(dragPath, toDirectory)
      .then((result) => {
        useFilesStore.getState().applyPathMove(result.from, result.to, result.type === 'directory')
        useFilesStore.getState().bumpWorkspace()
        onSuccess()
      })
      .catch((error) => {
        showMoveError(error instanceof Error ? error.message : 'Move failed.')
      })
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <aside className="bg-sidebar text-sidebar-foreground flex h-full min-h-0 w-72 shrink-0 flex-col border-r border-t">
          <div
            className={cn(
              'sticky top-0 z-10 shrink-0 border-b bg-sidebar px-2 py-2 text-sm font-medium',
              workspaceDropHighlight?.kind === 'root' &&
                'bg-primary/15 ring-primary/50 ring-2 ring-inset',
            )}
            onDragOver={handleRootDragOver}
            onDrop={handleRootDrop}
            onDragEnd={handleRootDragEnd}
          >
            {rootName}
          </div>
          <div
            className={cn(
              'min-h-0 flex-1 overflow-auto',
              workspaceDropHighlight?.kind === 'root' &&
                'bg-primary/10 ring-primary/40 ring-2 ring-inset',
            )}
            onDragOver={handleRootDragOver}
            onDrop={handleRootDrop}
          >
            <DirectoryChildren
              key={refreshKey}
              path=""
              depth={0}
              refreshSignal={refreshKey}
              onWorkspaceDrop={handleWorkspaceDrop}
            />
          </div>
        </aside>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => void handleCreateRoot('file')}>New File</ContextMenuItem>
        <ContextMenuItem onClick={() => void handleCreateRoot('directory')}>
          New Folder
        </ContextMenuItem>
      </ContextMenuContent>
      <PromptDialog
        open={promptOpen}
        onOpenChange={setPromptOpen}
        title={`Create new ${promptType === 'file' ? 'file' : 'folder'}`}
        description={`Enter name for new ${promptType === 'file' ? 'file' : 'folder'} in root:`}
        onConfirm={handlePromptConfirm}
        onCancel={handlePromptCancel}
      />
      <AlertDialog
        open={errorAlertOpen}
        onOpenChange={setErrorAlertOpen}
        description={errorAlertMessage}
        onConfirm={() => setErrorAlertOpen(false)}
      />
      <AlertDialog
        open={uploadErrorAlertOpen}
        onOpenChange={setUploadErrorAlertOpen}
        description={uploadErrorMessage}
        onConfirm={() => setUploadErrorAlertOpen(false)}
      />
      <AlertDialog
        open={moveErrorAlertOpen}
        onOpenChange={setMoveErrorAlertOpen}
        description={moveErrorMessage}
        onConfirm={() => setMoveErrorAlertOpen(false)}
      />
    </ContextMenu>
  )
}

export default Sidebar
