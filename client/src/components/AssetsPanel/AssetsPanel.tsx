import { Box, ExternalLink, Layers, RefreshCw } from 'lucide-react'
import type { AssetSession, JiraStory } from '../../lib/types'
import { AssetCard } from './AssetCard'

interface Props {
  story: JiraStory | null
  sessions: AssetSession[]
  loading: boolean
  isBuilding: boolean
  workspaceUrl?: string
  onRefresh: () => void
}

function formatSessionDate(iso: string | null): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

export function AssetsPanel({ story, sessions, loading, isBuilding, workspaceUrl, onRefresh }: Props) {
  const totalAssets = sessions.reduce((sum, s) => sum + s.assets.length, 0)

  return (
    <div className="panel" style={{ width: '300px', minWidth: '260px', maxWidth: '340px' }}>
      {/* Header */}
      <div className="panel-header justify-between">
        <div className="flex items-center gap-2">
          <Layers size={14} style={{ color: 'var(--color-text-muted)' }} />
          <span className="text-sm font-semibold text-white">Databricks Assets</span>
          {totalAssets > 0 && (
            <span
              className="text-xs px-1.5 py-0.5 rounded-full font-medium"
              style={{ background: 'rgba(16,185,129,0.12)', color: '#10B981' }}
            >
              {totalAssets}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isBuilding && (
            <div className="flex items-center gap-1.5">
              <div className="building-dot" />
              <span className="text-xs" style={{ color: '#F59E0B' }}>Building</span>
            </div>
          )}
          <button
            onClick={onRefresh}
            className="p-1 rounded transition-all"
            style={{ color: 'var(--color-text-muted)' }}
            title="Refresh assets"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Story context */}
      {story && (
        <div
          className="shrink-0 px-3 py-2 text-xs"
          style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}
        >
          <span className="font-mono text-xs px-1.5 py-0.5 rounded mr-2"
            style={{ background: 'var(--color-bg)', color: 'var(--color-accent)' }}
          >
            {story.key}
          </span>
          <span>{story.summary.slice(0, 50)}{story.summary.length > 50 && '…'}</span>
        </div>
      )}

      {/* Assets — grouped by session */}
      <div className="panel-body p-3">
        {sessions.length === 0 ? (
          <EmptyState isBuilding={isBuilding} hasStory={!!story} />
        ) : (
          <div>
            {sessions.map(session => (
              <div key={session.session_number} className="mb-5">
                {/* Session header */}
                <div
                  className="flex items-center gap-2 mb-2 pb-1"
                  style={{ borderBottom: '1px solid var(--color-border)' }}
                >
                  <span
                    className="text-xs font-semibold px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(99,102,241,0.15)', color: '#818CF8' }}
                  >
                    Session {session.session_number}
                  </span>
                  {session.session_created_at && (
                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {formatSessionDate(session.session_created_at)}
                    </span>
                  )}
                  <span className="text-xs ml-auto" style={{ color: 'var(--color-text-muted)' }}>
                    {session.assets.length} asset{session.assets.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Assets in this session */}
                {session.assets.map(asset => (
                  <AssetCard key={asset.id} asset={asset} />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer: workspace link */}
      {workspaceUrl && (
        <div className="shrink-0 p-3" style={{ borderTop: '1px solid var(--color-border)' }}>
          <a
            href={workspaceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg text-xs font-medium transition-all"
            style={{
              background: 'var(--color-surface-2)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-secondary)',
            }}
          >
            <ExternalLink size={12} />
            Open Databricks Workspace
          </a>
        </div>
      )}
    </div>
  )
}

function EmptyState({ isBuilding, hasStory }: { isBuilding: boolean; hasStory: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <Box size={32} style={{ color: 'var(--color-text-muted)', opacity: 0.3 }} />
      <div className="text-center">
        {isBuilding ? (
          <>
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              Creating assets...
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
              Assets will appear here as the agent builds them
            </p>
          </>
        ) : hasStory ? (
          <>
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              No assets yet
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
              Start building to see Databricks assets here
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              Select a story
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
              Assets will appear once a story is selected and built
            </p>
          </>
        )}
      </div>
    </div>
  )
}
