
import Editor from '@monaco-editor/react'
import { getCollaborationWsUrl } from '@/lib/backend-client'
import { initMonaco } from '@/lib/monaco-setup'
import { useCollaborationStore } from '@/stores/collaboration.store'
import { useFilesStore } from '@/stores/files.store'
import { useSettingsStore } from '@/stores/settings.store'
import { useFileContentStore } from '@/stores/file-content.store'
import React from 'react'
import type { OnMount } from '@monaco-editor/react'
import type { editor as MonacoEditorNamespace } from 'monaco-editor'

export type MonacoEditorProps = {
  groupId: string
  defaultValue?: string
  defaultLanguage?: string
}

type AwarenessState = {
  user?: {
    name?: string
    color?: string
  }
}

const nameStorageKey = 'foliage-collaboration-name'
const yTextName = 'monaco'
const colorPalette = [
  '#2563eb',
  '#dc2626',
  '#16a34a',
  '#ca8a04',
  '#9333ea',
  '#0891b2',
  '#db2777',
  '#ea580c',
] as const

const getNameColor = (name: string) => {
  let hash = 0

  for (const character of name) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0
  }

  return colorPalette[hash % colorPalette.length] ?? '#2563eb'
}

const getCollaborationUrl = () => getCollaborationWsUrl()

const getCssString = (value: string) => JSON.stringify(value)

export const MonacoEditor = ({
  groupId,
  defaultValue = '',
  defaultLanguage = 'markdown',
}: MonacoEditorProps) => {
  const [ready, setReady] = React.useState(false)
  const [editor, setEditor] =
    React.useState<MonacoEditorNamespace.IStandaloneCodeEditor | null>(null)
  const [name, setName] = React.useState<string | null | undefined>(undefined)
  const activeFile = useFilesStore((state) => state.groups[groupId]?.activeFile ?? null)
  const { setCollaborators, setConnectionStatus } = useCollaborationStore()
  const editorSettings = useSettingsStore((state) => state.settings.editor)

  React.useEffect(() => {
    let cancelled = false

    void initMonaco().then(() => {
      if (!cancelled) {
        setReady(true)
      }
    })

    return () => {
      cancelled = true
    }
  }, [])

  React.useEffect(() => {
    if (!editor || !activeFile) return

    useFileContentStore.getState().registerEditor(activeFile, editor)

    const model = editor.getModel()
    if (!model) {
      return () => {
        useFileContentStore.getState().unregisterEditor(activeFile)
      }
    }

    useFileContentStore.getState().setFileContent(activeFile, model.getValue())

    const contentDisposable = model.onDidChangeContent(() => {
      useFileContentStore.getState().setFileContent(activeFile, model.getValue())
    })

    return () => {
      contentDisposable.dispose()
      useFileContentStore.getState().unregisterEditor(activeFile)
    }
  }, [editor, activeFile])

  React.useEffect(() => {
    const savedName = window.localStorage.getItem(nameStorageKey)
    const cleanName = savedName?.trim() || 'You'

    window.localStorage.setItem(nameStorageKey, cleanName)
    setName(cleanName)
  }, [])

  React.useEffect(() => {
    if (!editor || !name || !activeFile) {
      return
    }

    let disposed = false
    let cleanup = () => {}

    const setupCollaboration = async () => {
      const [{ WebsocketProvider }, Y, { MonacoBinding }] = await Promise.all([
        import('y-websocket'),
        import('yjs'),
        import('y-monaco'),
      ])

      if (disposed) {
        return
      }

      const doc = new Y.Doc()
      const yText = doc.getText(yTextName)
      const roomName = encodeURIComponent(activeFile)
      const provider = new WebsocketProvider(
        getCollaborationUrl(),
        roomName,
        doc
      )
      const model = editor.getModel()
      const color = getNameColor(name)
      const styleElement = document.createElement('style')

      document.head.appendChild(styleElement)

      if (!model) {
        provider.destroy()
        doc.destroy()
        styleElement.remove()
        return
      }

      const binding = new MonacoBinding(
        yText,
        model,
        new Set([editor]),
        provider.awareness
      )

      // Monaco disposes the model before this effect cleans up (e.g. all tabs closed).
      // y-monaco then calls binding.destroy() from onWillDispose; a second destroy throws
      // on awareness.off inside Yjs.
      let bindingDestroyed = false
      const runBindingDestroy = binding.destroy.bind(binding)
      binding.destroy = () => {
        if (bindingDestroyed) {
          return
        }
        bindingDestroyed = true
        runBindingDestroy()
      }

      const updatePresence = () => {
        const collaboratorsByClient = Array.from(
          provider.awareness.getStates()
        ).flatMap(([clientId, state]) => {
          const awarenessState = state as AwarenessState
          const userName = awarenessState.user?.name?.trim()

          if (!userName) {
            return []
          }

          return [
            {
              id: clientId,
              name: userName,
              color: awarenessState.user?.color ?? getNameColor(userName),
              isLocal: clientId === doc.clientID,
            },
          ]
        })

        setCollaborators(
          collaboratorsByClient.sort((left, right) => {
            if (left.isLocal !== right.isLocal) {
              return left.isLocal ? -1 : 1
            }

            return left.name.localeCompare(right.name)
          })
        )

        styleElement.textContent = collaboratorsByClient
          .filter((collaborator) => !collaborator.isLocal)
          .map((collaborator) => {
            const label = getCssString(collaborator.name)

            return `
.yRemoteSelection-${collaborator.id} {
  background-color: ${collaborator.color}33;
}

.yRemoteSelectionHead-${collaborator.id} {
  border-left: 2px solid ${collaborator.color};
  box-sizing: border-box;
  margin-left: -1px;
  pointer-events: none;
  position: relative;
}

.yRemoteSelectionHead-${collaborator.id}::after {
  background: ${collaborator.color};
  color: #ffffff;
  content: ${label};
  font: 11px/1.4 system-ui, sans-serif;
  left: -2px;
  padding: 1px 6px;
  position: absolute;
  top: -18px;
  white-space: nowrap;
}
`
          })
          .join('\n')
      }

      provider.awareness.setLocalStateField('user', {
        name,
        color,
      })

      provider.awareness.on('change', updatePresence)
      provider.on('status', (event: { status: 'connected' | 'connecting' | 'disconnected' }) => {
        setConnectionStatus(event.status)
      })
      updatePresence()

      cleanup = () => {
        provider.awareness.setLocalState(null)
        provider.awareness.off('change', updatePresence)
        binding.destroy()
        provider.destroy()
        doc.destroy()
        styleElement.remove()
        setCollaborators([])
        setConnectionStatus('disconnected')
      }
    }

    void setupCollaboration()

    return () => {
      disposed = true
      cleanup()
    }
  }, [activeFile, editor, name, setCollaborators, setConnectionStatus, groupId])

  const handleMount = React.useCallback<OnMount>((mountedEditor) => {
    setEditor(mountedEditor)
  }, [])

  if (!ready) {
    return (
      <div
        className="bg-background flex min-h-0 min-w-0 flex-1 flex-col"
        aria-hidden
      />
    )
  }

  if (!activeFile) {
    return null
  }

  return (
    <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col">
      <Editor
        path={activeFile}
        height="100%"
        defaultLanguage={defaultLanguage}
        defaultValue={defaultValue}
        onMount={handleMount}
        options={{
          minimap: { enabled: editorSettings.minimap.enabled },
          scrollBeyondLastLine: editorSettings.scrollBeyondLastLine,
          fontSize: editorSettings.fontSize,
          tabSize: editorSettings.tabSize,
          wordWrap: editorSettings.wordWrap,
          rulers: editorSettings.rulers,
          automaticLayout: true,
          // Disable word-based suggestions - they interfere with citation completion
          suggest: {
            showWords: false,
          },
        }}
      />
    </div>
  )
}
