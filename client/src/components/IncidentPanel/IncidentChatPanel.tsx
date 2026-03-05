import {
  AlertCircle,
  AlertTriangle,
  ExternalLink,
  Loader2,
  SearchCode,
  Sparkles,
} from 'lucide-react'
import { useEffect, useRef } from 'react'
import type { ChatMessage, ServiceNowIncident } from '../../lib/types'
import { AgentMessage } from '../ChatPanel/AgentMessage'
import { ChatInput } from '../ChatPanel/ChatInput'

interface Props {
  incident: ServiceNowIncident | null
  messages: ChatMessage[]
  isBuilding: boolean
  conversationLoading?: boolean
  error: string | null
  onStartInvestigation: () => void
  onSendMessage: (text: string, mode: 'plan' | 'agent') => void
  onStop: () => void
  snowInstance?: string
}

function formatDateSeparator(date: Date): string {
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
}

const PRIORITY_COLORS: Record<string, string> = {
  Critical: '#EF4444',
  High: '#F97316',
  Moderate: '#F59E0B',
  Low: '#6B7280',
  Planning: '#6B7280',
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
    return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}

export function IncidentChatPanel({
  incident,
  messages,
  isBuilding,
  conversationLoading,
  error,
  onStartInvestigation,
  onSendMessage,
  onStop,
  snowInstance,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!conversationLoading) {
      bottomRef.current?.scrollIntoView({ behavior: 'instant' })
    }
  }, [conversationLoading])

  if (!incident) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center" style={{ background: 'var(--color-surface)' }}>
        <Sparkles size={40} style={{ color: 'var(--color-text-muted)', opacity: 0.4 }} />
        <p className="mt-4 text-base font-medium" style={{ color: 'var(--color-text-secondary)' }}>
          Select an incident to investigate
        </p>
        <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Pick a ServiceNow incident to troubleshoot with AI
        </p>
      </div>
    )
  }

  const hasMessages = messages.length > 0
  const stateColor = STATE_COLORS[incident.state] ?? '#6B7280'
  const priorityColor = PRIORITY_COLORS[incident.priority] ?? '#6B7280'
  const snowUrl = snowInstance
    ? `https://${snowInstance.replace(/^https?:\/\//, '')}/nav_to.do?uri=incident.do?number=${incident.number}`
    : null

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ background: 'var(--color-surface)', minWidth: 0 }}>
      {/* Incident header */}
      <div
        className="shrink-0 px-4 py-3"
        style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)' }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span
                className="text-xs font-mono font-bold px-2 py-0.5 rounded"
                style={{ background: 'var(--color-bg)', color: '#818CF8' }}
              >
                {incident.number}
              </span>
              <span
                className="text-xs px-1.5 py-0.5 rounded font-medium"
                style={{ background: `${stateColor}18`, color: stateColor }}
              >
                {incident.state}
              </span>
              <span
                className="text-xs px-1.5 py-0.5 rounded"
                style={{ background: `${priorityColor}18`, color: priorityColor }}
              >
                {incident.priority}
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
            <h2 className="text-sm font-semibold leading-snug" style={{ color: 'var(--color-text-primary)' }}>
              {incident.short_description}
            </h2>
            <div className="flex items-center gap-2 mt-1.5 text-xs flex-wrap" style={{ color: 'var(--color-text-muted)' }}>
              {incident.assigned_to && (
                <>
                  <span>{incident.assigned_to}</span>
                  <span>·</span>
                </>
              )}
              {incident.assignment_group && (
                <>
                  <span>{incident.assignment_group}</span>
                  <span>·</span>
                </>
              )}
              {incident.cmdb_ci && (
                <>
                  <span className="font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                    CI: {incident.cmdb_ci}
                  </span>
                  <span>·</span>
                </>
              )}
              <span>Opened {formatDate(incident.opened_at)}</span>
            </div>
          </div>

          {snowUrl && (
            <a
              href={snowUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs shrink-0"
              style={{ color: 'var(--color-text-muted)' }}
            >
              <ExternalLink size={11} />
              ServiceNow
            </a>
          )}
        </div>

        {/* Description preview */}
        {incident.description && (
          <div className="mt-2">
            <details>
              <summary
                className="text-xs cursor-pointer select-none"
                style={{ color: 'var(--color-text-muted)' }}
              >
                Incident details
              </summary>
              <div
                className="mt-1.5 text-xs leading-relaxed whitespace-pre-line rounded p-2"
                style={{
                  color: 'var(--color-text-secondary)',
                  background: 'var(--color-bg)',
                  border: '1px solid var(--color-border)',
                }}
              >
                {incident.description}
              </div>
            </details>
          </div>
        )}
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4">
        {conversationLoading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <Loader2 size={24} className="animate-spin" style={{ color: '#6366F1' }} />
            <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading conversation...</span>
          </div>
        ) : !hasMessages && !isBuilding ? (
          <IncidentEmptyState incident={incident} onInvestigate={onStartInvestigation} />
        ) : (
          <>
            {messages.map((msg, index) => {
              const prevMsg = messages[index - 1]
              const showDateSep = !prevMsg || msg.timestamp.toDateString() !== prevMsg.timestamp.toDateString()
              return (
                <div key={msg.id}>
                  {showDateSep && (
                    <div className="flex items-center gap-3 my-4">
                      <div className="flex-1 h-px" style={{ background: 'var(--color-border)' }} />
                      <span
                        className="text-xs px-2 py-0.5 rounded-full shrink-0"
                        style={{ color: 'var(--color-text-muted)', background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
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
                  style={{ background: '#6366F1', color: 'white' }}
                >
                  AI
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <div className="building-dot" />
                  <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                    Investigating incident...
                  </span>
                </div>
              </div>
            )}
          </>
        )}

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
        placeholder={!hasMessages ? 'Ask about this incident or click "Investigate with AI"...' : undefined}
      />
    </div>
  )
}

function IncidentEmptyState({
  incident,
  onInvestigate,
}: {
  incident: ServiceNowIncident
  onInvestigate: () => void
}) {
  return (
    <div className="flex flex-col gap-4 p-4 h-full overflow-y-auto">
      <div
        className="rounded-xl p-4"
        style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
      >
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}
          >
            <AlertTriangle size={18} style={{ color: '#6366F1' }} />
          </div>
          <div>
            <span className="text-xs font-mono font-bold" style={{ color: '#818CF8' }}>
              {incident.number}
            </span>
            <div className="text-sm font-semibold leading-tight mt-0.5" style={{ color: 'var(--color-text-primary)' }}>
              {incident.short_description}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>
          <span>State: <span className="font-medium" style={{ color: STATE_COLORS[incident.state] ?? '#6B7280' }}>{incident.state}</span></span>
          <span>·</span>
          <span>Priority: <span className="font-medium" style={{ color: PRIORITY_COLORS[incident.priority] ?? '#6B7280' }}>{incident.priority}</span></span>
          {incident.category && <><span>·</span><span>{incident.category}</span></>}
          {incident.cmdb_ci && <><span>·</span><span>CI: {incident.cmdb_ci}</span></>}
          {incident.assigned_to && <><span>·</span><span>{incident.assigned_to}</span></>}
        </div>

        {incident.description && (
          <p
            className="text-sm leading-relaxed mb-3 whitespace-pre-line"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {incident.description}
          </p>
        )}
      </div>

      <div className="flex flex-col items-center gap-2 py-2">
        <button
          onClick={onInvestigate}
          className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all"
          style={{
            background: '#6366F1',
            color: 'white',
            boxShadow: '0 4px 24px rgba(99,102,241,0.35)',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 32px rgba(99,102,241,0.5)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 24px rgba(99,102,241,0.35)' }}
        >
          <SearchCode size={18} />
          Investigate with AI
        </button>
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          Or type a question below to ask the AI about this incident
        </p>
      </div>
    </div>
  )
}
