import { backendFetch } from '@/lib/backend-client'
import React from 'react'

export type BibEntry = {
  key: string
  type: string
  fields: Record<string, string>
  source: string
}

type BibEntriesCache = {
  entries: BibEntry[]
  timestamp: number
}

const CACHE_DURATION_MS = 60000 // 1 minute cache
let globalCache: BibEntriesCache | null = null

const fetchBibEntries = async (): Promise<BibEntry[]> => {
  const response = await backendFetch('/api/workspace/bib')

  if (!response.ok) {
    throw new Error('Failed to fetch bib entries')
  }

  const data = await response.json()
  return data.entries as BibEntry[]
}

export const useBibEntries = () => {
  const [entries, setEntries] = React.useState<BibEntry[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const refresh = React.useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const newEntries = await fetchBibEntries()
      globalCache = { entries: newEntries, timestamp: Date.now() }
      setEntries(newEntries)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bib entries')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const getEntries = React.useCallback(async (): Promise<BibEntry[]> => {
    // Check cache first
    if (globalCache && Date.now() - globalCache.timestamp < CACHE_DURATION_MS) {
      return globalCache.entries
    }

    // Otherwise fetch
    try {
      const newEntries = await fetchBibEntries()
      globalCache = { entries: newEntries, timestamp: Date.now() }
      return newEntries
    } catch {
      // Return empty array on error, don't trigger state update
      return []
    }
  }, [])

  // Initial load
  React.useEffect(() => {
    if (globalCache && Date.now() - globalCache.timestamp < CACHE_DURATION_MS) {
      setEntries(globalCache.entries)
    } else {
      void refresh()
    }
  }, [refresh])

  return {
    entries,
    isLoading,
    error,
    refresh,
    getEntries,
  }
}
