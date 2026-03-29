import { useCallback, useEffect, useState } from 'react'
import { fetchGitHubIssues } from '../lib/api'
import type { GitHubIssue, GitHubIssueFilters } from '../lib/types'

interface UseGitHubIssuesReturn {
  issues: GitHubIssue[]
  loading: boolean
  configured: boolean
  error: string | null
  filters: GitHubIssueFilters
  updateFilter: (f: Partial<GitHubIssueFilters>) => void
  reload: () => void
}

const DEFAULT_FILTERS: GitHubIssueFilters = {
  state: 'open',
  search: '',
}

export function useGitHubIssues(): UseGitHubIssuesReturn {
  const [issues, setIssues] = useState<GitHubIssue[]>([])
  const [loading, setLoading] = useState(true)
  const [configured, setConfigured] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<GitHubIssueFilters>(DEFAULT_FILTERS)

  const load = useCallback(async () => {
    try {
      const data = await fetchGitHubIssues({
        state: filters.state === 'all' ? 'all' : filters.state,
        search: filters.search,
      })
      setIssues(data.issues)
      setConfigured(data.configured)
      setError(data.error)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load issues')
    } finally {
      setLoading(false)
    }
  }, [filters.state, filters.search])

  useEffect(() => {
    setLoading(true)
    load()
  }, [load])

  const updateFilter = useCallback((f: Partial<GitHubIssueFilters>) => {
    setFilters(prev => ({ ...prev, ...f }))
  }, [])

  return { issues, loading, configured, error, filters, updateFilter, reload: load }
}
