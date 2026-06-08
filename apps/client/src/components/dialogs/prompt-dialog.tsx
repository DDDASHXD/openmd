
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@workspace/ui/components/dialog'
import { Button } from '@workspace/ui/components/button'
import React from 'react'

type PromptDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  defaultValue?: string
  onConfirm: (value: string) => void
  onCancel: () => void
}

const PromptDialog = ({
  open,
  onOpenChange,
  title,
  description,
  defaultValue = '',
  onConfirm,
  onCancel,
}: PromptDialogProps) => {
  const [value, setValue] = React.useState(defaultValue)

  React.useEffect(() => {
    if (open) {
      setValue(defaultValue)
    }
  }, [open, defaultValue])

  const handleConfirm = () => {
    onConfirm(value)
    onOpenChange(false)
  }

  const handleCancel = () => {
    onCancel()
    onOpenChange(false)
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleConfirm()
    } else if (event.key === 'Escape') {
      handleCancel()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <p className="text-muted-foreground text-sm">{description}</p>}
        </DialogHeader>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="border-input bg-background w-full rounded-none border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          autoFocus
        />
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>OK</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { PromptDialog }
export type { PromptDialogProps }
