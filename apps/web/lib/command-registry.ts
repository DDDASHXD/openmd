import { useSettingsStore } from '@/stores/settings.store'
import { useFilesStore } from '@/stores/files.store'
import { useFileContentStore } from '@/stores/file-content.store'
import { exportMarkdownFiles } from '@/lib/export-markdown'
import { useLeafmarkStore } from '@/stores/leafmark.store'

export type CommandCategory = 'General' | 'File' | 'Edit' | 'View' | 'Window' | 'Settings' | 'Help'

export interface CommandShortcut {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  meta?: boolean
}

export interface Command {
  id: string
  title: string
  description?: string
  category: CommandCategory
  shortcut?: CommandShortcut
  icon?: React.ComponentType<{ className?: string }>
  when?: () => boolean
  execute?: () => void | Promise<void>
  children?: Command[]
  hidden?: boolean
}

export interface CommandGroup {
  id: string
  title: string
  commands: Command[]
}

function formatShortcut(shortcut: CommandShortcut): string {
  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform)
  const parts: string[] = []

  if (isMac) {
    if (shortcut.meta) parts.push('⌘')
    if (shortcut.shift) parts.push('⇧')
    if (shortcut.alt) parts.push('⌥')
    if (shortcut.ctrl) parts.push('⌃')
  } else {
    if (shortcut.ctrl) parts.push('Ctrl')
    if (shortcut.alt) parts.push('Alt')
    if (shortcut.shift) parts.push('Shift')
  }

  const key = shortcut.key.length === 1 ? shortcut.key.toUpperCase() : shortcut.key
  parts.push(key)

  return parts.join('+')
}

function shortcutMatches(event: KeyboardEvent, shortcut: CommandShortcut): boolean {
  const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase()
  const ctrlMatch = !!shortcut.ctrl === (event.ctrlKey || event.metaKey)
  const shiftMatch = !!shortcut.shift === event.shiftKey
  const altMatch = !!shortcut.alt === event.altKey
  const metaMatch = !!shortcut.meta === event.metaKey

  return keyMatch && ctrlMatch && shiftMatch && altMatch && metaMatch
}

class CommandRegistry {
  private commands: Map<string, Command> = new Map()
  private subscribers: Set<() => void> = new Set()

  register(command: Command): void {
    this.commands.set(command.id, command)
    this.notify()
  }

  registerMultiple(commands: Command[]): void {
    for (const command of commands) {
      this.commands.set(command.id, command)
    }
    this.notify()
  }

  unregister(commandId: string): void {
    this.commands.delete(commandId)
    this.notify()
  }

  getCommand(id: string): Command | undefined {
    return this.commands.get(id)
  }

  getAllCommands(): Command[] {
    return Array.from(this.commands.values())
  }

  getCommandsByCategory(category: CommandCategory): Command[] {
    return this.getAllCommands().filter((cmd) => cmd.category === category)
  }

  getCommandsForPalette(): Command[] {
    return this.getAllCommands()
      .filter((cmd) => !cmd.hidden && (!cmd.when || cmd.when()))
      .sort((a, b) => {
        const categoryOrder: CommandCategory[] = [
          'File',
          'Edit',
          'View',
          'Window',
          'Settings',
          'General',
          'Help',
        ]
        const aIndex = categoryOrder.indexOf(a.category)
        const bIndex = categoryOrder.indexOf(b.category)
        if (aIndex !== bIndex) {
          return aIndex - bIndex
        }
        return a.title.localeCompare(b.title)
      })
  }

  getShortcutDisplay(shortcut: CommandShortcut): string {
    return formatShortcut(shortcut)
  }

  handleKeydown(event: KeyboardEvent): boolean {
    for (const command of this.commands.values()) {
      if (command.hidden) continue
      if (command.shortcut && shortcutMatches(event, command.shortcut)) {
        if (!command.when || command.when()) {
          event.preventDefault()
          if (command.execute) {
            void command.execute()
          }
          return true
        }
      }
    }
    return false
  }

  subscribe(callback: () => void): () => void {
    this.subscribers.add(callback)
    return () => this.subscribers.delete(callback)
  }

  private notify(): void {
    for (const subscriber of this.subscribers) {
      subscriber()
    }
  }
}

export const commandRegistry = new CommandRegistry()

export function createDefaultCommands(): Command[] {
  return [
    {
      id: 'settings.reload',
      title: 'Reload Settings',
      description: 'Reload and apply changes from settings.json',
      category: 'Settings',
      shortcut: { key: 'r', meta: true, shift: true },
      execute: async () => {
        await useSettingsStore.getState().loadSettings(true)
      },
    },
    {
      id: 'settings.open',
      title: 'Open Settings',
      description: 'Edit workspace settings.json',
      category: 'Settings',
      execute: async () => {
        const { openFile } = useFilesStore.getState()
        openFile('.openmd/settings.json')
      },
    },
    {
      id: 'view.sidebar.toggle',
      hidden: true,
      title: 'Toggle Sidebar',
      description: 'Show or hide the sidebar',
      category: 'View',
      shortcut: { key: 'b', meta: true },
      execute: () => {
        // TODO: Implement sidebar toggle
      },
    },
    {
      id: 'file.leafmark',
      title: 'Leafmark',
      description: 'Open Leafmark project settings and build tools',
      category: 'File',
      execute: async () => {
        await useLeafmarkStore.getState().openDialog()
      },
    },
    {
      id: 'file.export',
      title: 'Export',
      description: 'Export markdown to PDF with Leafmark',
      category: 'File',
      execute: async () => {
        await exportMarkdownFiles()
      },
    },
    {
      id: 'file.quickOpen',
      hidden: true,
      title: 'Quick Open',
      description: 'Quickly open a file by name',
      category: 'File',
      shortcut: { key: 'p', meta: true },
      execute: () => {
        // TODO: Implement quick open
      },
    },
    {
      id: 'edit.formatDocument',
      title: 'Format Document',
      description: 'Format the current document',
      category: 'Edit',
      shortcut: { key: 'f', meta: true, shift: true },
      execute: async () => {
        const editor = useFileContentStore.getState().getCurrentEditor()
        if (!editor) return

        const model = editor.getModel()
        if (!model) return

        // Check if it's a markdown file
        const language = model.getLanguageId()
        if (language !== 'markdown') {
          // For non-markdown files, try Monaco's built-in formatter
          void editor.getAction('editor.action.formatDocument')?.run()
          return
        }

        // Format markdown with Prettier
        try {
          const [prettierMod, markdownMod] = await Promise.all([
            import('prettier/standalone'),
            import('prettier/plugins/markdown'),
          ])
          const prettier = prettierMod.default ?? prettierMod
          const markdownPlugin = markdownMod.default ?? markdownMod

          const currentText = model.getValue()
          const formatted = await prettier.format(currentText, {
            parser: 'markdown',
            plugins: [markdownPlugin],
            printWidth: 88,
            tabWidth: 2,
            useTabs: false,
            proseWrap: 'always',
            semi: false,
            singleQuote: true,
          })

          if (formatted === currentText) return

          const lineCount = model.getLineCount()
          const lastLineLength = model.getLineMaxColumn(lineCount)

          editor.executeEdits('format-document', [
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
        } catch {
          // Silently fail if Prettier can't format
        }
      },
    },
    {
      id: 'editor.commandPalette',
      title: 'Command Palette',
      description: 'Open the command palette',
      category: 'General',
      shortcut: { key: 'p', meta: true, shift: true },
      execute: () => {
        // Handled by the component directly
      },
    },
    {
      id: 'window.reload',
      title: 'Reload Window',
      description: 'Reload the application window',
      category: 'Window',
      shortcut: { key: 'r', meta: true },
      execute: () => {
        window.location.reload()
      },
    },
    {
      id: 'help.about',
      title: 'About OpenMD',
      description: 'View information about OpenMD',
      category: 'Help',
      children: [
        {
          id: 'help.about.name',
          title: 'OpenMD',
          description: 'A local-first markdown/code workspace UI',
          category: 'Help',
        },
        {
          id: 'help.about.version',
          title: 'Version',
          description: '0.0.1',
          category: 'Help',
          execute: () => {
            //copy
            navigator.clipboard.writeText('0.0.1')
          },
        },
        {
          id: 'help.about.website',
          title: 'Website',
          description: 'github.com/DDDASHXD/openmd',
          category: 'Help',
        },
        {
          id: 'help.about.description',
          title: 'Description',
          description:
            'File tree, multi-pane editor, tiling via drag-to-edge splits, and Yjs-based collaboration',
          category: 'Help',
        },
      ],
    },
  ]
}
