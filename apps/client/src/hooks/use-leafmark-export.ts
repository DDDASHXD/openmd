
import React from 'react'
import { exportMarkdownFiles } from '@/lib/export-markdown'

export const useLeafmarkExport = () => {
  const [exporting, setExporting] = React.useState(false)
  const [errorOpen, setErrorOpen] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState('')

  const exportMarkdown = React.useCallback(async () => {
    if (exporting) {
      return
    }

    setExporting(true)

    try {
      await exportMarkdownFiles()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Export failed.')
      setErrorOpen(true)
    } finally {
      setExporting(false)
    }
  }, [exporting])

  return {
    exporting,
    exportMarkdown,
    errorOpen,
    setErrorOpen,
    errorMessage,
  }
}
