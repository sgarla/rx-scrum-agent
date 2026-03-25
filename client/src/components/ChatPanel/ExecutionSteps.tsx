import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Loader2, MinusCircle, StopCircle, XCircle } from 'lucide-react'
import { useState } from 'react'
import type { ExecutionStep, StepStatus } from '../../lib/types'

interface Props {
  steps: ExecutionStep[]
  isBuilding: boolean
}

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  StepStatus,
  { icon: React.ElementType; iconColor: string; textStyle: React.CSSProperties; spin?: boolean }
> = {
  pending: {
    icon: () => (
      <span
        style={{
          display: 'inline-block',
          width: 14,
          height: 14,
          borderRadius: '50%',
          border: '1.5px solid var(--color-border)',
          flexShrink: 0,
        }}
      />
    ),
    iconColor: 'var(--color-text-muted)',
    textStyle: { color: 'var(--color-text-muted)', opacity: 0.6 },
  },
  running: {
    icon: Loader2,
    iconColor: 'var(--color-accent)',
    textStyle: { color: 'var(--color-text-primary)', fontWeight: 500 },
    spin: true,
  },
  done: {
    icon: CheckCircle2,
    iconColor: 'var(--color-done)',
    textStyle: { color: 'var(--color-text-muted)', textDecoration: 'line-through' },
  },
  error: {
    icon: XCircle,
    iconColor: '#EF4444',
    textStyle: { color: '#FCA5A5' },
  },
  stopped: {
    icon: StopCircle,
    iconColor: '#6B7280',
    textStyle: { color: 'var(--color-text-muted)' },
  },
  cancelled: {
    icon: MinusCircle,
    iconColor: '#374151',
    textStyle: { color: 'var(--color-text-muted)', opacity: 0.4, textDecoration: 'line-through' },
  },
}

// ── Summary helpers ───────────────────────────────────────────────────────────

function summaryText(steps: ExecutionStep[], isBuilding: boolean): string {
  const total = steps.length
  const done = steps.filter(s => s.status === 'done').length
  const hasError = steps.some(s => s.status === 'error')
  const hasStopped = steps.some(s => s.status === 'stopped')

  if (!isBuilding) {
    if (hasError) return `Failed — ${done} of ${total} steps completed`
    if (hasStopped) return `Interrupted — ${done} of ${total} steps completed`
    return `Completed — ${total} step${total !== 1 ? 's' : ''}`
  }

  const running = steps.find(s => s.status === 'running')
  if (running) return `${running.label}… (${done}/${total})`
  return `Preparing… (${done}/${total})`
}

function accentColor(steps: ExecutionStep[], isBuilding: boolean): string {
  if (!isBuilding) {
    if (steps.some(s => s.status === 'error')) return '#EF4444'
    if (steps.some(s => s.status === 'stopped')) return '#6B7280'
    return 'var(--color-done)'
  }
  return 'var(--color-accent)'
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ExecutionSteps({ steps, isBuilding }: Props) {
  const [open, setOpen] = useState(true)

  if (steps.length === 0) return null

  const color = accentColor(steps, isBuilding)
  const summary = summaryText(steps, isBuilding)

  return (
    <div
      className="mb-4 rounded-xl overflow-hidden animate-fade-in"
      style={{ border: '1px solid var(--color-border)', background: 'var(--color-bg)' }}
    >
      {/* Header row */}
      <button
        className="w-full flex items-center gap-2 px-3 py-2 text-left"
        style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
        onClick={() => setOpen(o => !o)}
      >
        {/* AI avatar */}
        <div
          className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
          style={{ background: color, color: 'white', fontSize: '9px' }}
        >
          AI
        </div>

        {/* Summary text */}
        <span className="flex-1 text-xs font-medium truncate" style={{ color: 'var(--color-text-secondary)' }}>
          {summary}
        </span>

        {/* Thinking dots when building and waiting for first tool */}
        {isBuilding && steps.every(s => s.status === 'pending') && (
          <span className="flex gap-1 items-center mr-1">
            <span className="thinking-dot" style={{ animationDelay: '0ms' }} />
            <span className="thinking-dot" style={{ animationDelay: '150ms' }} />
            <span className="thinking-dot" style={{ animationDelay: '300ms' }} />
          </span>
        )}

        {/* Chevron */}
        {open
          ? <ChevronDown size={13} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
          : <ChevronRight size={13} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
        }
      </button>

      {/* Step list */}
      {open && (
        <div
          className="px-3 pb-3 flex flex-col gap-1"
          style={{ borderTop: '1px solid var(--color-border)' }}
        >
          {steps.map((step) => (
            <StepRow key={step.id} step={step} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Single step row ───────────────────────────────────────────────────────────

function StepRow({ step }: { step: ExecutionStep }) {
  const cfg = STATUS_CONFIG[step.status]
  const Icon = cfg.icon

  return (
    <div
      className="flex flex-col gap-0.5 pt-2"
      style={
        step.status === 'running'
          ? {
              borderLeft: '2px solid var(--color-accent)',
              paddingLeft: 8,
              marginLeft: -10,
            }
          : { paddingLeft: 0 }
      }
    >
      <div className="flex items-center gap-2">
        <Icon
          size={14}
          className={cfg.spin ? 'animate-spin' : undefined}
          style={{ color: cfg.iconColor, flexShrink: 0 }}
        />
        <span className="text-xs leading-snug" style={cfg.textStyle}>
          {step.label}
        </span>
      </div>

      {/* Detail line */}
      {step.detail && (
        <span
          className="text-xs pl-5"
          style={{ color: 'var(--color-text-muted)', opacity: 0.7 }}
        >
          {step.detail}
        </span>
      )}

      {/* Slow warning */}
      {step.slowWarning && step.status === 'running' && (
        <div className="flex items-center gap-1 pl-5">
          <AlertTriangle size={11} style={{ color: '#F59E0B', flexShrink: 0 }} />
          <span className="text-xs" style={{ color: '#FCD34D' }}>
            Taking longer than expected
            {step.slowSeconds ? ` · ${step.slowSeconds}s` : '…'}
            {' — expand tool cards above for details'}
          </span>
        </div>
      )}
    </div>
  )
}
