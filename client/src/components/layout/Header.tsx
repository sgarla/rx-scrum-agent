import { Activity, ChevronDown, Settings, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { fetchHealth } from '../../lib/api'

interface HeaderProps {
  activeSprint: string
  onSprintChange: (s: string) => void
  activeAssignee: string | null
  onAssigneeChange: (a: string | null) => void
  sprints: string[]
  assignees: string[]
  onOpenSettings?: () => void
}

const AVATARS: Record<string, string> = {
  'John D.': 'JD',
  'Sarah M.': 'SM',
  'Priya K.': 'PK',
  'Marcus R.': 'MR',
}

const AVATAR_COLORS: Record<string, string> = {
  'John D.': '#3B82F6',
  'Sarah M.': '#EC4899',
  'Priya K.': '#8B5CF6',
  'Marcus R.': '#14B8A6',
}

export function Header({
  activeSprint,
  onSprintChange,
  activeAssignee,
  onAssigneeChange,
  sprints,
  assignees,
  onOpenSettings,
}: HeaderProps) {
  const [wsUrl, setWsUrl] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    fetchHealth()
      .then(h => {
        setConnected(h.databricks_configured)
        setWsUrl(h.workspace_url || null)
      })
      .catch(() => {})
  }, [])

  return (
    <header
      className="shrink-0 flex items-center justify-between px-5 py-0"
      style={{
        background: '#0D1321',
        borderBottom: '1px solid var(--color-border)',
        height: '56px',
      }}
    >
      {/* Left: Logo + Title */}
      <div className="flex items-center gap-3">
        <DatabricksLogo />
        <div className="flex flex-col leading-none">
          <span className="text-sm font-semibold text-white tracking-tight">RxCorp Bricks Agent</span>
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Powered by Databricks
          </span>
        </div>
      </div>

      {/* Center: Sprint Selector */}
      <div className="flex items-center gap-2">
        <SprintDropdown value={activeSprint} options={sprints} onChange={onSprintChange} />
      </div>

      {/* Right: Assignee Filters + Connection */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <Users size={13} style={{ color: 'var(--color-text-muted)' }} />
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Filter:</span>
          <button
            onClick={() => onAssigneeChange(null)}
            className="text-xs px-2 py-1 rounded transition-all"
            style={{
              background: activeAssignee === null ? 'var(--color-accent)' : 'transparent',
              color: activeAssignee === null ? 'white' : 'var(--color-text-secondary)',
            }}
          >
            All
          </button>
          {assignees.map(a => (
            <button
              key={a}
              onClick={() => onAssigneeChange(activeAssignee === a ? null : a)}
              title={a}
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all"
              style={{
                background: activeAssignee === a ? AVATAR_COLORS[a] : 'var(--color-surface-2)',
                border: `2px solid ${activeAssignee === a ? AVATAR_COLORS[a] : 'var(--color-border)'}`,
                color: activeAssignee === a ? 'white' : 'var(--color-text-secondary)',
              }}
            >
              {AVATARS[a] ?? a.slice(0, 2)}
            </button>
          ))}
        </div>

        {/* Connection Status */}
        <div
          className="flex items-center gap-1.5 px-2 py-1 rounded"
          style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}
        >
          <Activity size={11} style={{ color: connected ? 'var(--color-done)' : 'var(--color-todo)' }} />
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {connected
              ? wsUrl
                ? new URL(wsUrl.startsWith('http') ? wsUrl : `https://${wsUrl}`).hostname.split('.')[0]
                : 'Connected'
              : 'Not connected'}
          </span>
        </div>

        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="p-1.5 rounded-md transition-all"
            style={{ color: 'var(--color-text-muted)', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}
            title="Settings"
          >
            <Settings size={14} />
          </button>
        )}
      </div>
    </header>
  )
}

function SprintDropdown({
  value,
  options,
  onChange,
}: {
  value: string
  options: string[]
  onChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-all"
        style={{
          background: 'var(--color-surface-2)',
          border: '1px solid var(--color-border)',
          color: 'var(--color-text-primary)',
        }}
      >
        <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Sprint:</span>
        <span className="font-medium">{value}</span>
        <ChevronDown size={13} style={{ color: 'var(--color-text-muted)' }} />
      </button>
      {open && (
        <div
          className="absolute top-full mt-1 left-0 z-50 rounded-md overflow-hidden shadow-xl"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            minWidth: '160px',
          }}
        >
          {options.map(o => (
            <button
              key={o}
              onClick={() => { onChange(o); setOpen(false) }}
              className="w-full text-left px-3 py-2 text-sm transition-all"
              style={{
                color: o === value ? 'var(--color-accent)' : 'var(--color-text-primary)',
                background: o === value ? 'rgba(255,54,33,0.08)' : 'transparent',
              }}
              onMouseEnter={e => { if (o !== value) (e.target as HTMLElement).style.background = 'var(--color-surface-2)' }}
              onMouseLeave={e => { if (o !== value) (e.target as HTMLElement).style.background = 'transparent' }}
            >
              {o}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function DatabricksLogo() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
      <path d="M12 2L2 7.5V16.5L12 22L22 16.5V7.5L12 2Z" fill="#FF3621" />
      <path d="M12 2L2 7.5L12 13L22 7.5L12 2Z" fill="#FF6B5A" opacity="0.6" />
      <path d="M2 7.5V16.5L12 22V13L2 7.5Z" fill="#CC2B1A" opacity="0.8" />
      <path d="M12 13V22L22 16.5V7.5L12 13Z" fill="#FF3621" opacity="0.9" />
    </svg>
  )
}
