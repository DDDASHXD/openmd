import {
  collectLeafGroupIds,
  countLeaves,
  createInitialLayout,
  getFirstLeafGroupId,
  remapPathsInGroups,
  removeLeafGroupNode,
  splitLeaf,
  type EditorGroupState,
  type EditorSide,
  type LayoutNode,
} from '@/lib/editor-layout'
import type { WorkspaceDropHighlight } from '@/lib/workspace-tree-dnd'
import { create } from 'zustand'

export type WorkspaceEntry = {
  name: string
  path: string
  type: 'directory' | 'file'
}

export type OpenFile = {
  path: string
  name: string
}

const ROOT_GROUP_ID = 'g-root'

const openFileName = (path: string) => path.split('/').at(-1) ?? path

const emptyGroup = (): EditorGroupState => ({ openFiles: [], activeFile: null })

const newGroupId = () => `g-${crypto.randomUUID()}`

const pruneOneEmptyPane = (
  layout: LayoutNode,
  groups: Record<string, EditorGroupState>,
  emptiedGroupId: string,
): {
  layout: LayoutNode
  groups: Record<string, EditorGroupState>
  removed: boolean
} => {
  const g = groups[emptiedGroupId]
  if (!g || g.openFiles.length > 0) {
    return { layout, groups, removed: false }
  }
  if (countLeaves(layout) <= 1) {
    return { layout, groups, removed: false }
  }
  const nextLayout = removeLeafGroupNode(layout, emptiedGroupId)
  if (nextLayout === null) {
    return { layout, groups, removed: false }
  }
  const { [emptiedGroupId]: _, ...rest } = groups
  return { layout: nextLayout, groups: rest, removed: true }
}

interface FilesStore {
  layoutRoot: LayoutNode
  groups: Record<string, EditorGroupState>
  focusedGroupId: string
  lastFocusedGroupId: string
  rootName: string
  workspaceRevision: number
  fileDragActive: boolean

  treeDragSourcePath: string | null
  treeDragSourceIsDirectory: boolean
  workspaceDropHighlight: WorkspaceDropHighlight | null
  previewModeByGroup: Record<string, boolean>

  setRootName: (rootName: string) => void
  setFileDragActive: (active: boolean) => void
  setTreeDragSource: (path: string | null, isDirectory: boolean) => void
  setWorkspaceDropHighlight: (highlight: WorkspaceDropHighlight | null) => void
  clearTreeDragUi: () => void
  bumpWorkspace: () => void

  setFocusedGroup: (groupId: string) => void

  openFile: (path: string) => void
  openFileInGroup: (groupId: string, path: string, insertAt?: number) => void
  moveFileToSplit: (args: {
    path: string
    sourceGroupId: string | null
    targetGroupId: string
    side: EditorSide
  }) => void

  setActiveFile: (path: string | null) => void
  setActiveFileInGroup: (groupId: string, path: string | null) => void
  closeFileInGroup: (groupId: string, path: string) => void
  closeFileEverywhere: (path: string) => void
  reorderFilesInGroup: (groupId: string, fromIndex: number, toIndex: number) => void

  applyPathMove: (fromPath: string, toPath: string, isDirectory: boolean) => void

  setPreviewMode: (groupId: string, enabled: boolean) => void
  togglePreviewMode: (groupId: string) => void
}

export const useFilesStore = create<FilesStore>()((set) => ({
  layoutRoot: createInitialLayout(ROOT_GROUP_ID),
  groups: { [ROOT_GROUP_ID]: emptyGroup() },
  focusedGroupId: ROOT_GROUP_ID,
  lastFocusedGroupId: ROOT_GROUP_ID,
  rootName: 'workspace',
  workspaceRevision: 0,
  fileDragActive: false,
  treeDragSourcePath: null,
  treeDragSourceIsDirectory: false,
  workspaceDropHighlight: null,
  previewModeByGroup: {},

  setRootName: (rootName) => set({ rootName }),
  setFileDragActive: (fileDragActive) => set({ fileDragActive }),
  setTreeDragSource: (treeDragSourcePath, treeDragSourceIsDirectory) =>
    set({ treeDragSourcePath, treeDragSourceIsDirectory }),
  setWorkspaceDropHighlight: (workspaceDropHighlight) => set({ workspaceDropHighlight }),
  clearTreeDragUi: () =>
    set({
      treeDragSourcePath: null,
      treeDragSourceIsDirectory: false,
      workspaceDropHighlight: null,
    }),
  bumpWorkspace: () => set((s) => ({ workspaceRevision: s.workspaceRevision + 1 })),

  setFocusedGroup: (focusedGroupId) =>
    set({ focusedGroupId, lastFocusedGroupId: focusedGroupId }),

  openFile: (path) =>
    set((state) => {
      for (const [gid, g] of Object.entries(state.groups)) {
        if (g.openFiles.some((f) => f.path === path)) {
          return {
            focusedGroupId: gid,
            lastFocusedGroupId: gid,
            groups: {
              ...state.groups,
              [gid]: { ...g, activeFile: path },
            },
          }
        }
      }

      let gid = state.focusedGroupId
      if (!state.groups[gid]) {
        gid = state.lastFocusedGroupId
      }
      if (!state.groups[gid]) {
        gid = getFirstLeafGroupId(state.layoutRoot)
      }

      const g = state.groups[gid]
      if (!g) {
        return state
      }

      const name = openFileName(path)
      return {
        focusedGroupId: gid,
        lastFocusedGroupId: gid,
        groups: {
          ...state.groups,
          [gid]: {
            openFiles: [...g.openFiles, { path, name }],
            activeFile: path,
          },
        },
      }
    }),

  openFileInGroup: (groupId, path, insertAt) =>
    set((state) => {
      const g = state.groups[groupId]
      if (!g) {
        return state
      }

      const existingIdx = g.openFiles.findIndex((f) => f.path === path)
      if (existingIdx !== -1) {
        if (insertAt !== undefined && insertAt !== existingIdx) {
          const openFiles = [...g.openFiles]
          const [item] = openFiles.splice(existingIdx, 1)
          if (!item) {
            return state
          }
          const clamped = Math.max(0, Math.min(insertAt, openFiles.length))
          openFiles.splice(clamped, 0, item)
          return {
            focusedGroupId: groupId,
            lastFocusedGroupId: groupId,
            groups: {
              ...state.groups,
              [groupId]: { openFiles, activeFile: path },
            },
          }
        }

        return {
          focusedGroupId: groupId,
          lastFocusedGroupId: groupId,
          groups: {
            ...state.groups,
            [groupId]: { ...g, activeFile: path },
          },
        }
      }

      const name = openFileName(path)
      const openFiles = [...g.openFiles]
      const idx =
        insertAt === undefined ? openFiles.length : Math.max(0, Math.min(insertAt, openFiles.length))
      openFiles.splice(idx, 0, { path, name })

      return {
        focusedGroupId: groupId,
        lastFocusedGroupId: groupId,
        groups: {
          ...state.groups,
          [groupId]: { openFiles, activeFile: path },
        },
      }
    }),

  moveFileToSplit: ({ path, sourceGroupId, targetGroupId, side }) =>
    set((state) => {
      const newId = newGroupId()
      const newRoot = splitLeaf(state.layoutRoot, targetGroupId, side, newId)
      if (!newRoot) {
        return state
      }

      let groups = { ...state.groups }

      if (sourceGroupId) {
        const sg = groups[sourceGroupId]
        if (sg) {
          const openFiles = sg.openFiles.filter((f) => f.path !== path)
          const activeFile =
            sg.activeFile === path ? openFiles.at(-1)?.path ?? null : sg.activeFile
          groups[sourceGroupId] = { openFiles, activeFile }
        }
      }

      const name = openFileName(path)
      groups[newId] = {
        openFiles: [{ path, name }],
        activeFile: path,
      }

      let layoutRoot = newRoot
      let focusedGroupId = newId
      let lastFocusedGroupId = newId

      if (sourceGroupId && groups[sourceGroupId]?.openFiles.length === 0) {
        const pruned = pruneOneEmptyPane(layoutRoot, groups, sourceGroupId)
        if (pruned.removed) {
          layoutRoot = pruned.layout
          groups = pruned.groups
          const fallback = getFirstLeafGroupId(layoutRoot)
          if (!groups[focusedGroupId]) {
            focusedGroupId = fallback
            lastFocusedGroupId = fallback
          }
          if (!groups[lastFocusedGroupId]) {
            lastFocusedGroupId = fallback
          }
        }
      }

      return {
        layoutRoot,
        groups,
        focusedGroupId,
        lastFocusedGroupId,
      }
    }),

  setActiveFile: (path) =>
    set((state) => {
      const gid = state.focusedGroupId
      const g = state.groups[gid]
      if (!g) {
        return state
      }
      return {
        lastFocusedGroupId: gid,
        groups: {
          ...state.groups,
          [gid]: { ...g, activeFile: path },
        },
      }
    }),

  setActiveFileInGroup: (groupId, path) =>
    set((state) => {
      const g = state.groups[groupId]
      if (!g) {
        return state
      }
      return {
        focusedGroupId: groupId,
        lastFocusedGroupId: groupId,
        groups: {
          ...state.groups,
          [groupId]: { ...g, activeFile: path },
        },
      }
    }),

  closeFileInGroup: (groupId, path) =>
    set((state) => {
      const g = state.groups[groupId]
      if (!g) {
        return state
      }

      const openFiles = g.openFiles.filter((f) => f.path !== path)
      const activeFile =
        g.activeFile === path ? openFiles.at(-1)?.path ?? null : g.activeFile

      let layoutRoot = state.layoutRoot
      let groups: Record<string, EditorGroupState> = {
        ...state.groups,
        [groupId]: { openFiles, activeFile },
      }
      let focusedGroupId = state.focusedGroupId
      let lastFocusedGroupId = state.lastFocusedGroupId

      if (openFiles.length === 0) {
        const pruned = pruneOneEmptyPane(layoutRoot, groups, groupId)
        if (pruned.removed) {
          layoutRoot = pruned.layout
          groups = pruned.groups
          const fallback = getFirstLeafGroupId(layoutRoot)
          if (focusedGroupId === groupId) {
            focusedGroupId = fallback
          }
          if (lastFocusedGroupId === groupId) {
            lastFocusedGroupId = fallback
          }
          if (!groups[focusedGroupId]) {
            focusedGroupId = fallback
          }
          if (!groups[lastFocusedGroupId]) {
            lastFocusedGroupId = fallback
          }
        }
      }

      return {
        layoutRoot,
        groups,
        focusedGroupId,
        lastFocusedGroupId,
      }
    }),

  closeFileEverywhere: (path) =>
    set((state) => {
      let groups: Record<string, EditorGroupState> = { ...state.groups }

      for (const id of Object.keys(groups)) {
        const g = groups[id]
        if (!g || !g.openFiles.some((f) => f.path === path)) {
          continue
        }
        const openFiles = g.openFiles.filter((f) => f.path !== path)
        const activeFile =
          g.activeFile === path ? openFiles.at(-1)?.path ?? null : g.activeFile
        groups[id] = { openFiles, activeFile }
      }

      let layoutRoot = state.layoutRoot
      let focusedGroupId = state.focusedGroupId
      let lastFocusedGroupId = state.lastFocusedGroupId

      while (countLeaves(layoutRoot) > 1) {
        const emptyId = collectLeafGroupIds(layoutRoot).find(
          (id) => (groups[id]?.openFiles.length ?? 0) === 0,
        )
        if (!emptyId) {
          break
        }
        const pruned = pruneOneEmptyPane(layoutRoot, groups, emptyId)
        if (!pruned.removed) {
          break
        }
        layoutRoot = pruned.layout
        groups = pruned.groups
      }

      const fallback = getFirstLeafGroupId(layoutRoot)
      if (!groups[focusedGroupId]) {
        focusedGroupId = fallback
      }
      if (!groups[lastFocusedGroupId]) {
        lastFocusedGroupId = fallback
      }

      return { groups, layoutRoot, focusedGroupId, lastFocusedGroupId }
    }),

  reorderFilesInGroup: (groupId, fromIndex, toIndex) =>
    set((state) => {
      const g = state.groups[groupId]
      if (!g) {
        return state
      }

      const openFiles = [...g.openFiles]
      const [moved] = openFiles.splice(fromIndex, 1)
      if (!moved) {
        return state
      }
      openFiles.splice(toIndex, 0, moved)

      return {
        groups: {
          ...state.groups,
          [groupId]: { ...g, openFiles },
        },
      }
    }),

  applyPathMove: (fromPath, toPath, isDirectory) =>
    set((state) => {
      const prefix = `${fromPath}/`
      const remap = (p: string) => {
        if (!isDirectory) {
          return p === fromPath ? toPath : p
        }
        if (p === fromPath) {
          return toPath
        }
        if (p.startsWith(prefix)) {
          return toPath + p.slice(fromPath.length)
        }
        return p
      }
      return {
        groups: remapPathsInGroups(state.groups, remap),
      }
    }),

  setPreviewMode: (groupId, enabled) =>
    set((state) => ({
      previewModeByGroup: { ...state.previewModeByGroup, [groupId]: enabled },
    })),

  togglePreviewMode: (groupId) =>
    set((state) => ({
      previewModeByGroup: {
        ...state.previewModeByGroup,
        [groupId]: !state.previewModeByGroup[groupId],
      },
    })),
}))
