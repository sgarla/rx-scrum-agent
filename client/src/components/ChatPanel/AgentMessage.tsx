import { CheckCircle2, ChevronDown, ChevronRight, ExternalLink, Loader2, Package, XCircle } from 'lucide-react'
import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import type { ChatMessage, ContentBlock, TextBlock, ThinkingBlock, ToolResultBlock, ToolUseBlock } from '../../lib/types'
import { ToolUseCard } from './ToolUseCard'

interface Props {
  message: ChatMessage
  showTime?: boolean
}

function formatMsgTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

// ── Inline asset summary parsed from <assets_summary> blocks ────────────────

const ASSET_ICONS: Record<string, string> = {
  pipeline: '🔁', table: '📋', dashboard: '📊', endpoint: '🤖',
  job: '⏰', schema: '🗄️', notebook: '📓', index: '🔍', volume: '📦', model: '🧠',
}
const ASSET_COLORS: Record<string, string> = {
  pipeline: '#3B82F6', table: '#14B8A6', dashboard: '#8B5CF6', endpoint: '#F97316',
  job: '#6366F1', schema: '#6B7280', notebook: '#F59E0B', index: '#EC4899',
  volume: '#64748B', model: '#10B981',
}

interface ParsedAsset {
  type: string; name: string; url?: string; description?: string
  catalog?: string; schema?: string; full_path?: string
}

function parseAssetsSummary(text: string): ParsedAsset[] {
  const match = /<assets_summary>\s*([\s\S]*?)\s*<\/assets_summary>/i.exec(text)
  if (!match) return []
  try {
    const data = JSON.parse(match[1])
    return Array.isArray(data?.assets) ? data.assets : []
  } catch {
    return []
  }
}

function stripAssetsSummary(text: string): string {
  return text.replace(/<assets_summary>[\s\S]*?<\/assets_summary>/gi, '').trim()
}

function stripExecutionPlan(text: string): string {
  return text.replace(/<execution_plan>[\s\S]*?<\/execution_plan>/gi, '').trim()
}

function cleanText(raw: string): string {
  return stripExecutionPlan(stripAssetsSummary(raw)).trim()
}

function InlineAssetSummary({ assets }: { assets: ParsedAsset[] }) {
  const [open, setOpen] = useState(true)

  const typeCounts: Record<string, number> = {}
  for (const a of assets) typeCounts[a.type] = (typeCounts[a.type] ?? 0) + 1

  return (
    <div
      className="rounded-xl mb-3 overflow-hidden"
      style={{ border: '1px solid var(--color-border)', background: 'var(--color-bg)' }}
    >
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left"
        style={{ borderBottom: open ? '1px solid var(--color-border)' : 'none' }}
      >
        <Package size={13} style={{ color: '#10B981', flexShrink: 0 }} />
        <span className="text-xs font-semibold flex-1" style={{ color: 'var(--color-text-primary)' }}>
          {assets.length} asset{assets.length !== 1 ? 's' : ''} created
        </span>
        <div className="flex items-center gap-1 flex-wrap">
          {Object.entries(typeCounts).map(([type, count]) => (
            <span
              key={type}
              className="text-xs px-1.5 py-0.5 rounded-full"
              style={{
                background: `${ASSET_COLORS[type] ?? '#6B7280'}18`,
                color: ASSET_COLORS[type] ?? '#6B7280',
                fontSize: '10px',
              }}
            >
              {ASSET_ICONS[type] ?? '📦'} {count > 1 ? `${count} ` : ''}{type}{count > 1 ? 's' : ''}
            </span>
          ))}
        </div>
        {open
          ? <ChevronDown size={12} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
          : <ChevronRight size={12} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />}
      </button>
      {open && (
        <div className="p-2 space-y-1.5">
          {assets.map((asset, i) => {
            const icon = ASSET_ICONS[asset.type] ?? '📦'
            const color = ASSET_COLORS[asset.type] ?? '#6B7280'
            const location = asset.full_path
              ?? (asset.catalog && asset.schema ? `${asset.catalog}.${asset.schema}` : null)
            return (
              <div
                key={i}
                className="flex items-start gap-2 px-2 py-1.5 rounded-lg"
                style={{ background: 'var(--color-surface)' }}
              >
                <div
                  className="shrink-0 w-6 h-6 rounded flex items-center justify-center text-xs"
                  style={{ background: `${color}18` }}
                >
                  {icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
                    {asset.name}
                  </p>
                  {location && (
                    <p className="text-xs font-mono truncate" style={{ color: color, opacity: 0.8, fontSize: '10px' }}>
                      {location}
                    </p>
                  )}
                  {asset.description && (
                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)', lineHeight: '1.3' }}>
                      {asset.description.slice(0, 100)}{asset.description.length > 100 && '…'}
                    </p>
                  )}
                </div>
                {asset.url && (
                  <a
                    href={asset.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 mt-0.5"
                    style={{ color: '#60A5FA' }}
                    title="Open in workspace"
                  >
                    <ExternalLink size={11} />
                  </a>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Render a sequence of text/thinking blocks as prose ───────────────────────

function renderProseBlocks(blocks: ContentBlock[], keyPrefix: string): React.ReactNode[] {
  const result: React.ReactNode[] = []
  let buf = ''
  let i = 0

  const flush = () => {
    if (!buf.trim()) { buf = ''; return }
    const raw = buf
    buf = ''
    const assets = parseAssetsSummary(raw)
    const text = cleanText(raw)
    if (text) {
      result.push(
        <div key={`${keyPrefix}-t${i++}`} className="prose-agent text-sm mb-3">
          <ReactMarkdown>{text}</ReactMarkdown>
        </div>
      )
    }
    if (assets.length > 0) {
      result.push(<InlineAssetSummary key={`${keyPrefix}-a${i++}`} assets={assets} />)
    }
  }

  for (const block of blocks) {
    if (block.type === 'text') {
      buf += (block as TextBlock).text
    } else if (block.type === 'thinking') {
      flush()
      result.push(
        <div
          key={`${keyPrefix}-th${i++}`}
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
    }
  }
  flush()
  return result
}

// ── Work section — collapsible block containing ALL tool activity ─────────────

function WorkSection({
  blocks,
  toolMap,
  isStreaming,
}: {
  blocks: ContentBlock[]
  toolMap: Map<string, ToolResultBlock>
  isStreaming?: boolean
}) {
  const toolBlocks = blocks.filter(b => b.type === 'tool_use') as ToolUseBlock[]
  const doneCount = toolBlocks.filter(t => toolMap.get(t.id) && !toolMap.get(t.id)!.is_error).length
  const errorCount = toolBlocks.filter(t => toolMap.get(t.id)?.is_error).length
  const runningCount = toolBlocks.length - doneCount - errorCount
  const activelyRunning = runningCount > 0
  const hasError = errorCount > 0

  // Status
  let statusText: string
  let statusColor: string
  if (activelyRunning) {
    statusText = doneCount === 0
      ? `Building…`
      : `Building… (${doneCount}/${toolBlocks.length} done)`
    statusColor = '#F59E0B'
  } else if (hasError) {
    statusText = `${toolBlocks.length} step${toolBlocks.length !== 1 ? 's' : ''} · ${errorCount} error${errorCount !== 1 ? 's' : ''}`
    statusColor = '#EF4444'
  } else {
    statusText = `${toolBlocks.length} step${toolBlocks.length !== 1 ? 's' : ''} · done`
    statusColor = 'var(--color-done)'
  }

  // First error preview for subtitle
  const firstErrTool = toolBlocks.find(t => toolMap.get(t.id)?.is_error)
  const firstErrResult = firstErrTool ? toolMap.get(firstErrTool.id) : undefined
  const errPreview = firstErrResult
    ? (typeof firstErrResult.content === 'string'
        ? firstErrResult.content
        : Array.isArray(firstErrResult.content)
          ? firstErrResult.content.map(c => (typeof c === 'object' && 'text' in c ? (c as { text: string }).text : '')).join('')
          : ''
      ).replace(/\n/g, ' ').slice(0, 150)
    : null

  const [open, setOpen] = useState(false)

  // Render work blocks: text + thinking inline, tool cards as ToolUseCard
  const workContent: React.ReactNode[] = []
  let textBuf = ''
  let wi = 0

  const flushWorkText = () => {
    if (!textBuf.trim()) { textBuf = ''; return }
    const raw = textBuf
    textBuf = ''
    const text = cleanText(raw)
    if (text) {
      workContent.push(
        <div key={`wt${wi++}`} className="prose-agent text-sm py-1">
          <ReactMarkdown>{text}</ReactMarkdown>
        </div>
      )
    }
  }

  for (const block of blocks) {
    if (block.type === 'text') {
      textBuf += (block as TextBlock).text
    } else if (block.type === 'thinking') {
      flushWorkText()
      workContent.push(
        <div
          key={`wth${wi++}`}
          className="text-xs italic px-2 py-1.5 rounded my-1"
          style={{
            color: 'var(--color-text-muted)',
            background: 'rgba(255,255,255,0.03)',
            borderLeft: '2px solid var(--color-border)',
          }}
        >
          💭 {(block as ThinkingBlock).thinking.slice(0, 200)}
          {(block as ThinkingBlock).thinking.length > 200 && '…'}
        </div>
      )
    } else if (block.type === 'tool_use') {
      flushWorkText()
      const tb = block as ToolUseBlock
      workContent.push(
        <ToolUseCard key={tb.id} block={tb} resultBlock={toolMap.get(tb.id)} />
      )
    }
    // tool_result: handled via toolMap
  }
  flushWorkText()

  return (
    <div
      className="rounded-xl overflow-hidden mb-3"
      style={{
        border: `1px solid ${hasError ? '#EF444440' : 'var(--color-border)'}`,
        background: hasError ? 'rgba(239,68,68,0.03)' : 'var(--color-bg)',
      }}
    >
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-start gap-2 px-3 py-2.5 text-left"
        style={{ background: 'transparent' }}
      >
        {/* Status icon */}
        <div className="mt-0.5 shrink-0">
          {activelyRunning && <Loader2 size={13} className="animate-spin" style={{ color: '#F59E0B' }} />}
          {!activelyRunning && hasError && <XCircle size={13} style={{ color: '#EF4444' }} />}
          {!activelyRunning && !hasError && <CheckCircle2 size={13} style={{ color: 'var(--color-done)' }} />}
        </div>

        {/* Label + error subtitle */}
        <div className="flex-1 min-w-0">
          <span className="text-xs font-medium" style={{ color: statusColor }}>
            {statusText}
          </span>
          {hasError && errPreview && (
            <p
              className="text-xs mt-0.5"
              style={{ color: '#FCA5A5', opacity: 0.85, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
            >
              {errPreview}{errPreview.length === 150 && '…'}
            </p>
          )}
        </div>

        {/* Chevron */}
        <div className="mt-0.5 shrink-0">
          {open
            ? <ChevronDown size={12} style={{ color: 'var(--color-text-muted)' }} />
            : <ChevronRight size={12} style={{ color: 'var(--color-text-muted)' }} />}
        </div>
      </button>

      {/* Content */}
      {open && (
        <div
          className="px-3 pb-3"
          style={{ borderTop: '1px solid var(--color-border)' }}
        >
          {workContent}
        </div>
      )}
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

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

  // Build blocks array
  const blocks = message.blocks ?? (message.text ? [{ type: 'text' as const, text: message.text }] : [])

  // Build toolMap: tool_use_id → tool_result
  const toolMap = new Map<string, ToolResultBlock>()
  for (const block of blocks) {
    if (block.type === 'tool_result') {
      toolMap.set((block as ToolResultBlock).tool_use_id, block as ToolResultBlock)
    }
  }

  // Find split points
  const firstToolIdx = blocks.findIndex(b => b.type === 'tool_use')
  const lastActivityIdx = blocks.reduce(
    (last, b, i) => (b.type === 'tool_use' || b.type === 'tool_result') ? i : last,
    -1
  )
  const hasTools = firstToolIdx !== -1

  const rendered: React.ReactNode[] = []

  if (!hasTools) {
    // No tool calls — render all as plain prose (plan mode / conversational)
    rendered.push(...renderProseBlocks(blocks, 'p'))
  } else {
    const preamble   = blocks.slice(0, firstToolIdx)
    const work       = blocks.slice(firstToolIdx, lastActivityIdx + 1)
    const conclusion = blocks.slice(lastActivityIdx + 1)

    // Intro text — always visible above the work section
    rendered.push(...renderProseBlocks(preamble, 'pre'))

    // ONE work section with everything inside
    rendered.push(
      <WorkSection
        key="work"
        blocks={work}
        toolMap={toolMap}
        isStreaming={message.isStreaming}
      />
    )

    // Conclusion text — always visible below the work section
    rendered.push(...renderProseBlocks(conclusion, 'con'))
  }

  // Streaming cursor
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
