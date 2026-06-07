'use client'

import * as React from 'react'
import {
  commandRegistry,
  createDefaultCommands,
  type Command,
  type CommandCategory,
  type CommandShortcut,
} from '@/lib/command-registry'

export interface CommandPathItem {
  id: string
  title: string
}

export interface UseCommandPaletteReturn {
  open: boolean
  setOpen: (open: boolean) => void
  toggle: () => void
  commands: Command[]
  registerCommand: (command: Command) => void
  unregisterCommand: (commandId: string) => void
  registerCommands: (commands: Command[]) => void
  path: CommandPathItem[]
  navigateToCommand: (command: Command) => void
  navigateToPath: (commandIds: string[]) => void
  goBack: () => void
  currentCommands: Command[]
  canGoBack: boolean
}

const CommandPaletteContext = React.createContext<UseCommandPaletteReturn | null>(null)

export function CommandPaletteProvider({
  children,
}: {
  children: React.ReactNode
}): React.ReactElement {
  const [open, setOpenState] = React.useState(false)
  const [commands, setCommands] = React.useState<Command[]>([])
  const [path, setPath] = React.useState<CommandPathItem[]>([])

  React.useEffect(() => {
    commandRegistry.registerMultiple(createDefaultCommands())
    setCommands(commandRegistry.getCommandsForPalette())

    const unsubscribe = commandRegistry.subscribe(() => {
      setCommands(commandRegistry.getCommandsForPalette())
    })

    return unsubscribe
  }, [])

  const setOpen = React.useCallback((nextOpen: boolean) => {
    setOpenState(nextOpen)
    if (!nextOpen) {
      setPath([])
    }
  }, [])

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Handle cmd/ctrl+shift+p to open command palette
      if (event.key.toLowerCase() === 'p' && (event.ctrlKey || event.metaKey) && event.shiftKey) {
        event.preventDefault()
        setOpenState((prev) => !prev)
        return
      }

      // Do not handle other shortcuts when palette is open
      if (open) return

      // Handle global keyboard shortcuts via registry
      commandRegistry.handleKeydown(event)
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open])

  const toggle = React.useCallback(() => {
    setOpenState((prev) => {
      if (prev) {
        setPath([])
      }
      return !prev
    })
  }, [])

  const registerCommand = React.useCallback((command: Command) => {
    commandRegistry.register(command)
  }, [])

  const unregisterCommand = React.useCallback((commandId: string) => {
    commandRegistry.unregister(commandId)
  }, [])

  const registerCommands = React.useCallback((cmds: Command[]) => {
    commandRegistry.registerMultiple(cmds)
  }, [])

  // Navigate into a command with children
  const navigateToCommand = React.useCallback((command: Command) => {
    if (command.children && command.children.length > 0) {
      setPath((current) => [...current, { id: command.id, title: command.title }])
    }
  }, [])

  // Go back one level
  const goBack = React.useCallback(() => {
    setPath((current) => current.slice(0, -1))
  }, [])

  // Get current commands based on path
  const currentCommands = React.useMemo(() => {
    let current = commands

    for (const pathItem of path) {
      const command = current.find((cmd) => cmd.id === pathItem.id)
      if (command?.children) {
        current = command.children.filter((cmd) => !cmd.hidden)
      } else {
        break
      }
    }

    // Filter out hidden commands at root level too
    return current.filter((cmd) => !cmd.hidden)
  }, [commands, path])

  // Navigate to a specific path by command IDs
  const navigateToPath = React.useCallback((commandIds: string[]) => {
    const newPath: CommandPathItem[] = []
    let currentCommandsList = commands.filter((cmd) => !cmd.hidden)

    for (const commandId of commandIds) {
      const command = currentCommandsList.find((cmd) => cmd.id === commandId)
      if (command && !command.hidden) {
        newPath.push({ id: command.id, title: command.title })
        if (command.children) {
          currentCommandsList = command.children.filter((cmd) => !cmd.hidden)
        } else {
          break
        }
      } else {
        break
      }
    }

    setPath(newPath)
  }, [commands])

  const canGoBack = path.length > 0

  const value = React.useMemo(
    () => ({
      open,
      setOpen,
      toggle,
      commands,
      registerCommand,
      unregisterCommand,
      registerCommands,
      path,
      navigateToCommand,
      navigateToPath,
      goBack,
      currentCommands,
      canGoBack,
    }),
    [open, toggle, commands, path, currentCommands, canGoBack, navigateToCommand, navigateToPath, goBack, setOpen, registerCommand, unregisterCommand, registerCommands]
  )

  return React.createElement(CommandPaletteContext.Provider, { value }, children)
}

export function useCommandPalette(): UseCommandPaletteReturn {
  const context = React.useContext(CommandPaletteContext)

  if (!context) {
    throw new Error('useCommandPalette must be used within a CommandPaletteProvider')
  }

  return context
}

// Hook for registering a single command inline in a component
export function useCommand(command: Command, deps: React.DependencyList = []): void {
  const { registerCommand, unregisterCommand } = useCommandPalette()

  React.useEffect(() => {
    registerCommand(command)
    return () => unregisterCommand(command.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

// Hook for easy command creation with auto-registration
export function useRegisterCommand(
  id: string,
  title: string,
  options: {
    description?: string
    category?: CommandCategory
    shortcut?: CommandShortcut
    when?: () => boolean
    execute?: () => void | Promise<void>
    children?: Command[]
  },
): void {
  const { registerCommand, unregisterCommand } = useCommandPalette()

  React.useEffect(() => {
    const command: Command = {
      id,
      title,
      description: options.description,
      category: options.category ?? 'General',
      shortcut: options.shortcut,
      when: options.when,
      execute: options.execute,
      children: options.children,
    }

    registerCommand(command)
    return () => unregisterCommand(id)
  }, [id, title, options, registerCommand, unregisterCommand])
}
