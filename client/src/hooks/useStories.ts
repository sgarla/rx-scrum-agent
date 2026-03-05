import { useCallback, useEffect, useState } from 'react'
import { fetchStories } from '../lib/api'
import type { JiraStory, StoryFilters } from '../lib/types'

const ASSIGNEES = ['John D.', 'Sarah M.', 'Priya K.', 'Marcus R.']
const SPRINTS = ['Sprint 12', 'Sprint 11', 'All Sprints']

export function useStories() {
  const [stories, setStories] = useState<JiraStory[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<StoryFilters>({
    status: 'all',
    assignee: null,
    search: '',
    sprint: 'Sprint 12',
  })

  const load = useCallback(async () => {
    try {
      const data = await fetchStories(filters)
      setStories(data)
    } catch (err) {
      console.error('Failed to load stories', err)
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    setLoading(true)
    load()
  }, [load])

  // Poll for status changes
  useEffect(() => {
    const id = setInterval(load, 5000)
    return () => clearInterval(id)
  }, [load])

  const updateFilter = useCallback((update: Partial<StoryFilters>) => {
    setFilters(prev => ({ ...prev, ...update }))
  }, [])

  return { stories, loading, filters, updateFilter, assignees: ASSIGNEES, sprints: SPRINTS, reload: load }
}
