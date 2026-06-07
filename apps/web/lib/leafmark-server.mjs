import { createRequire } from 'node:module'
import fs from 'node:fs/promises'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const require = createRequire(import.meta.url)

const getLeafmarkRoot = () => {
  const appRoot = process.env.OPENMD_APP_ROOT ?? process.cwd()
  return path.dirname(require.resolve('@skxv/leafmark/package.json', { paths: [appRoot] }))
}

const importLeafmark = async (subpath) => {
  const leafmarkRoot = getLeafmarkRoot()
  return import(path.join(leafmarkRoot, 'lib', subpath))
}

const activeWatchers = new Map()

const resolveInsideWorkspace = (workspaceRoot, relativePath = '') => {
  const cleanPath = String(relativePath ?? '')
    .replaceAll('\\', '/')
    .replace(/^\/+/, '')

  const resolvedPath = path.resolve(workspaceRoot, cleanPath || '.')
  const relativeFromWorkspace = path.relative(workspaceRoot, resolvedPath)

  if (relativeFromWorkspace.startsWith('..') || path.isAbsolute(relativeFromWorkspace)) {
    throw new Error('Path is outside the workspace.')
  }

  return {
    absolutePath: resolvedPath,
    relativePath: relativeFromWorkspace.replaceAll('\\', '/') || '.',
  }
}

const toRelativePath = (workspaceRoot, absolutePath) =>
  path.relative(workspaceRoot, absolutePath).replaceAll('\\', '/')

const watchKey = (workspaceRoot, relativeFolder) => `${workspaceRoot}::${relativeFolder || '.'}`

const buildCliOptions = (options = {}) => ({
  command: 'build',
  themeCommand: null,
  targetArg: null,
  positional: options.chapters ?? [],
  wantHelp: false,
  wantHtml: Boolean(options.html || options.htmlOnly),
  htmlOnly: Boolean(options.htmlOnly),
  noMergeCover: Boolean(options.noMergeCover),
  yes: true,
  skipToolsCheck: true,
})

const discoverProjectWorkspace = async (absoluteInputRoot) => {
  const { discoverWorkspace } = await importLeafmark('workspace/workspace.js')
  return discoverWorkspace(absoluteInputRoot)
}

const getProjectContext = async (workspaceRoot, relativeFolder = '') => {
  const { absolutePath, relativePath } = resolveInsideWorkspace(workspaceRoot, relativeFolder)
  const { isLeafmarkProject } = await importLeafmark('workspace/workspace.js')

  if (!existsSync(absolutePath) || !statSync(absolutePath).isDirectory()) {
    throw new Error('Folder not found.')
  }

  const workspace = await discoverProjectWorkspace(absolutePath)

  return {
    workspace,
    absolutePath,
    relativePath,
    isLeafmarkProject: isLeafmarkProject(workspace.projectBase),
    projectBaseRelative: toRelativePath(workspaceRoot, workspace.projectBase),
    outputRootRelative: toRelativePath(workspaceRoot, workspace.outputRoot),
  }
}

const collectOutputs = async (workspaceRoot, workspace) => {
  const distDir = workspace.outputRoot
  const pdfAbs = path.join(distDir, 'output.pdf')
  const htmlAbs = path.join(distDir, 'thesis.html')
  const outputs = {}

  try {
    await fs.access(pdfAbs)
    outputs.pdf = toRelativePath(workspaceRoot, pdfAbs)
  } catch {
    // PDF was not produced.
  }

  try {
    await fs.access(htmlAbs)
    outputs.html = toRelativePath(workspaceRoot, htmlAbs)
  } catch {
    // HTML was not produced.
  }

  return outputs
}

const listBundles = async (projectBaseAbs) => {
  const { isLeafmarkProject } = await importLeafmark('workspace/workspace.js')

  if (!existsSync(projectBaseAbs)) {
    return []
  }

  return readdirSync(projectBaseAbs, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .filter((entry) => isLeafmarkProject(path.join(projectBaseAbs, entry.name)))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b))
}

export const listLeafmarkFolders = async (workspaceRoot) => {
  const { isLeafmarkProject } = await importLeafmark('workspace/workspace.js')
  const ignored = new Set(['.git', '.next', '.turbo', '.openmd', 'node_modules', 'dist'])
  const folders = []
  const seen = new Set()

  const addFolder = (relativePath, absPath) => {
    const key = relativePath || '.'
    if (seen.has(key)) {
      return
    }

    seen.add(key)

    if (!existsSync(absPath) || !statSync(absPath).isDirectory()) {
      return
    }

    folders.push({
      path: key,
      isLeafmarkProject: isLeafmarkProject(absPath),
    })
  }

  addFolder('.', path.resolve(workspaceRoot))

  try {
    const entries = await fs.readdir(workspaceRoot, { withFileTypes: true })

    for (const entry of entries) {
      if (!entry.isDirectory() || ignored.has(entry.name) || entry.name.startsWith('.')) {
        continue
      }

      addFolder(entry.name, path.join(workspaceRoot, entry.name))
    }
  } catch {
    // Workspace root unreadable.
  }

  return folders.sort((left, right) => {
    if (left.isLeafmarkProject !== right.isLeafmarkProject) {
      return left.isLeafmarkProject ? -1 : 1
    }

    if (left.path === 'project') {
      return -1
    }

    if (right.path === 'project') {
      return 1
    }

    return left.path.localeCompare(right.path)
  })
}

export const getLeafmarkProject = async (workspaceRoot, relativeFolder = '') => {
  const context = await getProjectContext(workspaceRoot, relativeFolder)
  const { readProjectConfig } = await importLeafmark('workspace/config.js')
  const { listMarkdownFiles } = await importLeafmark('workspace/chapters.js')

  let config = {}
  let chapters = []

  try {
    config = readProjectConfig(context.workspace.projectBase)
    chapters = listMarkdownFiles(context.workspace.projectBase)
  } catch (error) {
    if (context.isLeafmarkProject) {
      throw error
    }
  }

  const bundles = await listBundles(context.workspace.projectBase)

  return {
    folder: context.relativePath,
    isLeafmarkProject: context.isLeafmarkProject,
    projectBase: context.projectBaseRelative,
    outputRoot: context.outputRootRelative,
    config,
    chapters,
    bundles,
    watching: activeWatchers.has(watchKey(workspaceRoot, context.relativePath)),
  }
}

export const getLeafmarkStatus = async (workspaceRoot, relativeFolder = '', bundle = null) => {
  const { countPlainText, stripMarkdownToPlainText } = await importLeafmark('markdown-plain.js')
  const { normalizeConfig } = await importLeafmark('thesis-meta.js')
  const { resolveChapterFiles } = await importLeafmark('workspace/chapters.js')
  const { readProjectConfig, readProjectMetadata } = await importLeafmark('workspace/config.js')

  const context = await getProjectContext(workspaceRoot, relativeFolder)
  const activeProjectDir = bundle
    ? path.join(context.workspace.projectBase, bundle)
    : context.workspace.projectBase

  if (!existsSync(activeProjectDir)) {
    throw new Error(`Bundle folder not found: ${bundle}`)
  }

  const config = readProjectConfig(activeProjectDir)
  const rawYaml = readProjectMetadata(activeProjectDir, config)
  const chapterFiles = resolveChapterFiles([], activeProjectDir, config)

  const meta = normalizeConfig(rawYaml)
  const parts = []

  if (meta.title) {
    parts.push(stripMarkdownToPlainText(meta.title))
  }

  if (meta.subtitle) {
    parts.push(stripMarkdownToPlainText(meta.subtitle))
  }

  if (typeof rawYaml.abstract === 'string' && rawYaml.abstract.trim()) {
    parts.push(stripMarkdownToPlainText(rawYaml.abstract))
  }

  for (const entry of meta.authorEntries) {
    for (const line of entry) {
      if (typeof line === 'string') {
        parts.push(stripMarkdownToPlainText(line))
      } else {
        parts.push(line.orcid)
      }
    }
  }

  for (const file of chapterFiles) {
    const raw = readFileSync(path.join(activeProjectDir, file), 'utf-8').replace(/\r\n/g, '\n')
    parts.push(stripMarkdownToPlainText(raw))
  }

  const counts = countPlainText(parts.filter(Boolean).join(' '))

  return {
    folder: context.relativePath,
    bundle,
    input: toRelativePath(workspaceRoot, activeProjectDir),
    chapters: chapterFiles.length,
    words: counts.words,
    charsWithSpaces: counts.charsWithSpaces,
    charsWithoutSpaces: counts.charsWithoutSpaces,
  }
}

export const listLeafmarkThemes = async () => {
  const { PACKAGE_ROOT } = await importLeafmark('system/paths.js')
  const themesDir = path.join(PACKAGE_ROOT, 'src', 'themes')

  if (!existsSync(themesDir)) {
    return []
  }

  return readdirSync(themesDir)
    .map((name) => {
      const manifestPath = path.join(themesDir, name, '.leafmark', 'theme.json')

      if (!existsSync(manifestPath)) {
        return null
      }

      try {
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))
        return {
          name,
          description: typeof manifest.description === 'string' ? manifest.description : '',
        }
      } catch {
        return { name, description: '' }
      }
    })
    .filter(Boolean)
    .sort((left, right) => left.name.localeCompare(right.name))
}

export const initLeafmarkProject = async (workspaceRoot, relativeFolder = '') => {
  const { initFolder } = await importLeafmark('workspace/init.js')
  const { absolutePath, relativePath } = resolveInsideWorkspace(workspaceRoot, relativeFolder)

  initFolder(absolutePath)

  return getLeafmarkProject(workspaceRoot, relativePath)
}

export const initLeafmarkTheme = async (workspaceRoot, relativeFolder = '') => {
  const { initThemeFolder } = await importLeafmark('workspace/theme.js')
  const { absolutePath, relativePath } = resolveInsideWorkspace(workspaceRoot, relativeFolder)

  initThemeFolder(absolutePath)

  return {
    folder: relativePath,
    message: `Initialized Leafmark theme scaffold in ${relativePath}`,
  }
}

export const applyLeafmarkTheme = async (workspaceRoot, relativeFolder, themeArg) => {
  const { useTheme } = await importLeafmark('workspace/theme.js')
  const context = await getProjectContext(workspaceRoot, relativeFolder)

  if (!themeArg?.trim()) {
    throw new Error('Theme name or GitHub URL is required.')
  }

  useTheme(context.workspace.projectBase, themeArg.trim())

  return getLeafmarkProject(workspaceRoot, context.relativePath)
}

export const updateLeafmarkConfig = async (workspaceRoot, relativeFolder, config) => {
  const { writeProjectConfig } = await importLeafmark('workspace/config.js')
  const context = await getProjectContext(workspaceRoot, relativeFolder)

  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error('Config must be a JSON object.')
  }

  writeProjectConfig(context.workspace.projectBase, config)

  return getLeafmarkProject(workspaceRoot, context.relativePath)
}

export const updateLeafmarkOrder = async (workspaceRoot, relativeFolder, order) => {
  const { updateProjectOrder } = await importLeafmark('workspace/config.js')
  const context = await getProjectContext(workspaceRoot, relativeFolder)

  if (!Array.isArray(order)) {
    throw new Error('Chapter order must be an array.')
  }

  updateProjectOrder(context.workspace.projectBase, order)

  return getLeafmarkProject(workspaceRoot, context.relativePath)
}

export const buildLeafmarkProject = async (workspaceRoot, relativeFolder = '', options = {}) => {
  const { buildOnce } = await importLeafmark('build/build.js')
  const { ensureFirstRunTools } = await importLeafmark('system/tools.js')
  const { splitBundleAndChapters } = await importLeafmark('workspace/bundles.js')

  const context = await getProjectContext(workspaceRoot, relativeFolder)
  const positional = []

  if (options.bundle) {
    positional.push(options.bundle)
  }

  if (Array.isArray(options.chapters)) {
    positional.push(...options.chapters)
  }

  const opts = {
    ...buildCliOptions(options),
    positional,
  }

  await ensureFirstRunTools(opts)

  const workspace = await discoverProjectWorkspace(context.absolutePath)
  const split = splitBundleAndChapters(positional, workspace)
  const activeProjectDir = split.bundleName
    ? path.join(workspace.projectBase, split.bundleName)
    : workspace.projectBase
  const outputRoot = split.bundleName
    ? path.join(workspace.outputRoot, split.bundleName)
    : workspace.outputRoot

  await buildOnce(workspace, opts)

  const outputs = await collectOutputs(workspaceRoot, {
    ...workspace,
    outputRoot,
    projectBase: activeProjectDir,
  })

  return {
    folder: context.relativePath,
    bundle: split.bundleName,
    projectBase: toRelativePath(workspaceRoot, activeProjectDir),
    outputs,
  }
}

export const startLeafmarkWatch = async (workspaceRoot, relativeFolder = '', options = {}) => {
  const key = watchKey(workspaceRoot, relativeFolder)

  if (activeWatchers.has(key)) {
    return { watching: true, folder: relativeFolder || '.' }
  }

  const { buildOnce } = await importLeafmark('build/build.js')
  const { ensureFirstRunTools } = await importLeafmark('system/tools.js')
  const chokidarPath = createRequire(path.join(getLeafmarkRoot(), 'package.json')).resolve('chokidar')
  const chokidarModule = await import(chokidarPath)
  const chokidar = chokidarModule.default ?? chokidarModule

  const context = await getProjectContext(workspaceRoot, relativeFolder)
  const opts = buildCliOptions(options)

  await ensureFirstRunTools(opts)

  const workspace = await discoverProjectWorkspace(context.absolutePath)
  let running = false
  let pending = false
  let stopped = false

  const run = async () => {
    if (stopped || running) {
      pending = true
      return
    }

    running = true

    try {
      await buildOnce(workspace, opts)
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error))
    } finally {
      running = false

      if (pending && !stopped) {
        pending = false
        await run()
      }
    }
  }

  await run()

  const watcher = chokidar.watch(workspace.projectBase, {
    ignoreInitial: true,
    ignored: [workspace.outputRoot, /(^|[/\\])\../],
  })

  watcher.on('all', () => {
    pending = true
    setTimeout(() => {
      void run()
    }, 100)
  })

  activeWatchers.set(key, {
    stop: async () => {
      stopped = true
      pending = false
      await watcher.close()
      activeWatchers.delete(key)
    },
  })

  return {
    watching: true,
    folder: context.relativePath,
  }
}

export const stopLeafmarkWatch = async (workspaceRoot, relativeFolder = '') => {
  const key = watchKey(workspaceRoot, relativeFolder)
  const session = activeWatchers.get(key)

  if (!session) {
    return { watching: false, folder: relativeFolder || '.' }
  }

  await session.stop()

  return { watching: false, folder: relativeFolder || '.' }
}

export const getLeafmarkWatchStatus = (workspaceRoot, relativeFolder = '') => ({
  watching: activeWatchers.has(watchKey(workspaceRoot, relativeFolder)),
  folder: relativeFolder || '.',
})

export const runLeafmarkExport = async (workspaceRoot, relativeFolder = '', options = {}) => {
  const result = await buildLeafmarkProject(workspaceRoot, relativeFolder, options)

  return {
    exportDir: result.projectBase,
    outputs: result.outputs,
    folder: result.folder,
    bundle: result.bundle ?? null,
  }
}

export const handleLeafmarkRequest = async (workspaceRoot, method, payload = {}, query = {}) => {
  const action = method === 'GET' ? query.action : payload.action

  switch (action) {
    case 'folders':
      return { folders: await listLeafmarkFolders(workspaceRoot) }
    case 'project':
      return getLeafmarkProject(workspaceRoot, query.folder ?? payload.folder ?? '')
    case 'status':
      return getLeafmarkStatus(
        workspaceRoot,
        query.folder ?? payload.folder ?? '',
        query.bundle ?? payload.bundle ?? null,
      )
    case 'themes':
      return { themes: await listLeafmarkThemes() }
    case 'watch-status':
      return getLeafmarkWatchStatus(workspaceRoot, query.folder ?? payload.folder ?? '')
    case 'init':
      return initLeafmarkProject(workspaceRoot, payload.folder ?? '')
    case 'init-theme':
      return initLeafmarkTheme(workspaceRoot, payload.folder ?? '')
    case 'use-theme':
      return applyLeafmarkTheme(workspaceRoot, payload.folder ?? '', payload.theme)
    case 'update-config':
      return updateLeafmarkConfig(workspaceRoot, payload.folder ?? '', payload.config)
    case 'update-order':
      return updateLeafmarkOrder(workspaceRoot, payload.folder ?? '', payload.order)
    case 'build':
      return buildLeafmarkProject(workspaceRoot, payload.folder ?? '', payload.options ?? {})
    case 'watch-start':
      return startLeafmarkWatch(workspaceRoot, payload.folder ?? '', payload.options ?? {})
    case 'watch-stop':
      return stopLeafmarkWatch(workspaceRoot, payload.folder ?? '')
    default:
      throw new Error(`Unknown leafmark action: ${action ?? '(missing)'}`)
  }
}
