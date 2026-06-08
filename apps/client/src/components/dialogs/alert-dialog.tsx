
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@workspace/ui/components/alert-dialog'
import React from 'react'

type AlertDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  description: string
  onConfirm?: () => void
  confirmText?: string
}

const AlertDialogComponent = ({
  open,
  onOpenChange,
  title = 'Alert',
  description,
  onConfirm,
  confirmText = 'OK',
}: AlertDialogProps) => {
  const handleConfirm = () => {
    onConfirm?.()
    onOpenChange(false)
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={handleConfirm}>
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export { AlertDialogComponent as AlertDialog }
export type { AlertDialogProps }
