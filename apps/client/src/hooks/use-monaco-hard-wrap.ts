
import React from 'react'
import type { editor as MonacoEditorNamespace } from 'monaco-editor'

const DEFAULT_DEBOUNCE_MS = 2000

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrettierApi = any

// Track if prettier modules have been loaded
let prettierInstance: PrettierApi | null = null
let markdownPluginInstance: PrettierApi | null = null

// Load prettier modules once
const loadPrettier = async () => {
  if (prettierInstance && markdownPluginInstance) {
    return { prettier: prettierInstance, markdownPlugin: markdownPluginInstance }
  }

  const [prettierMod, markdownMod] = await Promise.all([
    import('prettier/standalone'),
    import('prettier/plugins/markdown'),
  ])

  prettierInstance = prettierMod.default ?? prettierMod
  markdownPluginInstance = markdownMod.default ?? markdownMod

  return { prettier: prettierInstance, markdownPlugin: markdownPluginInstance }
}

// Format markdown using prettier standalone (browser-compatible)
const formatWithPrettier = async (text: string, printWidth: number): Promise<string> => {
  try {
    const { prettier, markdownPlugin } = await loadPrettier()

    const formatted = await prettier.format(text, {
      parser: 'markdown',
      plugins: [markdownPlugin],
      printWidth: printWidth,
      tabWidth: 2,
      useTabs: false,
      proseWrap: 'always',
      semi: false,
      singleQuote: true,
    })

    return formatted
  } catch {
    // Return original text if formatting fails
    return text
  }
}

export const useMonacoHardWrap = (
  editor: MonacoEditorNamespace.IStandaloneCodeEditor | null,
  enabled: boolean,
  language: string,
  printWidth: number,
  debounceMs: number = DEFAULT_DEBOUNCE_MS,
) => {
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const isApplyingRef = React.useRef(false)
  const printWidthRef = React.useRef(printWidth)
  const debounceMsRef = React.useRef(debounceMs)

  // Keep refs in sync with the latest values
  React.useEffect(() => {
    printWidthRef.current = printWidth
  }, [printWidth])

  React.useEffect(() => {
    debounceMsRef.current = debounceMs
  }, [debounceMs])

  // Re-format existing content when printWidth changes
  React.useEffect(() => {
    if (!editor || !enabled || language !== 'markdown') return

    const model = editor.getModel()
    if (!model) return

    // Skip if already applying changes
    if (isApplyingRef.current) return

    // Re-format the existing content with the new print width
    const currentText = model.getValue()
    const width = Math.max(1, printWidth)

    // Async format
    isApplyingRef.current = true

    const format = async () => {
      const formatted = await formatWithPrettier(currentText, width)

      if (formatted === currentText) {
        isApplyingRef.current = false
        return
      }

      // Use executeEdits to preserve undo/redo stack and cursor position
      const lineCount = model.getLineCount()
      const lastLineLength = model.getLineMaxColumn(lineCount)

      editor.executeEdits('markdown-hard-wrap', [
        {
          range: {
            startLineNumber: 1,
            startColumn: 1,
            endLineNumber: lineCount,
            endColumn: lastLineLength,
          },
          text: formatted,
          forceMoveMarkers: true,
        },
      ])

      isApplyingRef.current = false
    }

    void format()
  }, [editor, enabled, language, printWidth])

  React.useEffect(() => {
    if (!editor || !enabled || language !== 'markdown') {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      return
    }

    const model = editor.getModel()
    if (!model) return

    // Track if the editor has focus to distinguish local changes from remote updates
    const hasFocus = () => editor.hasWidgetFocus()

    const disposable = model.onDidChangeContent(() => {
      if (isApplyingRef.current) return

      // Only format on local changes (editor has focus)
      // Remote collaborative changes won't have focus and shouldn't trigger formatting
      if (!hasFocus()) return

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      timeoutRef.current = setTimeout(() => {
        // Double-check focus before formatting to avoid race conditions
        if (!hasFocus()) {
          isApplyingRef.current = false
          return
        }

        const currentText = model.getValue()
        // Use the latest print width value from the ref
        const width = Math.max(1, printWidthRef.current)

        isApplyingRef.current = true

        const format = async () => {
          const formatted = await formatWithPrettier(currentText, width)

          if (formatted === currentText) {
            isApplyingRef.current = false
            return
          }

          // Use executeEdits to preserve undo/redo stack and cursor position
          const lineCount = model.getLineCount()
          const lastLineLength = model.getLineMaxColumn(lineCount)

          editor.executeEdits('markdown-hard-wrap', [
            {
              range: {
                startLineNumber: 1,
                startColumn: 1,
                endLineNumber: lineCount,
                endColumn: lastLineLength,
              },
              text: formatted,
              forceMoveMarkers: true,
            },
          ])

          isApplyingRef.current = false
        }

        void format()
      }, debounceMsRef.current)
    })

    return () => {
      disposable.dispose()
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [editor, enabled, language])
}
