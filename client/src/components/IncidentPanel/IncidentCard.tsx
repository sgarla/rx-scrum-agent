import { AlertCircle, ArrowUp, Minus } from 'lucide-react'
import type { ServiceNowIncident } from '../../lib/types'

interface Props {
  incident: ServiceNowIncident
  isActive: boolean
  onClick: () => void
}

const PRIORITY_CONFIG: Record<string, { icon: React.ElementType; color: string }> = {
  Critical: { icon: AlertCircle, color: '#EF4444' },
  High: { icon: ArrowUp, color: '#F97316' },
  Moderate: { icon: Minus, color: '#F59E0B' },
  Low: { icon: Minus, color: '#6B7280' },
  Planning: { icon: Minus, color: '#6B7280' },
}

const STATE_COLORS: Record<string, string> = {
  New: '#6366F1',
  'In Progress': '#F59E0B',
  'On Hold': '#6B7280',
  Resolved: '#22C55E',
  Closed: '#6B7280',
  Cancelled: '#6B7280',
}

function formatDate(iso: string): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } catch {
    return ''
  }
}

export function IncidentCard({ incident, isActive, onClick }: Props) {
  const priCfg = PRIORITY_CONFIG[incident.priority] ?? PRIORITY_CONFIG.Moderate
  const PriorityIcon = priCfg.icon
  const stateColor = STATE_COLORS[incident.state] ?? '#6B7280'
  const isOpen = !['Resolved', 'Closed', 'Cancelled'].includes(incident.state)

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-lg transition-all duration-150 ${isActive ? 'card-active' : 'card-hover'}`}
      style={{
        background: isActive ? 'rgba(99,102,241,0.1)' : 'var(--color-surface-2)',
        border: `1px solid ${isActive ? '#6366F1' : 'var(--color-border)'}`,
        marginBottom: '6px',
      }}
    >
      {/* Top row: number + state */}
      <div className="flex items-center justify-between mb-1.5">
        <span
          className="text-xs font-mono font-semibold px-1.5 py-0.5 rounded"
          style={{ background: 'var(--color-bg)', color: 'var(--color-text-secondary)', letterSpacing: '0.02em' }}
        >
          {incident.number}
        </span>

        <span
          className="text-xs px-1.5 py-0.5 rounded font-medium"
          style={{ background: `${stateColor}18`, color: stateColor }}
        >
          {incident.state}
        </span>
      </div>

      {/* Short description */}
      <p
        className="text-sm font-medium mb-1.5 line-clamp-2 leading-snug"
        style={{ color: 'var(--color-text-primary)' }}
      >
        {incident.short_description}
      </p>

      {/* Bottom: priority + category + date */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-xs" style={{ color: priCfg.color }}>
            <PriorityIcon size={10} />
            <span style={{ color: 'var(--color-text-muted)' }}>{incident.priority}</span>
          </span>
          {incident.category && (
            <span
              className="text-xs px-1.5 py-0.5 rounded"
              style={{ background: 'rgba(99,102,241,0.12)', color: '#818CF8' }}
            >
              {incident.category}
            </span>
          )}
        </div>
        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {formatDate(incident.sys_updated_on || incident.opened_at)}
        </span>
      </div>

      {/* Pulsing bar for in-progress */}
      {incident.state === 'In Progress' && (
        <div className="mt-2 h-0.5 rounded-full overflow-hidden" style={{ background: 'var(--color-border)' }}>
          <div
            className="h-full rounded-full"
            style={{
              background: 'linear-gradient(90deg, transparent, #F59E0B, transparent)',
              animation: 'shimmer 1.5s ease-in-out infinite',
              width: '60%',
            }}
          />
        </div>
      )}
    </button>
  )
}
