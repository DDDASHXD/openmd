import React from 'react'
import type { editor } from 'monaco-editor'
import { useBibEntries, type BibEntry } from './use-bib-entries'

declare global {
  interface Window {
    monaco?: typeof import('monaco-editor')
  }
}

// Simple bibtex field sanitizer for display
const sanitizeField = (value: string | undefined): string => {
  if (!value) return ''
  // Remove excessive whitespace and newlines
  return value.replace(/\s+/g, ' ').trim()
}

// Format author/editor for display
const formatAuthors = (entry: BibEntry): string => {
  const author = entry.fields.author || entry.fields.editor || ''
  const sanitized = sanitizeField(author)

  if (!sanitized) return ''

  // Truncate long author lists
  if (sanitized.length > 50) {
    return sanitized.slice(0, 47) + '...'
  }

  return sanitized
}

// Format year for display
const formatYear = (entry: BibEntry): string => {
  return entry.fields.year || entry.fields.date?.split('-')[0] || ''
}

// Create a detail string for the completion item
const createDetailString = (entry: BibEntry): string => {
  const parts: string[] = []
  const type = entry.type.charAt(0).toUpperCase() + entry.type.slice(1).toLowerCase()

  parts.push(type)

  const year = formatYear(entry)
  if (year) {
    parts.push(year)
  }

  const authors = formatAuthors(entry)
  if (authors) {
    parts.push(authors)
  }

  return parts.join(' • ')
}

// Create documentation for hover/complete
const createDocumentation = (entry: BibEntry): string => {
  const lines: string[] = []

  const title = sanitizeField(entry.fields.title)
  if (title) {
    lines.push(`**${title}**`)
    lines.push('')
  }

  const authors = formatAuthors(entry)
  if (authors) {
    lines.push(`**Authors:** ${authors}`)
  }

  const year = formatYear(entry)
  if (year) {
    lines.push(`**Year:** ${year}`)
  }

  const journal = sanitizeField(entry.fields.journal || entry.fields.booktitle)
  if (journal) {
    lines.push(`**Published in:** ${journal}`)
  }

  if (lines.length === 0) {
    return 'No additional information available.'
  }

  return lines.join('\n')
}

export const useBibCompletion = (editor: editor.IStandaloneCodeEditor | null) => {
  const { getEntries } = useBibEntries()

  React.useEffect(() => {
    if (!editor) return

    const model = editor.getModel()
    if (!model) return

    // Only register for markdown
    if (model.getLanguageId() !== 'markdown') return

    const monaco = window.monaco
    if (!monaco) return

    // Register completion item provider for markdown
    const disposable = monaco.languages.registerCompletionItemProvider(
      'markdown',
      {
        triggerCharacters: ['@'],

        provideCompletionItems: async (model, position, context) => {
          // Only trigger when triggered by @ character or manually invoked in citation context
          const lineContent = model.getLineContent(position.lineNumber)
          const textBeforeCursor = lineContent.slice(0, position.column - 1)

          // Find the last @ before cursor
          const atIndex = textBeforeCursor.lastIndexOf('@')

          // Check if we're in a citation context:
          // 1. Must have @ somewhere before cursor
          // 2. No whitespace or ] between @ and cursor
          if (atIndex === -1) {
            return { suggestions: [] }
          }

          const textAfterAt = textBeforeCursor.slice(atIndex + 1)

          // If there's a ] or space after @, we're no longer in citation context
          if (textAfterAt.includes(' ') || textAfterAt.includes(']')) {
            return { suggestions: [] }
          }

          const entries = await getEntries()

          if (entries.length === 0) {
            return { suggestions: [] }
          }

          // Calculate range from @ to cursor (to replace any partial text typed)
          const range = new monaco.Range(
            position.lineNumber,
            atIndex + 1, // Position right after @
            position.lineNumber,
            position.column
          )

          const suggestions = entries.map((entry) => {
            const detail = createDetailString(entry)
            const documentation = createDocumentation(entry)

            return {
              label: entry.key,
              kind: monaco.languages.CompletionItemKind.Reference,
              detail: detail,
              documentation: {
                value: documentation,
                isTrusted: true,
              },
              // Include the @ in insertText so it replaces properly
              insertText: entry.key,
              range: range,
              sortText: entry.key.toLowerCase(),
              preselect: true,
              // Kind modifiers to make it stand out
              kindModifier: 'bib-citation',
            }
          })

          return {
            suggestions,
            // Prevent Monaco from adding more suggestions (like word-based)
            incomplete: false,
          }
        },

        // Force this to be the exclusive provider for @ triggers
        resolveCompletionItem: (item, token) => {
          return item
        },
      }
    )

    return () => {
      disposable.dispose()
    }
  }, [editor, getEntries])
}
