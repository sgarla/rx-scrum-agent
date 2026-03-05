import { Search, SlidersHorizontal } from 'lucide-react'
import { useState } from 'react'
import type { JiraStory, StoryFilters } from '../../lib/types'
import { StoryCard } from './StoryCard'

interface Props {
  stories: JiraStory[]
  loading: boolean
  filters: StoryFilters
  onFilterChange: (f: Partial<StoryFilters>) => void
  activeStoryKey: string | null
  onStorySelect: (key: string) => void
}

const STATUS_TABS: Array<{ key: StoryFilters['status']; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'todo', label: 'Todo' },
  { key: 'building', label: 'Building' },
  { key: 'done', label: 'Done' },
]

export function StoryPanel({ stories, loading, filters, onFilterChange, activeStoryKey, onStorySelect }: Props) {
  const [searchFocused, setSearchFocused] = useState(false)

  const buildingCount = stories.filter(s => s.status === 'building').length
  const doneCount = stories.filter(s => s.status === 'done').length

  return (
    <div className="panel" style={{ width: '300px', minWidth: '260px', maxWidth: '320px' }}>
      {/* Header */}
      <div className="panel-header flex-col gap-2 py-3">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={14} style={{ color: 'var(--color-text-muted)' }} />
            <span className="text-sm font-semibold text-white">Sprint Board</span>
          </div>
          <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {buildingCount > 0 && (
              <span className="flex items-center gap-1">
                <span className="building-dot" />
                {buildingCount} building
              </span>
            )}
            {doneCount > 0 && (
              <span style={{ color: 'var(--color-done)' }}>✓ {doneCount} done</span>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="relative w-full">
          <Search
            size={13}
            className="absolute left-2.5 top-1/2 -translate-y-1/2"
            style={{ color: searchFocused ? 'var(--color-accent)' : 'var(--color-text-muted)' }}
          />
          <input
            type="text"
            placeholder="Search stories..."
            value={filters.search}
            onChange={e => onFilterChange({ search: e.target.value })}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            className="input pl-7 text-xs py-1.5"
          />
        </div>

        {/* Status tabs */}
        <div
          className="flex w-full rounded-md overflow-hidden"
          style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
        >
          {STATUS_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => onFilterChange({ status: tab.key })}
              className="flex-1 text-xs py-1.5 transition-all font-medium"
              style={{
                background: filters.status === tab.key ? 'var(--color-accent)' : 'transparent',
                color: filters.status === tab.key ? 'white' : 'var(--color-text-muted)',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Story list */}
      <div className="panel-body p-3">
        {loading ? (
          <div className="flex items-center justify-center py-12" style={{ color: 'var(--color-text-muted)' }}>
            <div className="text-sm">Loading stories...</div>
          </div>
        ) : stories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <Search size={24} style={{ color: 'var(--color-text-muted)' }} />
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No stories found</p>
          </div>
        ) : (
          <div>
            {stories.map(story => (
              <StoryCard
                key={story.key}
                story={story}
                isActive={story.key === activeStoryKey}
                onClick={() => onStorySelect(story.key)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer: counts */}
      <div
        className="shrink-0 px-3 py-2 text-xs"
        style={{
          borderTop: '1px solid var(--color-border)',
          color: 'var(--color-text-muted)',
        }}
      >
        {stories.length} {stories.length === 1 ? 'story' : 'stories'}
        {filters.assignee && ` · ${filters.assignee}`}
      </div>
    </div>
  )
}
