import { useCallback, useEffect, useState } from 'react'
import { fetchRallyStories } from '../lib/api'
import type { RallyStory, RallyStoryFilters } from '../lib/types'

interface UseRallyStoriesReturn {
  stories: RallyStory[]
  loading: boolean
  configured: boolean
  error: string | null
  filters: RallyStoryFilters
  updateFilter: (f: Partial<RallyStoryFilters>) => void
  reload: () => void
}

const DEFAULT_FILTERS: RallyStoryFilters = {
  state: 'active',
  search: '',
}

export function useRallyStories(): UseRallyStoriesReturn {
  const [stories, setStories] = useState<RallyStory[]>([])
  const [loading, setLoading] = useState(true)
  const [configured, setConfigured] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<RallyStoryFilters>(DEFAULT_FILTERS)

  const load = useCallback(async () => {
    try {
      const data = await fetchRallyStories({
        state: filters.state === 'all' ? 'all' : filters.state,
        search: filters.search,
      })
      setStories(data.stories)
      setConfigured(data.configured)
      setError(data.error)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load Rally stories')
    } finally {
      setLoading(false)
    }
  }, [filters.state, filters.search])

  useEffect(() => {
    setLoading(true)
    load()
  }, [load])

  const updateFilter = useCallback((f: Partial<RallyStoryFilters>) => {
    setFilters(prev => ({ ...prev, ...f }))
  }, [])

  return { stories, loading, configured, error, filters, updateFilter, reload: load }
}
