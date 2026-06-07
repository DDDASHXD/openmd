'use client'

import React from 'react'
import { pickParentDirectory } from '@/lib/tauri-client'
import { Button } from '@workspace/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@workspace/ui/components/dialog'
import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'

export type CreateProjectDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (projectPath: string, projectName: string) => void
}

const sanitizeProjectName = (value: string) => {
  const trimmed = value.trim()

  if (!trimmed) {
    return null
  }

  const sanitized = trimmed.replace(/[/\\]+/g, '-')

  if (!sanitized || sanitized === '.' || sanitized === '..') {
    return null
  }

  return sanitized
}

const joinProjectPath = (parentDirectory: string, projectName: string) =>
  `${parentDirectory.replace(/[/\\]+$/, '')}/${projectName}`

export const CreateProjectDialog = ({
  open,
  onOpenChange,
  onCreate,
}: CreateProjectDialogProps) => {
  const [projectName, setProjectName] = React.useState('my-project')
  const [parentDirectory, setParentDirectory] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    if (!open) {
      setProjectName('my-project')
      setParentDirectory(null)
      setError(null)
      setBusy(false)
    }
  }, [open])

  const handleChooseLocation = async () => {
    setError(null)

    const parent = await pickParentDirectory()

    if (parent) {
      setParentDirectory(parent)
    }
  }

  const handleCreate = async () => {
    const sanitizedName = sanitizeProjectName(projectName)

    if (!sanitizedName) {
      setError('Project name is required.')
      return
    }

    if (!parentDirectory) {
      setError('Choose a location for the project.')
      return
    }

    setBusy(true)
    setError(null)

    try {
      const projectPath = joinProjectPath(parentDirectory, sanitizedName)
      onCreate(projectPath, sanitizedName)
      onOpenChange(false)
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Unable to create project.')
    } finally {
      setBusy(false)
    }
  }

  const previewPath =
    parentDirectory && sanitizeProjectName(projectName)
      ? joinProjectPath(parentDirectory, sanitizeProjectName(projectName) ?? '')
      : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create new project</DialogTitle>
          <DialogDescription>
            Choose a name and location. A project folder with sample files will be created.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="project-name">Project name</Label>
            <Input
              id="project-name"
              placeholder="my-project"
              value={projectName}
              onChange={(event) => setProjectName(event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Location</Label>
            <div className="flex gap-2">
              <Input
                readOnly
                placeholder="Choose a parent folder"
                value={parentDirectory ?? ''}
              />
              <Button type="button" variant="outline" onClick={() => void handleChooseLocation()}>
                Choose…
              </Button>
            </div>
            {previewPath && (
              <p className="text-muted-foreground text-xs">Will create: {previewPath}</p>
            )}
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void handleCreate()} disabled={busy}>
            {busy ? 'Creating...' : 'Create project'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
