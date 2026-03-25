import {
  AlertCircle,
  BarChart2,
  Bot,
  BrainCircuit,
  Database,
  ExternalLink,
  GitBranch,
  History,
  Loader2,
  Pencil,
  Plus,
  Sparkles,
  Timer,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { ChatMessage, Conversation, JiraStory } from '../../lib/types'
import { AgentMessage } from './AgentMessage'
import { ChatInput } from './ChatInput'

interface Props {
  story: JiraStory | null
  messages: ChatMessage[]
  isBuilding: boolean
  conversationLoading?: boolean
  error: string | null
  onSendMessage: (text: string, mode: 'plan' | 'agent') => void
  onStop: () => void
  conversations?: Conversation[]
  activeConversationId?: string | null
  onNewConversation?: () => void
  onSwitchConversation?: (conv: Conversation) => void
  onRenameConversation?: (id: string, title: string) => void
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

export function ChatPanel({
  story, messages, isBuilding, conversationLoading, error, onSendMessage, onStop,
  conversations = [], activeConversationId, onNewConversation, onSwitchConversation, onRenameConversation,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const [showHistory, setShowHistory] = useState(false)
  const TypeIcon = story ? (TYPE_ICONS[story.type] ?? Database) : null

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Snap to bottom when conversation finishes loading (messages were set while spinner was showing)
  useEffect(() => {
    if (!conversationLoading) {
      bottomRef.current?.scrollIntoView({ behavior: 'instant' })
    }
  }, [conversationLoading])

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

          <div className="flex items-center gap-1.5 shrink-0">
            <a
              href="#"
              onClick={e => e.preventDefault()}
              className="inline-flex items-center gap-1 text-xs"
              style={{ color: 'var(--color-text-muted)' }}
            >
              <ExternalLink size={11} />
              JIRA
            </a>
            {onNewConversation && (
              <button
                onClick={() => { onNewConversation(); setShowHistory(false) }}
                disabled={isBuilding}
                title="New chat"
                className="p-1 rounded transition-all"
                style={{ color: isBuilding ? 'var(--color-text-muted)' : 'var(--color-text-secondary)', opacity: isBuilding ? 0.4 : 1 }}
              >
                <Plus size={13} />
              </button>
            )}
            {onSwitchConversation && conversations.length > 0 && (
              <button
                onClick={() => setShowHistory(h => !h)}
                disabled={isBuilding}
                title="Chat history"
                className="p-1 rounded transition-all"
                style={{
                  color: showHistory ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                  opacity: isBuilding ? 0.4 : 1,
                }}
              >
                <History size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Chat history panel */}
        {showHistory && conversations.length > 0 && (
          <ConversationHistory
            conversations={conversations}
            activeConversationId={activeConversationId ?? null}
            onSelect={conv => { onSwitchConversation?.(conv); setShowHistory(false) }}
            onRename={onRenameConversation ?? (() => {})}
            onClose={() => setShowHistory(false)}
          />
        )}

        {/* Story Details collapsible */}
        <div className="mt-2">
          <details>
            <summary
              className="text-xs cursor-pointer select-none"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Story Details
            </summary>
            <div className="mt-2 space-y-2">
              {story.description && (
                <p className="text-xs leading-relaxed whitespace-pre-line" style={{ color: 'var(--color-text-secondary)' }}>
                  {story.description}
                </p>
              )}
              {story.acceptance_criteria.length > 0 && (
                <>
                  <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
                    Acceptance Criteria
                  </div>
                  <ul className="space-y-1">
                    {story.acceptance_criteria.map((ac, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="text-xs mt-0.5 shrink-0" style={{ color: 'var(--color-done)' }}>◦</span>
                        <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{ac}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </details>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4">
        {conversationLoading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <Loader2 size={24} className="animate-spin" style={{ color: 'var(--color-accent)' }} />
            <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading conversation...</span>
          </div>
        ) : !hasMessages && !isBuilding ? (
          <EmptyState story={story} TypeIcon={TypeIcon!} />
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

            {/* Thinking bubble — shown while building before the agent starts responding */}
            {isBuilding && (messages.length === 0 || messages[messages.length - 1]?.role === 'user') && (
              <div className="flex gap-3 mb-4 animate-fade-in">
                <div
                  className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ background: 'var(--color-accent)', color: 'white' }}
                >
                  AI
                </div>
                <div
                  className="flex items-center gap-2 px-3 py-2 rounded-2xl rounded-tl-sm"
                  style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
                >
                  <span className="flex gap-1 items-center">
                    <span className="thinking-dot" style={{ animationDelay: '0ms' }} />
                    <span className="thinking-dot" style={{ animationDelay: '150ms' }} />
                    <span className="thinking-dot" style={{ animationDelay: '300ms' }} />
                  </span>
                  <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    Agent is thinking...
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
        onSend={(text, mode) => onSendMessage(text, mode)}
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

function EmptyState({ story, TypeIcon }: { story: JiraStory; TypeIcon: React.ElementType }) {
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

      {/* Prompt to start in Plan mode */}
      <div className="flex flex-col items-center gap-1 py-2">
        <p className="text-xs text-center" style={{ color: 'var(--color-text-muted)' }}>
          Start in <strong style={{ color: 'var(--color-text-secondary)' }}>Plan mode</strong> to discuss the approach, then switch to <strong style={{ color: 'var(--color-text-secondary)' }}>Agent mode</strong> to build.
        </p>
      </div>
    </div>
  )
}

function ConversationHistory({
  conversations,
  activeConversationId,
  onSelect,
  onRename,
  onClose,
}: {
  conversations: Conversation[]
  activeConversationId: string | null
  onSelect: (conv: Conversation) => void
  onRename: (id: string, title: string) => void
  onClose: () => void
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const startEdit = (conv: Conversation, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingId(conv.id)
    setEditValue(conv.title ?? '')
  }

  const commitEdit = (id: string) => {
    if (editValue.trim()) onRename(id, editValue.trim())
    setEditingId(null)
  }

  return (
    <div
      className="mt-2 rounded-lg overflow-hidden"
      style={{ border: '1px solid var(--color-border)', background: 'var(--color-bg)' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{ borderBottom: '1px solid var(--color-border)' }}
      >
        <span className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
          Chat History
        </span>
        <button onClick={onClose} className="p-0.5 rounded" style={{ color: 'var(--color-text-muted)' }}>
          <X size={12} />
        </button>
      </div>

      {/* List */}
      <div className="max-h-48 overflow-y-auto">
        {conversations.map(conv => {
          const isActive = conv.id === activeConversationId
          return (
            <div
              key={conv.id}
              onClick={() => editingId !== conv.id && onSelect(conv)}
              className="flex items-center gap-2 px-3 py-2 cursor-pointer"
              style={{
                background: isActive ? 'rgba(255,54,33,0.06)' : 'transparent',
                borderLeft: isActive ? '2px solid var(--color-accent)' : '2px solid transparent',
              }}
            >
              {/* Active dot */}
              <span
                className="shrink-0 w-1.5 h-1.5 rounded-full"
                style={{ background: isActive ? 'var(--color-accent)' : 'transparent' }}
              />

              {/* Title / inline edit */}
              {editingId === conv.id ? (
                <input
                  autoFocus
                  className="flex-1 text-xs bg-transparent outline-none border-b"
                  style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-accent)' }}
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  onBlur={() => commitEdit(conv.id)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') commitEdit(conv.id)
                    if (e.key === 'Escape') setEditingId(null)
                  }}
                  onClick={e => e.stopPropagation()}
                />
              ) : (
                <span className="flex-1 text-xs truncate" style={{ color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}>
                  {conv.title ?? 'Untitled chat'}
                </span>
              )}

              {/* Rename pencil */}
              {editingId !== conv.id && (
                <button
                  onClick={e => startEdit(conv, e)}
                  className="shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color: 'var(--color-text-muted)' }}
                  title="Rename"
                  onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = isActive ? '0.6' : '0')}
                >
                  <Pencil size={10} />
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
