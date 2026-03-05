import { useCallback, useEffect, useState } from 'react'
import { fetchIncidents } from '../lib/api'
import type { IncidentFilters, ServiceNowIncident } from '../lib/types'

interface UseIncidentsReturn {
  incidents: ServiceNowIncident[]
  loading: boolean
  configured: boolean
  error: string | null
  filters: IncidentFilters
  updateFilter: (f: Partial<IncidentFilters>) => void
  reload: () => void
}

const DEFAULT_FILTERS: IncidentFilters = {
  status: 'all',
  search: '',
}

export function useIncidents(): UseIncidentsReturn {
  const [incidents, setIncidents] = useState<ServiceNowIncident[]>([])
  const [loading, setLoading] = useState(false)
  const [configured, setConfigured] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<IncidentFilters>(DEFAULT_FILTERS)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    setLoading(true)
    fetchIncidents({ search: filters.search })
      .then(data => {
        setIncidents(data.incidents)
        setConfigured(data.configured)
        setError(data.error)
      })
      .catch(e => {
        setError(e.message ?? 'Failed to load incidents')
      })
      .finally(() => setLoading(false))
  }, [filters.search, version])

  const updateFilter = useCallback((f: Partial<IncidentFilters>) => {
    setFilters(prev => ({ ...prev, ...f }))
  }, [])

  const reload = useCallback(() => {
    setVersion(v => v + 1)
  }, [])

  return { incidents, loading, configured, error, filters, updateFilter, reload }
}
