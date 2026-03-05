import { CheckCircle, Circle, Loader2 } from 'lucide-react'

interface Props {
  status: 'todo' | 'building' | 'done'
  size?: 'sm' | 'md'
}

export function StatusBadge({ status, size = 'sm' }: Props) {
  const configs = {
    todo: {
      label: 'Todo',
      icon: Circle,
      color: '#6B7280',
      bg: 'rgba(107,114,128,0.12)',
    },
    building: {
      label: 'Building',
      icon: Loader2,
      color: '#F59E0B',
      bg: 'rgba(245,158,11,0.12)',
      spin: true,
    },
    done: {
      label: 'Done',
      icon: CheckCircle,
      color: '#10B981',
      bg: 'rgba(16,185,129,0.12)',
    },
  }

  const cfg = configs[status]
  const Icon = cfg.icon
  const iconSize = size === 'sm' ? 11 : 13

  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      <Icon
        size={iconSize}
        className={(cfg as { spin?: boolean }).spin ? 'animate-spin' : ''}
      />
      {size === 'md' && <span>{cfg.label}</span>}
    </span>
  )
}
