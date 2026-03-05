import {
  AlertCircle,
  BarChart2,
  Bot,
  BrainCircuit,
  Database,
  ExternalLink,
  GitBranch,
  Loader2,
  PlayCircle,
  Sparkles,
  Timer,
} from 'lucide-react'
import { useEffect, useRef } from 'react'
import type { ChatMessage, JiraStory } from '../../lib/types'
import { AgentMessage } from './AgentMessage'
import { ChatInput } from './ChatInput'

interface Props {
  story: JiraStory | null
  messages: ChatMessage[]
  isBuilding: boolean
  conversationLoading?: boolean
  error: string | null
  onStartBuild: () => void
  onSendMessage: (text: string) => void
  onStop: () => void
}

function formatDateSeparator(date: Date): string {
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  data_pipeline: Database,
  dashboard: BarChart2,
  ml_model: BrainCircuit,
  synthetic_data: GitBranch,
  ai_agent: Bot,
  job: Timer,
}

const PRIORITY_COLORS: Record<string, string> = {
  Critical: '#EF4444',
  High: '#F97316',
  Medium: '#F59E0B',
  Low: '#6B7280',
}

export function ChatPanel({ story, messages, isBuilding, conversationLoading, error, onStartBuild, onSendMessage, onStop }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const TypeIcon = story ? (TYPE_ICONS[story.type] ?? Database) : null

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (!story) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center" style={{ background: 'var(--color-surface)' }}>
        <Sparkles size={40} style={{ color: 'var(--color-text-muted)', opacity: 0.4 }} />
        <p className="mt-4 text-base font-medium" style={{ color: 'var(--color-text-secondary)' }}>
          Select a story to get started
        </p>
        <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Pick a JIRA story from the sprint board to build it with AI
        </p>
      </div>
    )
  }

  const hasMessages = messages.length > 0

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ background: 'var(--color-surface)', minWidth: 0 }}>
      {/* Story header */}
      <div
        className="shrink-0 px-4 py-3"
        style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)' }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span
                className="text-xs font-mono font-bold px-2 py-0.5 rounded"
                style={{ background: 'var(--color-bg)', color: 'var(--color-accent)' }}
              >
                {story.key}
              </span>
              <span
                className="text-xs px-1.5 py-0.5 rounded"
                style={{ background: `${PRIORITY_COLORS[story.priority]}18`, color: PRIORITY_COLORS[story.priority] }}
              >
                {story.priority}
              </span>
              <span
                className="text-xs px-1.5 py-0.5 rounded"
                style={{ background: 'var(--color-bg)', color: 'var(--color-text-muted)' }}
              >
                {story.story_points} pts
              </span>
              {story.labels.slice(0, 2).map(l => (
                <span
                  key={l}
                  className="text-xs px-1.5 py-0.5 rounded"
                  style={{ background: 'rgba(99,102,241,0.15)', color: '#818CF8' }}
                >
                  {l}
                </span>
              ))}
            </div>
            <h2 className="text-sm font-semibold leading-snug" style={{ color: 'var(--color-text-primary)' }}>
              {story.summary}
            </h2>
            {/* Assignee + status + sprint */}
            <div className="flex items-center gap-2 mt-1.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center font-bold shrink-0"
                style={{ background: 'var(--color-accent)', color: 'white', fontSize: '9px' }}
              >
                {story.assignee.split(' ').map((n: string) => n[0]).join('')}
              </span>
              <span>{story.assignee}</span>
              <span>·</span>
              <span
                className="capitalize"
                style={{
                  color: story.status === 'done'
                    ? 'var(--color-done)'
                    : story.status === 'building'
                    ? '#F59E0B'
                    : 'var(--color-text-muted)',
                }}
              >
                {story.status}
              </span>
              <span>·</span>
              <span>{story.sprint}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <a
              href="#"
              onClick={e => e.preventDefault()}
              className="inline-flex items-center gap-1 text-xs"
              style={{ color: 'var(--color-text-muted)' }}
            >
              <ExternalLink size={11} />
              JIRA
            </a>
          </div>
        </div>

        {/* AC preview */}
        {story.acceptance_criteria.length > 0 && (
          <div className="mt-2">
            <details>
              <summary
                className="text-xs cursor-pointer select-none"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {story.acceptance_criteria.length} acceptance criteria
              </summary>
              <ul className="mt-1.5 space-y-1">
                {story.acceptance_criteria.map((ac, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-xs mt-0.5" style={{ color: 'var(--color-done)' }}>◦</span>
                    <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{ac}</span>
                  </li>
                ))}
              </ul>
            </details>
          </div>
        )}
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4">
        {conversationLoading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <Loader2 size={24} className="animate-spin" style={{ color: 'var(--color-accent)' }} />
            <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading conversation...</span>
          </div>
        ) : !hasMessages && !isBuilding ? (
          <EmptyState story={story} TypeIcon={TypeIcon!} onBuild={onStartBuild} />
        ) : (
          <>
            {messages.map((msg, index) => {
              const prevMsg = messages[index - 1]
              const showDateSep = !prevMsg ||
                msg.timestamp.toDateString() !== prevMsg.timestamp.toDateString()

              return (
                <div key={msg.id}>
                  {showDateSep && (
                    <div className="flex items-center gap-3 my-4">
                      <div className="flex-1 h-px" style={{ background: 'var(--color-border)' }} />
                      <span
                        className="text-xs px-2 py-0.5 rounded-full shrink-0"
                        style={{
                          color: 'var(--color-text-muted)',
                          background: 'var(--color-bg)',
                          border: '1px solid var(--color-border)',
                        }}
                      >
                        {formatDateSeparator(msg.timestamp)}
                      </span>
                      <div className="flex-1 h-px" style={{ background: 'var(--color-border)' }} />
                    </div>
                  )}
                  <AgentMessage message={msg} showTime />
                </div>
              )
            })}

            {isBuilding && messages.length === 0 && (
              <div className="flex gap-3 mb-4 animate-fade-in">
                <div
                  className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ background: 'var(--color-accent)', color: 'white' }}
                >
                  AI
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <div className="building-dot" />
                  <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                    Starting agent build...
                  </span>
                </div>
              </div>
            )}
          </>
        )}

        {/* Error */}
        {error && (
          <div
            className="flex items-start gap-2 rounded-lg px-3 py-2 mb-4 text-sm"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#FCA5A5' }}
          >
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <ChatInput
        onSend={onSendMessage}
        onStop={onStop}
        isBuilding={isBuilding}
        placeholder={!hasMessages ? 'Type a message or click "Build with AI" above...' : undefined}
      />
    </div>
  )
}

const STATUS_COLORS: Record<string, string> = {
  todo: '#6B7280',
  building: '#F59E0B',
  done: '#22C55E',
}

function EmptyState({ story, TypeIcon, onBuild }: { story: JiraStory; TypeIcon: React.ElementType; onBuild: () => void }) {
  const initials = story.assignee.split(' ').map((n: string) => n[0]).join('')

  return (
    <div className="flex flex-col gap-4 p-4 h-full overflow-y-auto">
      {/* Story details card */}
      <div
        className="rounded-xl p-4"
        style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
      >
        {/* Icon + key row */}
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'rgba(255,54,33,0.1)', border: '1px solid rgba(255,54,33,0.2)' }}
          >
            <TypeIcon size={18} style={{ color: 'var(--color-accent)' }} />
          </div>
          <div>
            <span className="text-xs font-mono font-bold" style={{ color: 'var(--color-accent)' }}>
              {story.key}
            </span>
            <div className="text-sm font-semibold leading-tight mt-0.5" style={{ color: 'var(--color-text-primary)' }}>
              {story.summary}
            </div>
          </div>
        </div>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {/* Assignee */}
          <div className="flex items-center gap-1.5">
            <span
              className="w-5 h-5 rounded-full flex items-center justify-center font-bold"
              style={{ background: 'var(--color-accent)', color: 'white', fontSize: '9px' }}
            >
              {initials}
            </span>
            <span>{story.assignee}</span>
          </div>
          <span>·</span>
          {/* Status */}
          <span className="capitalize font-medium" style={{ color: STATUS_COLORS[story.status] ?? '#6B7280' }}>
            {story.status}
          </span>
          <span>·</span>
          <span>{story.sprint}</span>
          <span>·</span>
          <span
            className="px-1.5 py-0.5 rounded"
            style={{ background: `${PRIORITY_COLORS[story.priority]}18`, color: PRIORITY_COLORS[story.priority] }}
          >
            {story.priority}
          </span>
          <span>·</span>
          <span>{story.story_points} pts</span>
        </div>

        {/* Full description */}
        <p
          className="text-sm leading-relaxed mb-4 whitespace-pre-line"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {story.description}
        </p>

        {/* Acceptance criteria */}
        <div className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
          Acceptance Criteria
        </div>
        <ul className="space-y-1.5">
          {story.acceptance_criteria.map((ac, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="mt-0.5 shrink-0" style={{ color: 'var(--color-done)' }}>◦</span>
              <span className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{ac}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Build CTA */}
      <div className="flex flex-col items-center gap-2 py-2">
        <button
          onClick={onBuild}
          className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all"
          style={{
            background: 'var(--color-accent)',
            color: 'white',
            boxShadow: '0 4px 24px rgba(255,54,33,0.35)',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 32px rgba(255,54,33,0.5)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 24px rgba(255,54,33,0.35)' }}
        >
          <PlayCircle size={18} />
          Build with AI
        </button>
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          Or type a question below to ask the AI about this story
        </p>
      </div>
    </div>
  )
}
