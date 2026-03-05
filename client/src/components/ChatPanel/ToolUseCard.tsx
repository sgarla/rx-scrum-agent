import { ChevronDown, ChevronRight, Wrench } from 'lucide-react'
import { useState } from 'react'
import type { ToolResultBlock, ToolUseBlock } from '../../lib/types'

const TOOL_ICONS: Record<string, string> = {
  execute_sql: '🗄️',
  execute_databricks_command: '⚡',
  create_or_update_pipeline: '🔁',
  run_pipeline: '▶️',
  create_or_update_dashboard: '📊',
  publish_dashboard: '📤',
  manage_jobs: '⏰',
  manage_job_runs: '▶️',
  create_or_update_vs_endpoint: '🔍',
  create_or_update_vs_index: '📑',
  manage_uc_grants: '🔐',
  manage_uc_objects: '📦',
  upload_file: '📁',
  upload_folder: '📂',
  get_table_details: '📋',
  query_serving_endpoint: '🤖',
  list_warehouses: '🏭',
  get_best_warehouse: '🏭',
  get_best_cluster: '💻',
  list_clusters: '💻',
  get_current_user: '👤',
  Write: '✏️',
  Read: '📖',
  Edit: '🖊️',
  Glob: '🔎',
  Grep: '🔍',
  Bash: '💻',
}

interface Props {
  block: ToolUseBlock
  resultBlock?: ToolResultBlock
}

export function ToolUseCard({ block, resultBlock }: Props) {
  const [expanded, setExpanded] = useState(false)
  const icon = TOOL_ICONS[block.name] ?? '🔧'

  const resultText = resultBlock
    ? typeof resultBlock.content === 'string'
      ? resultBlock.content
      : Array.isArray(resultBlock.content)
        ? resultBlock.content.map(c => (typeof c === 'object' && 'text' in c ? c.text : String(c))).join('\n')
        : ''
    : null

  const isError = resultBlock?.is_error

  return (
    <div
      className="rounded-lg overflow-hidden mb-2"
      style={{
        background: 'var(--color-bg)',
        border: `1px solid ${isError ? '#EF444430' : 'var(--color-border)'}`,
      }}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left transition-all"
        style={{ background: isError ? 'rgba(239,68,68,0.06)' : 'rgba(255,255,255,0.02)' }}
      >
        <Wrench size={11} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{icon}</span>
        <code
          className="text-xs font-semibold flex-1 truncate"
          style={{ color: isError ? '#FCA5A5' : '#93C5FD', fontFamily: 'JetBrains Mono, monospace' }}
        >
          {block.name}
        </code>
        {resultBlock && (
          <span
            className="text-xs px-1.5 py-0.5 rounded"
            style={{
              background: isError ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)',
              color: isError ? '#EF4444' : '#10B981',
            }}
          >
            {isError ? 'Error' : 'Done'}
          </span>
        )}
        {!resultBlock && (
          <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(245,158,11,0.12)', color: '#F59E0B' }}>
            Running...
          </span>
        )}
        {expanded ? (
          <ChevronDown size={12} style={{ color: 'var(--color-text-muted)' }} />
        ) : (
          <ChevronRight size={12} style={{ color: 'var(--color-text-muted)' }} />
        )}
      </button>

      {/* Expanded: input + output */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--color-border)' }}>
          {/* Input */}
          <div className="px-3 py-2">
            <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Input</p>
            <pre
              className="text-xs overflow-x-auto rounded p-2"
              style={{
                background: '#060B16',
                color: '#C7D2FE',
                fontFamily: 'JetBrains Mono, monospace',
                maxHeight: '200px',
              }}
            >
              {JSON.stringify(block.input, null, 2)}
            </pre>
          </div>

          {/* Output */}
          {resultText !== null && (
            <div className="px-3 pb-2" style={{ borderTop: '1px solid var(--color-border)' }}>
              <p className="text-xs font-medium mt-2 mb-1" style={{ color: 'var(--color-text-muted)' }}>Output</p>
              <pre
                className="text-xs overflow-x-auto rounded p-2"
                style={{
                  background: '#060B16',
                  color: isError ? '#FCA5A5' : '#BBF7D0',
                  fontFamily: 'JetBrains Mono, monospace',
                  maxHeight: '300px',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {resultText.length > 2000 ? resultText.slice(0, 2000) + '\n… (truncated)' : resultText}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
