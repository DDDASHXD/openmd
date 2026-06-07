import fs from 'node:fs/promises'
import path from 'node:path'

const parseBibEntry = (entryText) => {
  const match = entryText.match(/^@(\w+)\s*[{\(\s]*([^,\s]+)\s*,(.*)/s)

  if (!match) {
    return null
  }

  const entryType = match[1] ?? ''
  const entryKey = match[2] ?? ''
  const rest = match[3] ?? ''
  const fields = {}
  const fieldRegex = /(\w+)\s*=\s*(?:\{([^}]*)\}|"([^"]*)"|(\d+))/g
  let fieldMatch

  while ((fieldMatch = fieldRegex.exec(rest)) !== null) {
    const fieldName = fieldMatch[1]
    const braceValue = fieldMatch[2]
    const quoteValue = fieldMatch[3]
    const numValue = fieldMatch[4]
    const value = braceValue ?? quoteValue ?? numValue ?? ''

    if (fieldName) {
      fields[fieldName.toLowerCase()] = value.replace(/^\{|\}$/g, '')
    }
  }

  if (!entryKey || !entryType) {
    return null
  }

  return { key: entryKey, type: entryType, fields }
}

const parseBibFile = (content) => {
  const entries = []
  const entryTexts = content.split(/(?=@\w+)/)

  for (const entryText of entryTexts) {
    const trimmed = entryText.trim()

    if (!trimmed.startsWith('@')) {
      continue
    }

    const entry = parseBibEntry(trimmed)

    if (entry) {
      entries.push(entry)
    }
  }

  return entries
}

export const createBibHandlers = (resolveWorkspacePath) => {
  const findBibFiles = async (dir = '') => {
    const absolutePath = resolveWorkspacePath(dir)
    const entries = []

    try {
      const items = await fs.readdir(absolutePath, { withFileTypes: true })

      for (const item of items) {
        const relativePath = dir ? `${dir}/${item.name}` : item.name

        if (item.isDirectory() && !item.name.startsWith('.') && item.name !== 'node_modules') {
          const subEntries = await findBibFiles(relativePath)
          entries.push(...subEntries)
        } else if (item.isFile() && item.name.endsWith('.bib')) {
          const filePath = path.join(absolutePath, item.name)

          try {
            const content = await fs.readFile(filePath, 'utf-8')
            entries.push({ path: relativePath, content })
          } catch {
            // Skip files that can't be read
          }
        }
      }
    } catch {
      // Skip directories that can't be read
    }

    return entries
  }

  const getBibEntries = async () => {
    const bibFiles = await findBibFiles()
    const allEntries = []

    for (const { path: filePath, content } of bibFiles) {
      const entries = parseBibFile(content)

      for (const entry of entries) {
        allEntries.push({ ...entry, source: filePath })
      }
    }

    return allEntries
  }

  return { getBibEntries }
}
