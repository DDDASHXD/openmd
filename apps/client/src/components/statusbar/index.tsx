
import React from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@workspace/ui/components/dialog'
import { fetchLeafmarkFolders, fetchLeafmarkStatus, type LeafmarkStatus } from '@/lib/leafmark-client'
import { useCollaborationStore } from '@/stores/collaboration.store'
import { useSessionStore } from '@/stores/session.store'
import { useSettingsStore } from '@/stores/settings.store'

type LeafmarkStatusMetric = {
  key: keyof Pick<
    LeafmarkStatus,
    'chapters' | 'words' | 'charsWithSpaces' | 'charsWithoutSpaces'
  >
  label: string
}

const leafmarkStatusMetrics: LeafmarkStatusMetric[] = [
  { key: 'chapters', label: 'Chapters' },
  { key: 'words', label: 'Words' },
  { key: 'charsWithSpaces', label: 'Characters with spaces' },
  { key: 'charsWithoutSpaces', label: 'Characters without spaces' },
]

const defaultLeafmarkMetricKey: LeafmarkStatusMetric['key'] = 'charsWithSpaces'
const defaultLeafmarkMetric = leafmarkStatusMetrics[2] as LeafmarkStatusMetric
const leafmarkMetricStorageKey = 'foliage.leafmark.statusMetric'

const getSavedLeafmarkMetricKey = (): LeafmarkStatusMetric['key'] => {
  if (typeof window === 'undefined') {
    return defaultLeafmarkMetricKey
  }

  const saved = window.localStorage.getItem(leafmarkMetricStorageKey)
  const metric = leafmarkStatusMetrics.find((item) => item.key === saved)

  return metric?.key ?? defaultLeafmarkMetricKey
}

const getLeafmarkStatusFolder = async (settingsFolder: string | undefined) => {
  const { folders } = await fetchLeafmarkFolders()

  if (settingsFolder && folders.some((folder) => folder.path === settingsFolder)) {
    return settingsFolder
  }

  return (
    folders.find((folder) => folder.path === 'project')?.path ??
    folders.find((folder) => folder.isLeafmarkProject)?.path ??
    folders[0]?.path ??
    '.'
  )
}

const formatMetricValue = (value: number) => value.toLocaleString()

const Statusbar = () => {
  const connectionStatus = useCollaborationStore((state) => state.connectionStatus)
  const collaborators = useCollaborationStore((state) => state.collaborators)
  const mode = useSessionStore((state) => state.mode)
  const shareUrl = useSessionStore((state) => state.shareUrl)
  const settingsFolder = useSettingsStore((state) => state.settings.leafmark?.projectFolder)
  const [leafmarkStatus, setLeafmarkStatus] = React.useState<LeafmarkStatus | null>(null)
  const [leafmarkMetricKey, setLeafmarkMetricKey] =
    React.useState<LeafmarkStatusMetric['key']>(defaultLeafmarkMetricKey)
  const [leafmarkMetricOpen, setLeafmarkMetricOpen] = React.useState(false)

  const remoteCollaborators = collaborators.filter((collaborator) => !collaborator.isLocal)
  const showConnectionStatus =
    mode === 'server' ||
    mode === 'live-share-host' ||
    mode === 'live-share-guest' ||
    remoteCollaborators.length > 0
  const selectedMetric =
    leafmarkStatusMetrics.find((metric) => metric.key === leafmarkMetricKey) ??
    defaultLeafmarkMetric

  const loadLeafmarkStatus = React.useCallback(async () => {
    try {
      const folder = await getLeafmarkStatusFolder(settingsFolder)
      const status = await fetchLeafmarkStatus(folder)

      setLeafmarkStatus(status)
    } catch {
      setLeafmarkStatus(null)
    }
  }, [settingsFolder])

  React.useEffect(() => {
    setLeafmarkMetricKey(getSavedLeafmarkMetricKey())
  }, [])

  React.useEffect(() => {
    if (mode === 'launcher') {
      setLeafmarkStatus(null)
      return
    }

    let cancelled = false

    const loadStatus = async () => {
      const serverUrl = useSessionStore.getState().serverUrl

      if (!serverUrl) {
        if (!cancelled) {
          setLeafmarkStatus(null)
        }

        return
      }

      try {
        const folder = await getLeafmarkStatusFolder(settingsFolder)
        const status = await fetchLeafmarkStatus(folder)

        if (!cancelled) {
          setLeafmarkStatus(status)
        }
      } catch {
        if (!cancelled) {
          setLeafmarkStatus(null)
        }
      }
    }

    void loadStatus()
    const intervalId = window.setInterval(() => void loadStatus(), 5000)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [mode, settingsFolder])

  const handleMetricOpen = async () => {
    await loadLeafmarkStatus()
    setLeafmarkMetricOpen(true)
  }

  const handleMetricSelect = (metricKey: LeafmarkStatusMetric['key']) => {
    setLeafmarkMetricKey(metricKey)
    window.localStorage.setItem(leafmarkMetricStorageKey, metricKey)
    setLeafmarkMetricOpen(false)
  }

  return (
    <div className="w-full bg-secondary border-t px-2 py-1 text-xs flex items-center gap-4">
      {leafmarkStatus && (
        <>
          <button
            type="button"
            className="hover:text-foreground text-muted-foreground"
            onClick={() => void handleMetricOpen()}
          >
            {selectedMetric.label}: {formatMetricValue(leafmarkStatus[selectedMetric.key])}
          </button>
          <Dialog open={leafmarkMetricOpen} onOpenChange={setLeafmarkMetricOpen}>
            <DialogContent showCloseButton={false}>
              <DialogHeader>
                <DialogTitle>Leafmark status</DialogTitle>
              </DialogHeader>
              <div className="grid gap-1">
                {leafmarkStatusMetrics.map((metric) => (
                  <button
                    key={metric.key}
                    type="button"
                    className="hover:bg-accent hover:text-accent-foreground flex items-center justify-between gap-4 px-3 py-2 text-left text-sm"
                    onClick={() => handleMetricSelect(metric.key)}
                  >
                    <span>{metric.label}</span>
                    <span>{formatMetricValue(leafmarkStatus[metric.key])}</span>
                  </button>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
      {showConnectionStatus && (
        <span>
          Websocket: <span className="capitalize">{connectionStatus}</span>
        </span>
      )}
      {shareUrl && (
        <span className="text-muted-foreground truncate">Live share: {shareUrl}</span>
      )}
    </div>
  )
}

export default Statusbar
