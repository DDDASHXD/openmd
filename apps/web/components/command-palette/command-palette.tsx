'use client'

import React from 'react'
import { ArrowLeft, ChevronRight, X } from 'lucide-react'
import { Command as CommandPrimitive } from 'cmdk'
import { Button } from '@workspace/ui/components/button'
import { cn } from '@workspace/ui/lib/utils'
import {
  commandRegistry,
  type Command as CommandType,
  type CommandCategory,
} from '@/lib/command-registry'

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  path?: { id: string; title: string }[]
  onNavigate?: (command: CommandType) => void
  onGoBack?: () => void
  canGoBack?: boolean
  currentCommands?: CommandType[]
}

const categoryOrder: CommandCategory[] = [
  'File',
  'Edit',
  'View',
  'Window',
  'Settings',
  'General',
  'Help',
]

const categoryLabels: Record<CommandCategory, string> = {
  File: 'File',
  Edit: 'Edit',
  View: 'View',
  Window: 'Window',
  Settings: 'Settings',
  General: 'General',
  Help: 'Help',
}

function getShortcutDisplay(shortcut?: CommandType['shortcut']): string | null {
  if (!shortcut) return null
  return commandRegistry.getShortcutDisplay(shortcut)
}

export const CommandPalette = ({
  open,
  onOpenChange,
  path = [],
  onNavigate,
  onGoBack,
  canGoBack = false,
  currentCommands = [],
}: CommandPaletteProps) => {
  const [search, setSearch] = React.useState('')

  React.useEffect(() => {
    if (open) {
      setSearch('')
    }
  }, [open, path])

  const groupedCommands = React.useMemo(() => {
    const groups: Record<CommandCategory, CommandType[]> = {
      File: [],
      Edit: [],
      View: [],
      Window: [],
      Settings: [],
      General: [],
      Help: [],
    }

    for (const command of currentCommands) {
      if (command.category) {
        groups[command.category].push(command)
      }
    }

    return Object.entries(groups)
      .filter(([, cmds]) => cmds.length > 0)
      .sort(
        ([a], [b]) =>
          categoryOrder.indexOf(a as CommandCategory) - categoryOrder.indexOf(b as CommandCategory),
      )
      .map(([category, cmds]) => ({
        category: category as CommandCategory,
        commands: cmds,
      }))
  }, [currentCommands])

  const handleSelect = React.useCallback(
    async (command: CommandType) => {
      // If command has children, navigate into it
      if (command.children && command.children.length > 0) {
        onNavigate?.(command)
        setSearch('')
        return
      }

      // Otherwise execute the command
      if (command.execute) {
        await command.execute()
      }
      onOpenChange(false)
    },
    [onNavigate, onOpenChange],
  )

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Escape' && !canGoBack) {
        onOpenChange(false)
        return
      }

      if ((event.key === 'Backspace' || event.key === 'ArrowLeft') && !search && canGoBack) {
        event.preventDefault()
        onGoBack?.()
        return
      }

      if (event.key === 'Escape' && canGoBack) {
        event.preventDefault()
        event.stopPropagation()
        onGoBack?.()
      }
    },
    [search, canGoBack, onGoBack, onOpenChange],
  )

  // Handle click outside
  React.useEffect(() => {
    if (!open) return

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      if (target.closest('[data-command-palette]')) return
      onOpenChange(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open, onOpenChange])

  const inputPlaceholder = canGoBack ? 'Filter this menu...' : 'Type a command or search...'

  if (!open) return null

  return (
    <div
      data-command-palette
      className="fixed left-1/2 top-[50px] z-50 w-full max-w-[600px] -translate-x-1/2 overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-2xl"
      onKeyDown={handleKeyDown}
    >
      <CommandPrimitive className="flex size-full flex-col overflow-hidden" loop>
        {/* Header with back button and close */}
        <div className="flex items-center gap-2 border-b border-border px-3 pt-3 pb-2">
          {canGoBack ? (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onGoBack}
              aria-label="Go back"
              className="shrink-0 h-8 w-8"
            >
              <ArrowLeft size={16} />
            </Button>
          ) : null}

          <div className="flex-1">
            <CommandPrimitive.Input
              value={search}
              onValueChange={setSearch}
              placeholder={inputPlaceholder}
              className="w-full bg-transparent text-sm outline-hidden placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
              autoFocus
            />
          </div>

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
            className="shrink-0 h-8 w-8"
          >
            <X size={16} />
          </Button>
        </div>

        {/* Breadcrumbs */}
        {path.length > 0 && (
          <div className="flex items-center gap-1 border-b border-border px-4 py-1.5 text-xs text-muted-foreground">
            <span>Menu</span>
            {path.map((item) => (
              <React.Fragment key={item.id}>
                <ChevronRight size={12} />
                <span>{item.title}</span>
              </React.Fragment>
            ))}
          </div>
        )}

        {/* Command List */}
        <CommandPrimitive.List className="max-h-[300px] overflow-y-auto overflow-x-hidden p-1">
          <CommandPrimitive.Empty className="py-6 text-center text-xs text-muted-foreground">
            No commands found.
          </CommandPrimitive.Empty>
          {groupedCommands.map(({ category, commands }) => (
            <CommandPrimitive.Group
              key={category}
              heading={categoryLabels[category]}
              className="overflow-hidden text-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-muted-foreground"
            >
              {commands.map((command) => (
                <CommandPrimitive.Item
                  key={command.id}
                  onSelect={() => void handleSelect(command)}
                  className={cn(
                    'relative flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-xs outline-hidden select-none',
                    'hover:bg-accent hover:text-accent-foreground',
                    'data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground',
                  )}
                >
                  <span className="flex-1 truncate">{command.title}</span>
                  {command.shortcut ? (
                    <span className="ml-auto text-xs text-muted-foreground">
                      {getShortcutDisplay(command.shortcut)}
                    </span>
                  ) : (
                    command.description && (
                      <span className="ml-auto text-xs text-muted-foreground truncate max-w-[200px]">
                        {command.description}
                      </span>
                    )
                  )}
                  {command.children && (
                    <ChevronRight size={14} className="ml-2 text-muted-foreground" />
                  )}
                </CommandPrimitive.Item>
              ))}
            </CommandPrimitive.Group>
          ))}
        </CommandPrimitive.List>

        {/* Footer with keyboard hints */}
        <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="rounded border border-border/70 bg-muted px-1.5 py-0.5">Enter</span>
            <span>Open</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded border border-border/70 bg-muted px-1.5 py-0.5">
              Arrow Keys
            </span>
            <span>Navigate</span>
          </div>
          {canGoBack ? (
            <div className="flex items-center gap-2">
              <span className="rounded border border-border/70 bg-muted px-1.5 py-0.5">
                Backspace
              </span>
              <span>Back</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="rounded border border-border/70 bg-muted px-1.5 py-0.5">Esc</span>
              <span>Close</span>
            </div>
          )}
        </div>
      </CommandPrimitive>
    </div>
  )
}
