import { AlertCircle, ArrowUp, BarChart2, Bot, BrainCircuit, Database, GitBranch, Minus, Timer } from 'lucide-react'
import type { JiraStory } from '../../lib/types'
import { StatusBadge } from './StatusBadge'

interface Props {
  story: JiraStory
  isActive: boolean
  onClick: () => void
}

const TYPE_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  data_pipeline: { icon: Database, color: '#3B82F6', label: 'Pipeline' },
  dashboard: { icon: BarChart2, color: '#8B5CF6', label: 'Dashboard' },
  ml_model: { icon: BrainCircuit, color: '#EC4899', label: 'ML Model' },
  synthetic_data: { icon: GitBranch, color: '#14B8A6', label: 'Synthetic Data' },
  ai_agent: { icon: Bot, color: '#F97316', label: 'AI Agent' },
  job: { icon: Timer, color: '#6366F1', label: 'Job' },
  generic: { icon: Database, color: '#6B7280', label: 'Generic' },
}

const PRIORITY_CONFIG: Record<string, { icon: React.ElementType; color: string }> = {
  Critical: { icon: AlertCircle, color: '#EF4444' },
  High: { icon: ArrowUp, color: '#F97316' },
  Medium: { icon: Minus, color: '#F59E0B' },
  Low: { icon: Minus, color: '#6B7280' },
}

const AVATAR_COLORS: Record<string, string> = {
  'John D.': '#3B82F6',
  'Sarah M.': '#EC4899',
  'Priya K.': '#8B5CF6',
  'Marcus R.': '#14B8A6',
}

export function StoryCard({ story, isActive, onClick }: Props) {
  const typeCfg = TYPE_CONFIG[story.type] ?? TYPE_CONFIG.generic
  const priCfg = PRIORITY_CONFIG[story.priority] ?? PRIORITY_CONFIG.Medium
  const PriorityIcon = priCfg.icon
  const TypeIcon = typeCfg.icon
  const initials = story.assignee.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-lg transition-all duration-150 ${isActive ? 'card-active' : 'card-hover'}`}
      style={{
        background: isActive ? 'rgba(255,54,33,0.08)' : 'var(--color-surface-2)',
        border: `1px solid ${isActive ? 'var(--color-accent)' : 'var(--color-border)'}`,
        marginBottom: '6px',
      }}
    >
      {/* Top row: key + status */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          {/* Story key badge */}
          <span
            className="text-xs font-mono font-semibold px-1.5 py-0.5 rounded"
            style={{ background: 'var(--color-bg)', color: 'var(--color-text-secondary)', letterSpacing: '0.02em' }}
          >
            {story.key}
          </span>

          {/* Type chip */}
          <span
            className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded"
            style={{ background: `${typeCfg.color}18`, color: typeCfg.color }}
          >
            <TypeIcon size={9} />
            {typeCfg.label}
          </span>
        </div>

        <StatusBadge status={story.status} />
      </div>

      {/* Title */}
      <p
        className="text-sm font-medium mb-1.5 line-clamp-2 leading-snug"
        style={{ color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-primary)' }}
      >
        {story.summary}
      </p>

      {/* Bottom: priority + points + assignee */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Priority */}
          <span
            className="inline-flex items-center gap-1 text-xs"
            style={{ color: priCfg.color }}
          >
            <PriorityIcon size={10} />
            <span style={{ color: 'var(--color-text-muted)' }}>{story.priority}</span>
          </span>

          {/* Points */}
          <span
            className="text-xs px-1.5 py-0.5 rounded font-medium"
            style={{ background: 'var(--color-bg)', color: 'var(--color-text-muted)' }}
          >
            {story.story_points} pts
          </span>
        </div>

        {/* Assignee avatar */}
        <div
          className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white"
          title={story.assignee}
          style={{ background: AVATAR_COLORS[story.assignee] ?? '#6B7280', fontSize: '9px' }}
        >
          {initials}
        </div>
      </div>

      {/* Building pulse */}
      {story.status === 'building' && (
        <div
          className="mt-2 h-0.5 rounded-full overflow-hidden"
          style={{ background: 'var(--color-border)' }}
        >
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
