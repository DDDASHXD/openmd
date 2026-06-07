'use client'

import React from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@workspace/ui/components/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@workspace/ui/components/tabs'
import { Button } from '@workspace/ui/components/button'
import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'
import { Switch } from '@workspace/ui/components/switch'
import { Textarea } from '@workspace/ui/components/textarea'
import { NativeSelect, NativeSelectOption } from '@workspace/ui/components/native-select'
import { useLeafmarkStore } from '@/stores/leafmark.store'
import { useFilesStore } from '@/stores/files.store'
import { cn } from '@workspace/ui/lib/utils'
import { GripVertical, Loader2 } from 'lucide-react'

const SortableChapterRow = ({ name }: { name: string }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: name,
  })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        'bg-background flex items-center gap-2 border px-3 py-2 text-sm',
        isDragging && 'opacity-70',
      )}
    >
      <button
        type="button"
        className="text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${name}`}
      >
        <GripVertical className="size-4" />
      </button>
      <span className="min-w-0 flex-1 truncate">{name}</span>
    </div>
  )
}

const StatusPanel = () => {
  const status = useLeafmarkStore((state) => state.status)
  const loading = useLeafmarkStore((state) => state.loading)

  if (loading && !status) {
    return <p className="text-muted-foreground text-sm">Loading status…</p>
  }

  if (!status) {
    return <p className="text-muted-foreground text-sm">No status available.</p>
  }

  return (
    <div className="grid gap-2 text-sm">
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">Input</span>
        <span className="truncate">{status.input}</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">Chapters</span>
        <span>{status.chapters}</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">Words</span>
        <span>{status.words.toLocaleString()}</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">Characters</span>
        <span>{status.charsWithSpaces.toLocaleString()}</span>
      </div>
    </div>
  )
}

export const LeafmarkDialog = () => {
  const dialogOpen = useLeafmarkStore((state) => state.dialogOpen)
  const setDialogOpen = useLeafmarkStore((state) => state.setDialogOpen)
  const loading = useLeafmarkStore((state) => state.loading)
  const busyAction = useLeafmarkStore((state) => state.busyAction)
  const error = useLeafmarkStore((state) => state.error)
  const clearError = useLeafmarkStore((state) => state.clearError)
  const folders = useLeafmarkStore((state) => state.folders)
  const project = useLeafmarkStore((state) => state.project)
  const themes = useLeafmarkStore((state) => state.themes)
  const selectedFolder = useLeafmarkStore((state) => state.selectedFolder)
  const setSelectedFolder = useLeafmarkStore((state) => state.setSelectedFolder)
  const buildOptions = useLeafmarkStore((state) => state.buildOptions)
  const setBuildOptions = useLeafmarkStore((state) => state.setBuildOptions)
  const selectedBundle = useLeafmarkStore((state) => state.selectedBundle)
  const setSelectedBundle = useLeafmarkStore((state) => state.setSelectedBundle)
  const chapterOrder = useLeafmarkStore((state) => state.chapterOrder)
  const setChapterOrder = useLeafmarkStore((state) => state.setChapterOrder)
  const configJson = useLeafmarkStore((state) => state.configJson)
  const setConfigJson = useLeafmarkStore((state) => state.setConfigJson)
  const themeUrl = useLeafmarkStore((state) => state.themeUrl)
  const setThemeUrl = useLeafmarkStore((state) => state.setThemeUrl)
  const lastBuild = useLeafmarkStore((state) => state.lastBuild)
  const lastLog = useLeafmarkStore((state) => state.lastLog)
  const refreshAll = useLeafmarkStore((state) => state.refreshAll)
  const loadStatus = useLeafmarkStore((state) => state.loadStatus)
  const initProject = useLeafmarkStore((state) => state.initProject)
  const initThemeScaffold = useLeafmarkStore((state) => state.initThemeScaffold)
  const applyTheme = useLeafmarkStore((state) => state.applyTheme)
  const applyThemeFromUrl = useLeafmarkStore((state) => state.applyThemeFromUrl)
  const saveChapterOrder = useLeafmarkStore((state) => state.saveChapterOrder)
  const saveConfig = useLeafmarkStore((state) => state.saveConfig)
  const runBuild = useLeafmarkStore((state) => state.runBuild)
  const toggleWatch = useLeafmarkStore((state) => state.toggleWatch)
  const openFile = useFilesStore((state) => state.openFile)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const isBusy = busyAction !== null

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id) {
      return
    }

    const oldIndex = chapterOrder.indexOf(String(active.id))
    const newIndex = chapterOrder.indexOf(String(over.id))

    if (oldIndex === -1 || newIndex === -1) {
      return
    }

    setChapterOrder(arrayMove(chapterOrder, oldIndex, newIndex))
  }

  const metadata =
    project?.config?.metadata && typeof project.config.metadata === 'object'
      ? (project.config.metadata as Record<string, unknown>)
      : {}

  const updateMetadataField = (key: string, value: string) => {
    const nextMetadata = { ...metadata }

    if (key === 'author') {
      nextMetadata.author = value
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)
    } else {
      nextMetadata[key] = value
    }

    const nextConfig = {
      ...(project?.config ?? {}),
      metadata: nextMetadata,
    }

    setConfigJson(JSON.stringify(nextConfig, null, 2))
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>Leafmark</DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-auto px-6 py-4">
          <div className="mb-4 grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="leafmark-folder">Project folder</Label>
              <NativeSelect
                id="leafmark-folder"
                value={selectedFolder}
                onChange={(event) => setSelectedFolder(event.target.value)}
                disabled={loading || isBusy}
              >
                {folders.map((folder) => (
                  <NativeSelectOption key={folder.path} value={folder.path}>
                    {folder.path}
                    {folder.isLeafmarkProject ? ' (Leafmark project)' : ''}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>

            {project && (
              <p className="text-muted-foreground text-xs">
                Project base: {project.projectBase}
                {project.isLeafmarkProject ? '' : ' — not initialized yet'}
                {project.watching ? ' — watching for changes' : ''}
              </p>
            )}

            {error && (
              <div className="border-destructive/40 bg-destructive/10 text-destructive flex items-start justify-between gap-3 border px-3 py-2 text-sm">
                <span>{error}</span>
                <Button type="button" size="sm" variant="outline" onClick={clearError}>
                  Dismiss
                </Button>
              </div>
            )}
          </div>

          <Tabs defaultValue="project">
            <TabsList variant="line">
              <TabsTrigger value="project">Project</TabsTrigger>
              <TabsTrigger value="chapters">Chapters</TabsTrigger>
              <TabsTrigger value="build">Build</TabsTrigger>
              <TabsTrigger value="themes">Themes</TabsTrigger>
              <TabsTrigger value="config">Config</TabsTrigger>
            </TabsList>

            <TabsContent value="project" className="mt-4 space-y-4">
              <StatusPanel />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isBusy}
                  onClick={() => void refreshAll()}
                >
                  Refresh
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isBusy}
                  onClick={() => void loadStatus()}
                >
                  Update status
                </Button>
                <Button type="button" disabled={isBusy} onClick={() => void initProject()}>
                  {busyAction === 'init' ? 'Initializing…' : 'Initialize project'}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="chapters" className="mt-4 space-y-4">
              {chapterOrder.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No markdown chapters found. Initialize a Leafmark project first.
                </p>
              ) : (
                <>
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext items={chapterOrder} strategy={verticalListSortingStrategy}>
                      <div className="grid gap-1">
                        {chapterOrder.map((chapter) => (
                          <SortableChapterRow key={chapter} name={chapter} />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                  <Button type="button" disabled={isBusy} onClick={() => void saveChapterOrder()}>
                    {busyAction === 'order' ? 'Saving…' : 'Save chapter order'}
                  </Button>
                </>
              )}
            </TabsContent>

            <TabsContent value="build" className="mt-4 space-y-4">
              <div className="grid gap-3">
                <div className="flex items-center justify-between gap-4">
                  <Label htmlFor="leafmark-html">Also build HTML</Label>
                  <Switch
                    id="leafmark-html"
                    checked={Boolean(buildOptions.html && !buildOptions.htmlOnly)}
                    disabled={Boolean(buildOptions.htmlOnly) || isBusy}
                    onCheckedChange={(checked) =>
                      setBuildOptions({ html: checked, htmlOnly: false })
                    }
                  />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <Label htmlFor="leafmark-html-only">HTML only</Label>
                  <Switch
                    id="leafmark-html-only"
                    checked={Boolean(buildOptions.htmlOnly)}
                    disabled={isBusy}
                    onCheckedChange={(checked) =>
                      setBuildOptions({ htmlOnly: checked, html: checked ? true : buildOptions.html })
                    }
                  />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <Label htmlFor="leafmark-no-cover">Do not merge cover page</Label>
                  <Switch
                    id="leafmark-no-cover"
                    checked={Boolean(buildOptions.noMergeCover)}
                    disabled={isBusy}
                    onCheckedChange={(checked) => setBuildOptions({ noMergeCover: checked })}
                  />
                </div>

                {project && project.bundles.length > 0 && (
                  <div className="grid gap-2">
                    <Label htmlFor="leafmark-bundle">Bundle</Label>
                    <NativeSelect
                      id="leafmark-bundle"
                      value={selectedBundle ?? ''}
                      onChange={(event) =>
                        setSelectedBundle(event.target.value ? event.target.value : null)
                      }
                      disabled={isBusy}
                    >
                      <NativeSelectOption value="">Main project</NativeSelectOption>
                      {project.bundles.map((bundle) => (
                        <NativeSelectOption key={bundle} value={bundle}>
                          {bundle}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="button" disabled={isBusy} onClick={() => void runBuild()}>
                  {busyAction === 'build' ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Building…
                    </>
                  ) : (
                    'Build'
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isBusy || !project?.isLeafmarkProject}
                  onClick={() => void toggleWatch()}
                >
                  {busyAction === 'watch'
                    ? 'Updating watch…'
                    : project?.watching
                      ? 'Stop watch'
                      : 'Start watch'}
                </Button>
              </div>

              {lastLog && <p className="text-muted-foreground text-sm">{lastLog}</p>}

              {lastBuild && (
                <div className="flex flex-wrap gap-2">
                  {lastBuild.outputs.pdf && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openFile(lastBuild.outputs.pdf!)}
                    >
                      Open PDF
                    </Button>
                  )}
                  {lastBuild.outputs.html && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openFile(lastBuild.outputs.html!)}
                    >
                      Open HTML
                    </Button>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="themes" className="mt-4 space-y-4">
              <div className="grid gap-2">
                {themes.map((theme) => (
                  <div
                    key={theme.name}
                    className="flex items-center justify-between gap-3 border px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{theme.name}</p>
                      {theme.description && (
                        <p className="text-muted-foreground truncate text-xs">{theme.description}</p>
                      )}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={isBusy || !project?.isLeafmarkProject}
                      onClick={() => void applyTheme(theme.name)}
                    >
                      Apply
                    </Button>
                  </div>
                ))}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="leafmark-theme-url">Theme name or GitHub URL</Label>
                <div className="flex gap-2">
                  <Input
                    id="leafmark-theme-url"
                    value={themeUrl}
                    onChange={(event) => setThemeUrl(event.target.value)}
                    placeholder="default or https://github.com/user/theme-repo"
                    disabled={isBusy}
                  />
                  <Button
                    type="button"
                    disabled={isBusy || !project?.isLeafmarkProject}
                    onClick={() => void applyThemeFromUrl()}
                  >
                    Apply
                  </Button>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                disabled={isBusy}
                onClick={() => void initThemeScaffold()}
              >
                {busyAction === 'init-theme' ? 'Creating theme scaffold…' : 'Create theme scaffold'}
              </Button>
            </TabsContent>

            <TabsContent value="config" className="mt-4 space-y-4">
              <div className="grid gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="leafmark-title">Title</Label>
                  <Input
                    id="leafmark-title"
                    value={typeof metadata.title === 'string' ? metadata.title : ''}
                    onChange={(event) => updateMetadataField('title', event.target.value)}
                    disabled={isBusy}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="leafmark-author">Author</Label>
                  <Input
                    id="leafmark-author"
                    value={
                      Array.isArray(metadata.author)
                        ? metadata.author.join(', ')
                        : typeof metadata.author === 'string'
                          ? metadata.author
                          : ''
                    }
                    onChange={(event) => updateMetadataField('author', event.target.value)}
                    disabled={isBusy}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="leafmark-bibliography">Bibliography</Label>
                  <Input
                    id="leafmark-bibliography"
                    value={
                      typeof metadata.bibliography === 'string' ? metadata.bibliography : ''
                    }
                    onChange={(event) => updateMetadataField('bibliography', event.target.value)}
                    disabled={isBusy}
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="leafmark-config-json">Config JSON</Label>
                <Textarea
                  id="leafmark-config-json"
                  value={configJson}
                  onChange={(event) => setConfigJson(event.target.value)}
                  className="min-h-48 font-mono text-xs"
                  disabled={isBusy}
                />
              </div>

              <Button type="button" disabled={isBusy} onClick={() => void saveConfig()}>
                {busyAction === 'config' ? 'Saving…' : 'Save config'}
              </Button>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  )
}
