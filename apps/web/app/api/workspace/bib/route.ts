import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

function getWorkspaceRoot() {
  return process.env.OPENMD_WORKSPACE ? path.resolve(process.env.OPENMD_WORKSPACE) : process.cwd()
}

function resolveWorkspacePath(relativePath: string) {
  const root = getWorkspaceRoot()
  const resolvedPath = path.resolve(root, relativePath.replaceAll('\\', '/').replace(/^\/+/, ''))
  const rel = path.relative(root, resolvedPath)

  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error('Path is outside the workspace.')
  }

  return resolvedPath
}

export type BibEntry = {
  key: string
  type: string
  fields: Record<string, string>
}

function parseBibEntry(entryText: string): BibEntry | null {
  // Match @type{key, ... } or @type(key, ... )
  const match = entryText.match(/^@(\w+)\s*[{\(\s]*([^,\s]+)\s*,(.*)/s)

  if (!match) {
    return null
  }

  const entryType = match[1] ?? ''
  const entryKey = match[2] ?? ''
  const rest = match[3] ?? ''
  const fields: Record<string, string> = {}

  // Parse key-value pairs
  const fieldRegex = /(\w+)\s*=\s*(?:\{([^}]*)\}|"([^"]*)"|(\d+))/g
  let fieldMatch

  while ((fieldMatch = fieldRegex.exec(rest)) !== null) {
    const fieldName = fieldMatch[1]
    const braceValue = fieldMatch[2]
    const quoteValue = fieldMatch[3]
    const numValue = fieldMatch[4]
    const value = braceValue ?? quoteValue ?? numValue ?? ''
    // Handle nested braces by removing outer braces
    if (fieldName) {
      fields[fieldName.toLowerCase()] = value.replace(/^\{|\}$/g, '')
    }
  }

  if (!entryKey || !entryType) {
    return null
  }

  return { key: entryKey, type: entryType, fields }
}

function parseBibFile(content: string): BibEntry[] {
  const entries: BibEntry[] = []
  // Split by @ but keep the delimiter
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

async function findBibFiles(dir = ''): Promise<{ path: string; content: string }[]> {
  const absolutePath = resolveWorkspacePath(dir)
  const entries: { path: string; content: string }[] = []

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

export async function GET() {
  try {
    const bibFiles = await findBibFiles()
    const allEntries: (BibEntry & { source: string })[] = []

    for (const { path: filePath, content } of bibFiles) {
      const entries = parseBibFile(content)

      for (const entry of entries) {
        allEntries.push({ ...entry, source: filePath })
      }
    }

    return NextResponse.json({ entries: allEntries })
  } catch (error) {
    console.error('Error fetching bib entries:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to parse bib files' },
      { status: 500 }
    )
  }
}
