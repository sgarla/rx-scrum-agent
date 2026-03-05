import { useEffect, useRef, useState } from 'react'
import { Database, RefreshCw, Send, Sparkles } from 'lucide-react'
import { askGenie, fetchGenieStatus, triggerGenieSync } from '../../lib/api'
import type { GenieMessage } from '../../lib/types'
import type { GenieStatusResponse } from '../../lib/api'

export function GeniePanel() {
  const [status, setStatus] = useState<GenieStatusResponse | null>(null)
  const [messages, setMessages] = useState<GenieMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [conversationId, setConversationId] = useState<string | undefined>()
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchGenieStatus().then(setStatus).catch(() => {})
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || loading) return

    const userMsg: GenieMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const resp = await askGenie(text, conversationId)
      setConversationId(resp.conversation_id)
      const genieMsg: GenieMessage = {
        id: crypto.randomUUID(),
        role: 'genie',
        content: resp.answer,
        sql: resp.sql,
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, genieMsg])
    } catch (err: any) {
      const errMsg: GenieMessage = {
        id: crypto.randomUUID(),
        role: 'genie',
        content: `Error: ${err?.message ?? 'Failed to get response from Genie'}`,
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, errMsg])
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      await triggerGenieSync()
    } catch (e) {
      console.error('Sync failed', e)
    } finally {
      setSyncing(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (!status) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading Genie status…</p>
      </div>
    )
  }

  if (!status.configured) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8">
        <Sparkles size={40} style={{ color: 'var(--color-text-muted)', opacity: 0.4 }} />
        <div className="text-center">
          <p className="text-sm font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>
            Genie not configured
          </p>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)', lineHeight: '1.6' }}>
            Set <code className="font-mono" style={{ color: 'var(--color-accent)' }}>GENIE_SPACE_ID</code> in{' '}
            <code className="font-mono" style={{ color: 'var(--color-accent)' }}>app.yaml</code> to enable Genie.
          </p>
          <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)', lineHeight: '1.6' }}>
            Create a Genie Space in your workspace pointing to{' '}
            <code className="font-mono" style={{ color: '#10B981' }}>healthcare_demo.scrum_demo</code> tables.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div
        className="shrink-0 flex items-center justify-between px-4 py-3"
        style={{ borderBottom: '1px solid var(--color-border)' }}
      >
        <div className="flex items-center gap-2">
          <Sparkles size={16} style={{ color: '#818CF8' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Genie — Scrum Activity
          </span>
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(99,102,241,0.15)', color: '#818CF8' }}
          >
            healthcare_demo.scrum_demo
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-1.5 text-xs px-2 py-1 rounded transition-all"
            style={{
              background: 'var(--color-surface-2)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-secondary)',
            }}
            title="Sync latest data to Delta tables"
          >
            <RefreshCw size={11} className={syncing ? 'animate-spin' : ''} />
            Sync
          </button>
          <button
            onClick={() => { setMessages([]); setConversationId(undefined) }}
            className="text-xs px-2 py-1 rounded transition-all"
            style={{
              background: 'var(--color-surface-2)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-secondary)',
            }}
          >
            New chat
          </button>
        </div>
      </div>

      {/* Suggested questions */}
      {messages.length === 0 && (
        <div className="shrink-0 px-4 pt-4 pb-2">
          <p className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>Try asking:</p>
          <div className="flex flex-wrap gap-2">
            {[
              'What stories are in progress?',
              'Which assets has CLAIMS-101 created?',
              'Who is working on ML models?',
              'How many tables were built across all stories?',
              'Show all assets created in the last session',
            ].map(q => (
              <button
                key={q}
                onClick={() => { setInput(q); setTimeout(() => inputRef.current?.focus(), 50) }}
                className="text-xs px-2.5 py-1.5 rounded-lg transition-all"
                style={{
                  background: 'var(--color-bg)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'genie' && (
              <div
                className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center mr-2 mt-0.5"
                style={{ background: 'rgba(99,102,241,0.2)' }}
              >
                <Sparkles size={12} style={{ color: '#818CF8' }} />
              </div>
            )}
            <div className="max-w-[85%]">
              <div
                className="rounded-xl px-3 py-2 text-sm"
                style={msg.role === 'user' ? {
                  background: 'var(--color-accent)',
                  color: 'white',
                } : {
                  background: 'var(--color-surface-2)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-primary)',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {msg.content}
              </div>
              {msg.sql && (
                <div
                  className="mt-1.5 px-3 py-2 rounded-lg font-mono text-xs overflow-x-auto"
                  style={{
                    background: 'var(--color-bg)',
                    border: '1px solid var(--color-border)',
                    color: '#10B981',
                  }}
                >
                  <div className="flex items-center gap-1 mb-1" style={{ color: 'var(--color-text-muted)' }}>
                    <Database size={10} />
                    <span style={{ fontSize: '10px' }}>SQL</span>
                  </div>
                  {msg.sql}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div
              className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center mr-2 mt-0.5"
              style={{ background: 'rgba(99,102,241,0.2)' }}
            >
              <Sparkles size={12} style={{ color: '#818CF8' }} />
            </div>
            <div
              className="px-3 py-2 rounded-xl text-sm flex items-center gap-2"
              style={{
                background: 'var(--color-surface-2)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-muted)',
              }}
            >
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full animate-bounce"
                    style={{ background: '#818CF8', animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
              Thinking…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div
        className="shrink-0 px-4 py-3"
        style={{ borderTop: '1px solid var(--color-border)' }}
      >
        <div
          className="flex items-center gap-2 rounded-xl px-3 py-2"
          style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about stories, assets, or team activity…"
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: 'var(--color-text-primary)' }}
            disabled={loading}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="p-1.5 rounded-lg transition-all"
            style={{
              background: input.trim() && !loading ? 'var(--color-accent)' : 'var(--color-surface-2)',
              color: input.trim() && !loading ? 'white' : 'var(--color-text-muted)',
            }}
          >
            <Send size={13} />
          </button>
        </div>
      </div>
    </div>
  )
}
