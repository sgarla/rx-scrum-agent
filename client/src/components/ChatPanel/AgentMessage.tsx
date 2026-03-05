import { ChevronDown, ChevronRight, ExternalLink, Package } from 'lucide-react'
import { useState } from 'react'
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

function InlineAssetSummary({ assets }: { assets: ParsedAsset[] }) {
  const [open, setOpen] = useState(true)

  // Group by type for the header
  const typeCounts: Record<string, number> = {}
  for (const a of assets) typeCounts[a.type] = (typeCounts[a.type] ?? 0) + 1

  return (
    <div
      className="rounded-xl mb-3 overflow-hidden"
      style={{ border: '1px solid var(--color-border)', background: 'var(--color-bg)' }}
    >
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left"
        style={{ borderBottom: open ? '1px solid var(--color-border)' : 'none' }}
      >
        <Package size={13} style={{ color: '#10B981', flexShrink: 0 }} />
        <span className="text-xs font-semibold flex-1" style={{ color: 'var(--color-text-primary)' }}>
          {assets.length} asset{assets.length !== 1 ? 's' : ''} created
        </span>
        {/* type pills */}
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

      {/* Asset list */}
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
    if (!textBuffer.trim()) { textBuffer = ''; return }
    const raw = textBuffer
    textBuffer = ''

    // Parse out any <assets_summary> block
    const assets = parseAssetsSummary(raw)
    const cleanText = stripAssetsSummary(raw)

    if (cleanText.trim()) {
      rendered.push(
        <div key={`text-${i++}`} className="prose-agent text-sm mb-3">
          <ReactMarkdown>{cleanText}</ReactMarkdown>
        </div>
      )
    }
    if (assets.length > 0) {
      rendered.push(<InlineAssetSummary key={`assets-${i++}`} assets={assets} />)
    }
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
