'use client'

import React from 'react'
import { checkServerHealth } from '@/lib/backend-client'
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

export type ConnectServerDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConnect: (serverUrl: string, label: string) => void
}

export const ConnectServerDialog = ({
  open,
  onOpenChange,
  onConnect,
}: ConnectServerDialogProps) => {
  const [serverUrl, setServerUrl] = React.useState('')
  const [label, setLabel] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [connecting, setConnecting] = React.useState(false)

  const handleConnect = async () => {
    const trimmedUrl = serverUrl.trim()

    if (!trimmedUrl) {
      setError('Server URL is required.')
      return
    }

    setConnecting(true)
    setError(null)

    try {
      const normalized = trimmedUrl.replace(/\/+$/, '')
      const healthy = await checkServerHealth(normalized)

      if (!healthy) {
        throw new Error('Server is unreachable or not an openmd server.')
      }

      const displayLabel = label.trim() || new URL(normalized).host
      onConnect(normalized, displayLabel)
      onOpenChange(false)
      setServerUrl('')
      setLabel('')
    } catch (connectError) {
      setError(connectError instanceof Error ? connectError.message : 'Connection failed.')
    } finally {
      setConnecting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connect to server</DialogTitle>
          <DialogDescription>
            Enter the URL of a running openmd-server instance.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="server-url">Server URL</Label>
            <Input
              id="server-url"
              placeholder="https://notes.example.com:8787"
              value={serverUrl}
              onChange={(event) => setServerUrl(event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="server-label">Display name (optional)</Label>
            <Input
              id="server-label"
              placeholder="My team server"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
            />
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void handleConnect()} disabled={connecting}>
            {connecting ? 'Connecting...' : 'Connect'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
