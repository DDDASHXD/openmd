
import * as React from 'react'
import { useSettingsStore } from '@/stores/settings.store'

interface SettingsProviderProps {
  children: React.ReactNode
}

export function SettingsProvider({ children }: SettingsProviderProps): React.ReactElement {
  const loadSettings = useSettingsStore((state) => state.loadSettings)

  React.useEffect(() => {
    void loadSettings()
  }, [loadSettings])

  return <>{children}</>
}
