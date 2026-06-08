import React from 'react'
import { useNavigate } from 'react-router-dom'
import { FolderOpen, Globe, Plus, Trash2 } from 'lucide-react'

import { ConnectServerDialog } from '@/components/launcher/connect-server-dialog'
import { CreateProjectDialog } from '@/components/launcher/create-project-dialog'
import {
  createProjectOnDisk,
  openEditorWindow,
  pickFolder,
  startLocalServer,
  getDesktopAppVersion,
} from '@/lib/tauri-client'
import { useSessionStore } from '@/stores/session.store'
import { Button } from '@workspace/ui/components/button'
import { cn } from '@workspace/ui/lib/utils'

const appVersion = import.meta.env.VITE_FOLIAGE_VERSION ?? '0.0.1'

export const LauncherView = () => {
  const navigate = useNavigate()
  const recents = useSessionStore((state) => state.recents)
  const removeRecent = useSessionStore((state) => state.removeRecent)
  const startLocalSession = useSessionStore((state) => state.startLocalSession)
  const startRemoteSession = useSessionStore((state) => state.startRemoteSession)

  const [connectOpen, setConnectOpen] = React.useState(false)
  const [createOpen, setCreateOpen] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [displayVersion, setDisplayVersion] = React.useState(appVersion)

  React.useEffect(() => {
    void getDesktopAppVersion().then((version) => {
      if (version) {
        setDisplayVersion(version)
      }
    })
  }, [])

  const enterEditor = React.useCallback(async () => {
    await openEditorWindow()
    navigate('/')
  }, [navigate])

  const openLocalProject = React.useCallback(
    async (workspacePath: string, label?: string) => {
      setBusy(true)
      setError(null)

      try {
        if (import.meta.env.DEV) {
          console.log('[foliage] opening project:', workspacePath)
        }

        startLocalSession(workspacePath, label)

        const server = await startLocalServer(workspacePath)

        if (import.meta.env.DEV) {
          console.log('[foliage] local server ready:', server)
        }

        await enterEditor()
      } catch (openError) {
        console.error('[foliage] failed to open project:', openError)
        setError(openError instanceof Error ? openError.message : 'Unable to open project.')
      } finally {
        setBusy(false)
      }
    },
    [enterEditor, startLocalSession],
  )

  const handleCreateProject = async (projectPath: string, projectName: string) => {
    setBusy(true)
    setError(null)

    try {
      await createProjectOnDisk(projectPath)
      await openLocalProject(projectPath, projectName)
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Unable to create project.')
    } finally {
      setBusy(false)
    }
  }

  const handleOpenFolder = async () => {
    setBusy(true)
    setError(null)

    try {
      const folderPath = await pickFolder()

      if (!folderPath) {
        return
      }

      await openLocalProject(folderPath)
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : 'Unable to open folder.')
    } finally {
      setBusy(false)
    }
  }

  const handleRecentClick = async (recent: (typeof recents)[number]) => {
    if (recent.kind === 'local' && recent.workspacePath) {
      await openLocalProject(recent.workspacePath, recent.label)
      return
    }

    if (recent.serverUrl) {
      const kind = recent.kind === 'live-share' ? 'live-share' : 'server'
      startRemoteSession(recent.serverUrl, recent.label, kind)
      await enterEditor()
    }
  }

  const handleConnect = async (serverUrl: string, label: string) => {
    const kind = serverUrl.includes('/p/') ? 'live-share' : 'server'
    startRemoteSession(serverUrl, label, kind)
    await enterEditor()
  }

  return (
    <div className="bg-background text-foreground flex h-screen w-screen">
      <aside className="border-border flex w-64 shrink-0 flex-col border-r">
        <div className="border-border border-b px-4 py-3">
          <p className="text-muted-foreground text-xs font-medium uppercase">Recent projects</p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {recents.length === 0 ? (
            <p className="text-muted-foreground px-2 py-4 text-sm">No recent projects yet.</p>
          ) : (
            recents.map((recent) => (
              <div
                key={recent.id}
                className="group hover:bg-muted/60 flex items-center gap-2 rounded-md px-2 py-2"
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => void handleRecentClick(recent)}
                  disabled={busy}
                >
                  <p className="truncate text-sm font-medium">{recent.label}</p>
                  <p className="text-muted-foreground truncate text-xs">
                    {recent.kind === 'local' ? recent.workspacePath : recent.serverUrl}
                  </p>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 opacity-0 group-hover:opacity-100"
                  onClick={() => removeRecent(recent.id)}
                  aria-label={`Remove ${recent.label}`}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))
          )}
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col items-center justify-center px-8">
        <div className="flex w-full max-w-md flex-col gap-8">
          <div className="flex flex-col items-center text-center">
            <h1 className="sr-only">foliage</h1>
            <img src="/brand/logo-text.svg" alt="foliage" className="h-auto w-72 max-w-full" />
            <p className="text-muted-foreground mt-1 text-sm">v{displayVersion}</p>
          </div>

          <div className="flex flex-col gap-3">
            <Button
              variant="outline"
              className="h-auto justify-start gap-3 px-4 py-4"
              onClick={() => setCreateOpen(true)}
              disabled={busy}
            >
              <Plus className="size-5 shrink-0" />
              <div className="text-left">
                <p className="font-medium">Create new project</p>
                <p className="text-muted-foreground text-xs">
                  Choose a name and location; creates a folder with sample files
                </p>
              </div>
            </Button>

            <Button
              variant="outline"
              className="h-auto justify-start gap-3 px-4 py-4"
              onClick={() => void handleOpenFolder()}
              disabled={busy}
            >
              <FolderOpen className="size-5 shrink-0" />
              <div className="text-left">
                <p className="font-medium">Open folder as project</p>
                <p className="text-muted-foreground text-xs">Open an existing workspace folder</p>
              </div>
            </Button>

            <Button
              variant="outline"
              className={cn('h-auto justify-start gap-3 px-4 py-4')}
              onClick={() => setConnectOpen(true)}
              disabled={busy}
            >
              <Globe className="size-5 shrink-0" />
              <div className="text-left">
                <p className="font-medium">Connect to server</p>
                <p className="text-muted-foreground text-xs">
                  Join a remote or live-shared foliage server
                </p>
              </div>
            </Button>
          </div>

          {error && <p className="text-destructive text-center text-sm">{error}</p>}
          {busy && <p className="text-muted-foreground text-center text-sm">Working...</p>}
        </div>
      </main>

      <CreateProjectDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreate={(projectPath, projectName) => void handleCreateProject(projectPath, projectName)}
      />

      <ConnectServerDialog
        open={connectOpen}
        onOpenChange={setConnectOpen}
        onConnect={(serverUrl, label) => void handleConnect(serverUrl, label)}
      />
    </div>
  )
}
