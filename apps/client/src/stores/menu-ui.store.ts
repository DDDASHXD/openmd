import { create } from 'zustand'

type MenuUiStore = {
  liveShareOpen: boolean
  exportErrorOpen: boolean
  exportErrorMessage: string
  setLiveShareOpen: (open: boolean) => void
  setExportError: (message: string) => void
  clearExportError: () => void
}

export const useMenuUiStore = create<MenuUiStore>()((set) => ({
  liveShareOpen: false,
  exportErrorOpen: false,
  exportErrorMessage: '',
  setLiveShareOpen: (liveShareOpen) => set({ liveShareOpen }),
  setExportError: (exportErrorMessage) => set({ exportErrorOpen: true, exportErrorMessage }),
  clearExportError: () => set({ exportErrorOpen: false, exportErrorMessage: '' }),
}))
