import { Buffer } from 'node:buffer'
import fs from 'node:fs/promises'
import path from 'node:path'
import busboy from 'busboy'

import { getRelativePath } from './http-utils.mjs'

const text = new TextDecoder('utf-8', { fatal: true })
const maxDirectoryEntries = 500
const ignoredDirectoryNames = new Set(['.git', '.next', '.turbo', '.openmd'])
const maxUploadBytes = 100 * 1024 * 1024

const getCleanEntryName = (value) => {
  const name = String(value ?? '').trim()

  if (!name || name === '.' || name === '..') {
    throw new Error('Name is required.')
  }

  if (name.includes('/') || name.includes('\\')) {
    throw new Error('Name cannot include path separators.')
  }

  return name
}

const isTextBuffer = (buffer) => {
  if (buffer.includes(0)) {
    return false
  }

  try {
    text.decode(buffer)
    return true
  } catch {
    return false
  }
}

export const createWorkspaceApi = (workspaceRoot) => {
  const workspaceName = path.basename(workspaceRoot) || workspaceRoot
  const docSaveTimers = new Map()

  const resolveWorkspacePath = (relativePath = '') => {
    const resolvedPath = path.resolve(workspaceRoot, relativePath)
    const relativeFromWorkspace = path.relative(workspaceRoot, resolvedPath)

    if (relativeFromWorkspace.startsWith('..') || path.isAbsolute(relativeFromWorkspace)) {
      throw new Error('Path is outside the workspace.')
    }

    return resolvedPath
  }

  const readTextFile = async (relativePath) => {
    const absolutePath = resolveWorkspacePath(relativePath)
    const buffer = await fs.readFile(absolutePath)

    if (!isTextBuffer(buffer)) {
      throw new Error('Only text files can be opened.')
    }

    return text.decode(buffer)
  }

  const writeTextFile = async (relativePath, value) => {
    const absolutePath = resolveWorkspacePath(relativePath)
    await fs.writeFile(absolutePath, value, 'utf8')
  }

  const getDirectoryEntries = async (relativePath = '') => {
    const absolutePath = resolveWorkspacePath(relativePath)
    const entries = await fs.readdir(absolutePath, { withFileTypes: true })

    return entries
      .filter((entry) => !ignoredDirectoryNames.has(entry.name))
      .sort((left, right) => {
        if (left.isDirectory() !== right.isDirectory()) {
          return left.isDirectory() ? -1 : 1
        }

        return left.name.localeCompare(right.name)
      })
      .slice(0, maxDirectoryEntries)
      .map((entry) => {
        const entryPath = path.posix.join(relativePath.replaceAll(path.sep, '/'), entry.name)

        return {
          name: entry.name,
          path: entryPath,
          type: entry.isDirectory() ? 'directory' : 'file',
        }
      })
  }

  const createWorkspaceEntry = async ({ path: parentPath = '', name, type }) => {
    const cleanParentPath = getRelativePath(parentPath)
    const cleanName = getCleanEntryName(name)
    const entryPath = path.posix.join(cleanParentPath, cleanName)
    const absolutePath = resolveWorkspacePath(entryPath)

    if (type === 'file') {
      await fs.writeFile(absolutePath, '', { flag: 'wx' })
    } else if (type === 'directory') {
      await fs.mkdir(absolutePath)
    } else {
      throw new Error('Type must be file or directory.')
    }

    return {
      name: cleanName,
      path: entryPath,
      type,
    }
  }

  const clearSaveTimersForPath = (relativePath) => {
    const prefix = `${relativePath}/`

    for (const [docName, timer] of docSaveTimers) {
      if (docName === relativePath || docName.startsWith(prefix)) {
        clearTimeout(timer)
        docSaveTimers.delete(docName)
      }
    }
  }

  const deleteWorkspaceEntry = async ({ path: entryPath }) => {
    const cleanEntryPath = getRelativePath(entryPath)

    if (!cleanEntryPath) {
      throw new Error('Cannot delete the workspace root.')
    }

    const absolutePath = resolveWorkspacePath(cleanEntryPath)
    const stats = await fs.lstat(absolutePath)
    const type = stats.isDirectory() ? 'directory' : 'file'

    await fs.rm(absolutePath, { recursive: stats.isDirectory(), force: false })
    clearSaveTimersForPath(cleanEntryPath)

    return {
      name: path.basename(cleanEntryPath),
      path: cleanEntryPath,
      type,
    }
  }

  const moveWorkspaceEntry = async ({ path: entryPath, toDirectory }) => {
    const cleanFrom = getRelativePath(entryPath)
    const cleanToDir = getRelativePath(toDirectory ?? '')

    if (!cleanFrom) {
      throw new Error('Cannot move workspace root.')
    }

    const fromDirPrefix = `${cleanFrom}/`

    if (cleanToDir === cleanFrom || cleanToDir.startsWith(fromDirPrefix)) {
      throw new Error('Cannot move an item into itself or its children.')
    }

    const normalizedFrom = cleanFrom.replaceAll('\\', '/')
    const baseName = path.posix.basename(normalizedFrom)
    const newRelative = cleanToDir ? path.posix.join(cleanToDir, baseName) : baseName

    if (newRelative === cleanFrom) {
      throw new Error('Already in that location.')
    }

    const absFrom = resolveWorkspacePath(cleanFrom)
    const absTo = resolveWorkspacePath(newRelative)

    try {
      await fs.stat(absTo)
      throw new Error('Destination already exists.')
    } catch (error) {
      if (error && error.code !== 'ENOENT') {
        if (error.message === 'Destination already exists.') {
          throw error
        }

        throw error
      }
    }

    await fs.rename(absFrom, absTo)
    clearSaveTimersForPath(cleanFrom)

    const stats = await fs.lstat(absTo)
    const type = stats.isDirectory() ? 'directory' : 'file'

    return {
      from: cleanFrom,
      to: newRelative,
      type,
    }
  }

  const uploadWorkspaceFile = (request) =>
    new Promise((resolve, reject) => {
      const contentType = request.headers['content-type']

      if (!contentType || !String(contentType).toLowerCase().includes('multipart/form-data')) {
        reject(new Error('Expected multipart form data.'))
        return
      }

      let relativePathField = ''
      const fileChunks = []
      let sawFileField = false
      let limitHit = false
      let settled = false

      const settle = (fn) => {
        if (settled) {
          return
        }
        settled = true
        fn()
      }

      const bb = busboy({
        headers: request.headers,
        limits: { fileSize: maxUploadBytes },
      })

      bb.on('field', (name, value) => {
        if (name === 'path') {
          relativePathField = String(value ?? '')
        }
      })

      bb.on('file', (name, fileStream) => {
        if (name !== 'file') {
          fileStream.resume()
          return
        }
        sawFileField = true
        fileStream.on('data', (chunk) => {
          fileChunks.push(chunk)
        })
        fileStream.on('limit', () => {
          limitHit = true
        })
      })

      bb.on('error', (err) => {
        settle(() => reject(err))
      })

      bb.on('finish', () => {
        void (async () => {
          try {
            if (limitHit) {
              throw new Error('File too large.')
            }
            if (!sawFileField || !relativePathField.trim()) {
              throw new Error('Missing file or path.')
            }
            const clean = getRelativePath(relativePathField)

            if (!clean) {
              throw new Error('Invalid path.')
            }
            const abs = resolveWorkspacePath(clean)
            await fs.mkdir(path.dirname(abs), { recursive: true })
            await fs.writeFile(abs, Buffer.concat(fileChunks))
            settle(() => resolve({ path: clean.replaceAll(path.sep, '/') }))
          } catch (error) {
            settle(() =>
              reject(error instanceof Error ? error : new Error('Unable to upload file.')),
            )
          }
        })()
      })

      request.pipe(bb)
    })

  const serveWorkspaceFile = async (relativePath, response, sendJson) => {
    if (!relativePath) {
      sendJson(response, 400, { error: 'Path is required.' })
      return
    }

    try {
      const absolutePath = resolveWorkspacePath(relativePath)
      const stats = await fs.stat(absolutePath)

      if (!stats.isFile()) {
        sendJson(response, 400, { error: 'Not a file.' })
        return
      }

      const buffer = await fs.readFile(absolutePath)
      const ext = path.extname(absolutePath).toLowerCase()
      const mimeTypes = {
        '.pdf': 'application/pdf',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml',
      }
      const contentType = mimeTypes[ext] ?? 'application/octet-stream'

      response.writeHead(200, {
        'content-type': contentType,
        'cache-control': 'no-store',
      })
      response.end(buffer)
    } catch (error) {
      sendJson(response, 400, {
        error: error instanceof Error ? error.message : 'Unable to read file.',
      })
    }
  }

  const scheduleDocSave = (docName, yText) => {
    clearTimeout(docSaveTimers.get(docName))
    docSaveTimers.set(
      docName,
      setTimeout(() => {
        void writeTextFile(docName, yText.toString()).catch((error) => {
          console.error(`Unable to save ${docName}:`, error)
        })
      }, 250),
    )
  }

  return {
    workspaceName,
    resolveWorkspacePath,
    readTextFile,
    writeTextFile,
    getDirectoryEntries,
    createWorkspaceEntry,
    deleteWorkspaceEntry,
    moveWorkspaceEntry,
    uploadWorkspaceFile,
    serveWorkspaceFile,
    scheduleDocSave,
    docSaveTimers,
  }
}
