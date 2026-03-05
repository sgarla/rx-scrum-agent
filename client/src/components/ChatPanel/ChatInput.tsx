import { Send, Square } from 'lucide-react'
import { useRef, useState } from 'react'

interface Props {
  onSend: (text: string) => void
  onStop: () => void
  isBuilding: boolean
  disabled?: boolean
  placeholder?: string
}

export function ChatInput({ onSend, onStop, isBuilding, disabled, placeholder }: Props) {
  const [text, setText] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)

  const send = () => {
    const t = text.trim()
    if (!t || disabled) return
    onSend(t)
    setText('')
    ref.current?.focus()
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div
      className="shrink-0 p-3"
      style={{ borderTop: '1px solid var(--color-border)', background: 'var(--color-surface)' }}
    >
      <div
        className="flex items-end gap-2 rounded-xl px-3 py-2"
        style={{
          background: 'var(--color-bg)',
          border: `1px solid ${text ? 'var(--color-accent)' : 'var(--color-border)'}`,
          transition: 'border-color 0.15s',
          boxShadow: text ? '0 0 0 2px rgba(255,54,33,0.1)' : 'none',
        }}
      >
        <textarea
          ref={ref}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={onKey}
          placeholder={placeholder ?? 'Ask a follow-up question or give instructions...'}
          rows={1}
          className="flex-1 resize-none text-sm outline-none bg-transparent"
          style={{
            color: 'var(--color-text-primary)',
            maxHeight: '120px',
            lineHeight: '1.5',
          }}
          onInput={e => {
            const el = e.currentTarget
            el.style.height = 'auto'
            el.style.height = Math.min(el.scrollHeight, 120) + 'px'
          }}
        />

        <div className="flex items-center gap-1.5 shrink-0 pb-0.5">
          {isBuilding && (
            <button
              onClick={onStop}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-all"
              style={{ background: 'rgba(239,68,68,0.12)', color: '#EF4444' }}
            >
              <Square size={10} />
              Stop
            </button>
          )}

          <button
            onClick={send}
            disabled={!text.trim() || !!disabled}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
            style={{
              background: text.trim() && !disabled ? 'var(--color-accent)' : 'var(--color-border)',
              color: text.trim() && !disabled ? 'white' : 'var(--color-text-muted)',
              cursor: text.trim() && !disabled ? 'pointer' : 'not-allowed',
            }}
          >
            <Send size={14} />
          </button>
        </div>
      </div>

      <p className="text-center text-xs mt-1.5" style={{ color: 'var(--color-text-muted)' }}>
        {isBuilding
          ? 'Agent is working · You can still send messages'
          : 'Enter to send · Shift+Enter for new line'}
      </p>
    </div>
  )
}
