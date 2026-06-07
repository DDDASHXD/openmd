'use client'

import React from 'react'
import { startLiveShare, stopLiveShare } from '@/lib/live-share-client'
import { useSessionStore } from '@/stores/session.store'
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

export type LiveShareDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const LiveShareDialog = ({ open, onOpenChange }: LiveShareDialogProps) => {
  const shareUrl = useSessionStore((state) => state.shareUrl)
  const relayUrl = useSessionStore((state) => state.relayUrl)
  const setRelayUrl = useSessionStore((state) => state.setRelayUrl)

  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const handleStart = async () => {
    setBusy(true)
    setError(null)

    try {
      await startLiveShare()
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : 'Unable to start live share.')
    } finally {
      setBusy(false)
    }
  }

  const handleStop = async () => {
    setBusy(true)
    await stopLiveShare()
    setBusy(false)
    onOpenChange(false)
  }

  const handleCopy = async () => {
    if (!shareUrl) {
      return
    }

    await navigator.clipboard.writeText(shareUrl)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Live share</DialogTitle>
          <DialogDescription>
            Share this project through a relay. Default relay: openmd.skxv.dev (self-hosted relays
            supported).
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="relay-url">Relay URL</Label>
            <Input
              id="relay-url"
              value={relayUrl}
              onChange={(event) => setRelayUrl(event.target.value)}
              placeholder="https://openmd.skxv.dev"
            />
          </div>

          {shareUrl && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="share-url">Public URL</Label>
              <Input id="share-url" readOnly value={shareUrl} />
            </div>
          )}

          {error && <p className="text-destructive text-sm">{error}</p>}
        </div>

        <DialogFooter>
          {shareUrl ? (
            <>
              <Button variant="outline" onClick={() => void handleCopy()}>
                Copy URL
              </Button>
              <Button variant="destructive" onClick={() => void handleStop()} disabled={busy}>
                Stop sharing
              </Button>
            </>
          ) : (
            <Button onClick={() => void handleStart()} disabled={busy}>
              {busy ? 'Starting...' : 'Start live share'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
