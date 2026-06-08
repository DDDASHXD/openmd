import { create } from 'zustand'
import type { editor as MonacoEditorNamespace } from 'monaco-editor'

interface FileContentStore {
  fileContents: Record<string, string>
  activeEditors: Record<string, MonacoEditorNamespace.IStandaloneCodeEditor>
  lastActiveEditor: MonacoEditorNamespace.IStandaloneCodeEditor | null
  setFileContent: (path: string, content: string) => void
  getFileContent: (path: string) => string | undefined
  registerEditor: (path: string, editor: MonacoEditorNamespace.IStandaloneCodeEditor) => void
  unregisterEditor: (path: string) => void
  getCurrentEditor: () => MonacoEditorNamespace.IStandaloneCodeEditor | null
  setLastActiveEditor: (editor: MonacoEditorNamespace.IStandaloneCodeEditor | null) => void
}

export const useFileContentStore = create<FileContentStore>()((set, get) => ({
  fileContents: {},
  activeEditors: {},
  lastActiveEditor: null,
  setFileContent: (path, content) =>
    set((state) => ({
      fileContents: { ...state.fileContents, [path]: content },
    })),
  getFileContent: (path) => get().fileContents[path],
  registerEditor: (path, editor) =>
    set((state) => ({
      activeEditors: { ...state.activeEditors, [path]: editor },
      lastActiveEditor: editor,
    })),
  unregisterEditor: (path) =>
    set((state) => {
      const { [path]: removed, ...rest } = state.activeEditors
      return {
        activeEditors: rest,
        lastActiveEditor: state.lastActiveEditor === removed ? null : state.lastActiveEditor,
      }
    }),
  getCurrentEditor: () => get().lastActiveEditor,
  setLastActiveEditor: (editor) => set({ lastActiveEditor: editor }),
}))
