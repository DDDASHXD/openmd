import { exportMarkdownFiles } from '@/lib/export-markdown'
import { isTauri, returnToLauncher } from '@/lib/tauri-client'
import { useLeafmarkStore } from '@/stores/leafmark.store'
import { useMenuUiStore } from '@/stores/menu-ui.store'
import { useSessionStore } from '@/stores/session.store'

export type MenuActionId =
  | 'open_project'
  | 'close_project'
  | 'leafmark'
  | 'export'
  | 'live_share'
  | 'about'
  | 'report_bug'

type MenuActionContext = {
  navigateToLauncher: () => void
  openAbout: () => void
}

export const executeMenuAction = async (
  action: MenuActionId,
  context: MenuActionContext,
): Promise<void> => {
  switch (action) {
    case 'open_project':
    case 'close_project': {
      useSessionStore.getState().clearSession()

      if (isTauri()) {
        await returnToLauncher()
      }

      context.navigateToLauncher()
      return
    }

    case 'leafmark': {
      await useLeafmarkStore.getState().openDialog()
      return
    }

    case 'export': {
      try {
        await exportMarkdownFiles()
      } catch (error) {
        useMenuUiStore
          .getState()
          .setExportError(error instanceof Error ? error.message : 'Export failed.')
      }

      return
    }

    case 'live_share': {
      useMenuUiStore.getState().setLiveShareOpen(true)
      return
    }

    case 'about': {
      context.openAbout()
      return
    }

    case 'report_bug': {
      window.open('https://github.com/DDDASHXD/openmd/issues/new', '_blank', 'noopener,noreferrer')
      return
    }

    default:
      return
  }
}
