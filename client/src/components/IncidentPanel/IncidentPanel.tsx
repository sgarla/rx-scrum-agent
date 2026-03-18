import { AlertTriangle, RefreshCw, Search, Settings } from 'lucide-react'
import type { IncidentFilters, ServiceNowIncident } from '../../lib/types'
import { IncidentCard } from './IncidentCard'

interface Props {
  incidents: ServiceNowIncident[]
  loading: boolean
  configured: boolean
  error: string | null
  filters: IncidentFilters
  onFilterChange: (f: Partial<IncidentFilters>) => void
  activeIncidentNumber: string | null
  onIncidentSelect: (number: string) => void
  onRefresh: () => void
  onOpenSettings: () => void
}

const STATE_TABS: Array<{ key: IncidentFilters['status']; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'resolved', label: 'Resolved' },
]

export function IncidentPanel({
  incidents,
  loading,
  configured,
  error,
  filters,
  onFilterChange,
  activeIncidentNumber,
  onIncidentSelect,
  onRefresh,
  onOpenSettings,
}: Props) {
  const openCount = incidents.filter(i => !['Resolved', 'Closed', 'Cancelled'].includes(i.state)).length
  const criticalCount = incidents.filter(i => i.priority === 'Critical').length

  const filtered = incidents.filter(inc => {
    if (filters.status === 'open') return !['Resolved', 'Closed', 'Cancelled'].includes(inc.state)
    if (filters.status === 'resolved') return ['Resolved', 'Closed'].includes(inc.state)
    return true
  })

  return (
    <div className="panel" style={{ width: '300px', minWidth: '260px', maxWidth: '320px' }}>
      {/* Header */}
      <div className="panel-header flex-col gap-2 py-3">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} style={{ color: 'var(--color-text-muted)' }} />
            <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Incidents</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            {criticalCount > 0 && (
              <span style={{ color: '#EF4444', fontWeight: 600 }}>⚠ {criticalCount} critical</span>
            )}
            {openCount > 0 && !criticalCount && (
              <span style={{ color: 'var(--color-text-muted)' }}>{openCount} open</span>
            )}
            <button
              onClick={onRefresh}
              className="p-1 rounded transition-all"
              style={{ color: 'var(--color-text-muted)' }}
              title="Refresh incidents"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={onOpenSettings}
              className="p-1 rounded transition-all"
              style={{ color: 'var(--color-text-muted)' }}
              title="ServiceNow settings"
            >
              <Settings size={13} />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative w-full">
          <Search
            size={13}
            className="absolute left-2.5 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--color-text-muted)' }}
          />
          <input
            type="text"
            placeholder="Search incidents..."
            value={filters.search}
            onChange={e => onFilterChange({ search: e.target.value })}
            className="input pl-7 text-xs py-1.5"
          />
        </div>

        {/* Status tabs */}
        <div
          className="flex w-full rounded-md overflow-hidden"
          style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
        >
          {STATE_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => onFilterChange({ status: tab.key })}
              className="flex-1 text-xs py-1.5 transition-all font-medium"
              style={{
                background: filters.status === tab.key ? '#6366F1' : 'transparent',
                color: filters.status === tab.key ? 'white' : 'var(--color-text-muted)',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Incident list */}
      <div className="panel-body p-3">
        {!configured ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <AlertTriangle size={32} style={{ color: 'var(--color-text-muted)', opacity: 0.3 }} />
            <div className="text-center">
              <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                ServiceNow not configured
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                Click the settings icon to connect
              </p>
            </div>
            <button
              onClick={onOpenSettings}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{ background: '#6366F1', color: 'white' }}
            >
              <Settings size={12} />
              Configure ServiceNow
            </button>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
            <p className="text-xs" style={{ color: '#FCA5A5' }}>{error}</p>
            <button onClick={onRefresh} className="text-xs" style={{ color: 'var(--color-accent)' }}>
              Retry
            </button>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-12" style={{ color: 'var(--color-text-muted)' }}>
            <div className="text-sm">Loading incidents...</div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <Search size={24} style={{ color: 'var(--color-text-muted)' }} />
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No incidents found</p>
          </div>
        ) : (
          <div>
            {filtered.map(inc => (
              <IncidentCard
                key={inc.sys_id}
                incident={inc}
                isActive={inc.number === activeIncidentNumber}
                onClick={() => onIncidentSelect(inc.number)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {configured && !error && (
        <div
          className="shrink-0 px-3 py-2 text-xs"
          style={{ borderTop: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}
        >
          {filtered.length} {filtered.length === 1 ? 'incident' : 'incidents'}
          {filters.status !== 'all' && ` · ${filters.status}`}
        </div>
      )}
    </div>
  )
}
