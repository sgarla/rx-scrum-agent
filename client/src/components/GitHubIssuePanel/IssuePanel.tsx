import { Github, RefreshCw, Search, Settings } from 'lucide-react'
import { useState } from 'react'
import type { GitHubIssue, GitHubIssueFilters } from '../../lib/types'
import { IssueCard } from './IssueCard'

interface Props {
  issues: GitHubIssue[]
  loading: boolean
  configured: boolean
  error: string | null
  filters: GitHubIssueFilters
  onFilterChange: (f: Partial<GitHubIssueFilters>) => void
  activeIssueKey: string | null
  onIssueSelect: (key: string) => void
  onRefresh: () => void
  onOpenSettings: () => void
}

const STATE_TABS: Array<{ key: GitHubIssueFilters['state']; label: string }> = [
  { key: 'open', label: 'Open' },
  { key: 'closed', label: 'Closed' },
  { key: 'all', label: 'All' },
]

export function IssuePanel({
  issues,
  loading,
  configured,
  error,
  filters,
  onFilterChange,
  activeIssueKey,
  onIssueSelect,
  onRefresh,
  onOpenSettings,
}: Props) {
  const [searchFocused, setSearchFocused] = useState(false)
  const openCount = issues.filter(i => i.state === 'open').length

  return (
    <div className="panel" style={{ width: '300px', minWidth: '260px', maxWidth: '320px' }}>
      <div className="panel-header flex-col gap-2 py-3">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <Github size={14} style={{ color: 'var(--color-text-muted)' }} />
            <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>GitHub Issues</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onRefresh}
              className="p-1 rounded transition-all"
              style={{ color: 'var(--color-text-muted)' }}
              title="Refresh"
            >
              <RefreshCw size={13} />
            </button>
            <button
              type="button"
              onClick={onOpenSettings}
              className="p-1 rounded transition-all"
              style={{ color: 'var(--color-text-muted)' }}
              title="GitHub settings"
            >
              <Settings size={13} />
            </button>
          </div>
        </div>

        <div className="relative w-full">
          <Search
            size={13}
            className="absolute left-2.5 top-1/2 -translate-y-1/2"
            style={{ color: searchFocused ? 'var(--color-accent)' : 'var(--color-text-muted)' }}
          />
          <input
            type="text"
            placeholder="Search issues..."
            value={filters.search}
            onChange={e => onFilterChange({ search: e.target.value })}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            className="input text-sm w-full pl-8"
          />
        </div>

        <div className="flex gap-1 w-full">
          {STATE_TABS.map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => onFilterChange({ state: tab.key })}
              className="flex-1 text-[11px] font-medium py-1.5 px-2 rounded-md transition-all"
              style={
                filters.state === tab.key
                  ? { background: 'var(--color-accent)', color: 'white' }
                  : { color: 'var(--color-text-muted)', background: 'var(--color-bg)' }
              }
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2 panel-body">
        {!configured && (
          <div className="flex flex-col items-center justify-center py-10 px-3 text-center">
            <Github size={36} style={{ color: 'var(--color-text-muted)', opacity: 0.5 }} />
            <p className="mt-3 text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              GitHub not configured
            </p>
            <p className="mt-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Add a personal access token and repository in Settings
            </p>
            <button
              type="button"
              onClick={onOpenSettings}
              className="mt-4 px-4 py-2 rounded-lg text-xs font-semibold"
              style={{ background: '#6366F1', color: 'white' }}
            >
              Open Settings
            </button>
          </div>
        )}

        {configured && error && (
          <div className="text-xs px-2 py-2 rounded-lg mb-2" style={{ background: 'rgba(239,68,68,0.1)', color: '#FCA5A5' }}>
            {error}
          </div>
        )}

        {configured && loading && (
          <div className="flex justify-center py-8">
            <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading issues...</div>
          </div>
        )}

        {configured && !loading && !error && issues.length === 0 && (
          <p className="text-sm text-center py-8" style={{ color: 'var(--color-text-muted)' }}>No issues found</p>
        )}

        {configured && !loading && issues.length > 0 && (
          <div className="space-y-2">
            {issues.map(issue => (
              <IssueCard
                key={issue.key}
                issue={issue}
                isActive={issue.key === activeIssueKey}
                onClick={() => onIssueSelect(issue.key)}
              />
            ))}
          </div>
        )}
      </div>

      {configured && !loading && issues.length > 0 && (
        <div
          className="shrink-0 px-3 py-2 text-[11px]"
          style={{ borderTop: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}
        >
          {issues.length} issue{issues.length === 1 ? '' : 's'}
          {filters.state === 'open' ? ` · ${openCount} open in view` : null}
        </div>
      )}
    </div>
  )
}
