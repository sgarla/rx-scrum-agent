import type { RallyStory } from '../../lib/types'

interface Props {
  story: RallyStory
  isActive: boolean
  onClick: () => void
}

export function RallyCard({ story, isActive, onClick }: Props) {
  const state = (story.schedule_state || '').toLowerCase()
  const done = state === 'completed' || state === 'accepted'
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-lg px-3 py-2.5 transition-all"
      style={{
        background: isActive ? 'rgba(245,158,11,0.12)' : 'transparent',
        border: `1px solid ${isActive ? 'rgba(245,158,11,0.45)' : 'var(--color-border)'}`,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-mono font-semibold shrink-0" style={{ color: '#F59E0B' }}>
          {story.formatted_id}
        </span>
        <span
          className="text-[10px] px-1.5 py-0.5 rounded uppercase shrink-0 max-w-[120px] truncate"
          style={{
            background: done ? 'var(--color-bg)' : 'rgba(34,197,94,0.12)',
            color: done ? 'var(--color-text-muted)' : '#22C55E',
          }}
          title={story.schedule_state}
        >
          {story.schedule_state || '—'}
        </span>
      </div>
      <p className="text-sm font-medium leading-snug mt-1 line-clamp-2" style={{ color: 'var(--color-text-primary)' }}>
        {story.name}
      </p>
      <div className="flex items-center justify-between mt-1.5 gap-2">
        {story.iteration_name ? (
          <span className="text-[10px] truncate" style={{ color: 'var(--color-text-muted)' }} title={story.iteration_name}>
            {story.iteration_name}
          </span>
        ) : (
          <span />
        )}
        <span className="text-[10px] px-1.5 py-0.5 rounded shrink-0" style={{ background: 'var(--color-bg)', color: 'var(--color-text-muted)' }}>
          {story.plan_estimate ? `${story.plan_estimate} pts` : '—'}
        </span>
      </div>
    </button>
  )
}
