import type { GitHubIssue } from '../../lib/types'

interface Props {
  issue: GitHubIssue
  isActive: boolean
  onClick: () => void
}

export function IssueCard({ issue, isActive, onClick }: Props) {
  const stateOpen = issue.state === 'open'
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-lg px-3 py-2.5 transition-all"
      style={{
        background: isActive ? 'rgba(99,102,241,0.12)' : 'transparent',
        border: `1px solid ${isActive ? 'rgba(99,102,241,0.35)' : 'var(--color-border)'}`,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-mono font-semibold shrink-0" style={{ color: '#818CF8' }}>
          #{issue.number}
        </span>
        <span
          className="text-[10px] px-1.5 py-0.5 rounded uppercase shrink-0"
          style={{
            background: stateOpen ? 'rgba(34,197,94,0.12)' : 'var(--color-bg)',
            color: stateOpen ? '#22C55E' : 'var(--color-text-muted)',
          }}
        >
          {issue.state}
        </span>
      </div>
      <p className="text-sm font-medium leading-snug mt-1 line-clamp-2" style={{ color: 'var(--color-text-primary)' }}>
        {issue.title}
      </p>
      {issue.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {issue.labels.slice(0, 3).map(lb => (
            <span
              key={lb}
              className="text-[10px] px-1.5 py-0.5 rounded"
              style={{ background: 'var(--color-bg)', color: 'var(--color-text-muted)' }}
            >
              {lb}
            </span>
          ))}
        </div>
      )}
    </button>
  )
}
