import { useFilesStore } from '@/stores/files.store'
import { useSettingsStore } from '@/stores/settings.store'
import { buildLeafmark, type LeafmarkBuildOptions, type LeafmarkBuildResult } from '@/lib/leafmark-client'

export type LeafmarkExportResult = LeafmarkBuildResult & {
  exportDir: string
  log?: string
}

export const exportMarkdownFiles = async (
  options: LeafmarkBuildOptions = {},
): Promise<LeafmarkExportResult> => {
  const settings = useSettingsStore.getState().settings
  const folder = settings.leafmark?.projectFolder ?? 'project'
  const buildOptions = {
    ...settings.leafmark?.buildOptions,
    ...options,
  }

  const result = await buildLeafmark(folder, buildOptions)

  useFilesStore.getState().bumpWorkspace()

  if (result.outputs.pdf) {
    useFilesStore.getState().openFile(result.outputs.pdf)
  } else if (result.outputs.html) {
    useFilesStore.getState().openFile(result.outputs.html)
  }

  return {
    ...result,
    exportDir: result.projectBase,
  }
}
