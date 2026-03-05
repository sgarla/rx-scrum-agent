import ReactMarkdown from 'react-markdown'
import type { ChatMessage, TextBlock, ThinkingBlock, ToolResultBlock, ToolUseBlock } from '../../lib/types'
import { ToolUseCard } from './ToolUseCard'

interface Props {
  message: ChatMessage
  showTime?: boolean
}

function formatMsgTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

export function AgentMessage({ message, showTime }: Props) {
  if (message.role === 'user') {
    return (
      <div className="flex flex-col items-end mb-4 animate-fade-in">
        <div
          className="max-w-lg rounded-2xl rounded-tr-sm px-4 py-3 text-sm"
          style={{ background: 'var(--color-accent)', color: 'white' }}
        >
          {message.text}
        </div>
        {showTime && message.timestamp && (
          <span className="text-xs mt-1 mr-1" style={{ color: 'var(--color-text-muted)' }}>
            {formatMsgTime(message.timestamp)}
          </span>
        )}
      </div>
    )
  }

  // Assistant message — render blocks
  const blocks = message.blocks ?? (message.text ? [{ type: 'text' as const, text: message.text }] : [])

  // Build tool use → result pairs
  const toolMap = new Map<string, ToolResultBlock>()
  for (const block of blocks) {
    if (block.type === 'tool_result') {
      toolMap.set(block.tool_use_id, block as ToolResultBlock)
    }
  }

  const rendered: React.ReactNode[] = []
  let textBuffer = ''
  let i = 0

  const flushText = () => {
    if (!textBuffer.trim()) {
      textBuffer = ''
      return
    }
    const text = textBuffer
    textBuffer = ''
    rendered.push(
      <div key={`text-${i++}`} className="prose-agent text-sm mb-3">
        <ReactMarkdown>{text}</ReactMarkdown>
      </div>
    )
  }

  for (const block of blocks) {
    if (block.type === 'text') {
      textBuffer += (block as TextBlock).text
    } else if (block.type === 'thinking') {
      flushText()
      rendered.push(
        <div
          key={`think-${i++}`}
          className="text-xs italic mb-2 px-3 py-2 rounded"
          style={{
            color: 'var(--color-text-muted)',
            background: 'rgba(255,255,255,0.03)',
            borderLeft: '2px solid var(--color-border)',
          }}
        >
          <span style={{ color: 'var(--color-text-muted)' }}>💭 </span>
          {(block as ThinkingBlock).thinking.slice(0, 200)}
          {(block as ThinkingBlock).thinking.length > 200 && '…'}
        </div>
      )
    } else if (block.type === 'tool_use') {
      flushText()
      const tb = block as ToolUseBlock
      const result = toolMap.get(tb.id)
      rendered.push(
        <ToolUseCard key={`tool-${tb.id}`} block={tb} resultBlock={result} />
      )
    } else if (block.type === 'tool_result') {
      // Already handled above via toolMap
    }
  }
  flushText()

  // Streaming cursor on last text element
  if (message.isStreaming) {
    rendered.push(
      <span
        key="cursor"
        className="inline-block w-2 h-4 rounded-sm align-middle"
        style={{
          background: 'var(--color-accent)',
          animation: 'blink 1s step-start infinite',
          verticalAlign: 'middle',
          marginLeft: 2,
        }}
      />
    )
  }

  if (rendered.length === 0) return null

  return (
    <div className="flex gap-3 mb-4 animate-fade-in">
      {/* Agent avatar */}
      <div
        className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mt-0.5"
        style={{ background: 'var(--color-accent)', color: 'white' }}
      >
        AI
      </div>

      <div className="flex-1 min-w-0">
        {rendered}
        {showTime && !message.isStreaming && message.timestamp && (
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {formatMsgTime(message.timestamp)}
          </span>
        )}
      </div>
    </div>
  )
}
