import { ExternalLink } from 'lucide-react'
import type { Asset } from '../../lib/types'

const ASSET_ICONS: Record<string, string> = {
  pipeline: '🔁',
  table: '📋',
  dashboard: '📊',
  endpoint: '🤖',
  job: '⏰',
  schema: '🗄️',
  notebook: '📓',
  index: '🔍',
  volume: '📦',
  model: '🧠',
}

const ASSET_COLORS: Record<string, string> = {
  pipeline: '#3B82F6',
  table: '#14B8A6',
  dashboard: '#8B5CF6',
  endpoint: '#F97316',
  job: '#6366F1',
  schema: '#6B7280',
  notebook: '#F59E0B',
  index: '#EC4899',
  volume: '#64748B',
  model: '#10B981',
}

interface Props {
  asset: Asset
}

export function AssetCard({ asset }: Props) {
  const icon = ASSET_ICONS[asset.asset_type] ?? '📦'
  const color = ASSET_COLORS[asset.asset_type] ?? '#6B7280'

  // Build the location label: prefer full_path, then catalog.schema, then name
  const locationLabel = asset.full_path
    ?? (asset.catalog && asset.schema_name ? `${asset.catalog}.${asset.schema_name}` : null)

  return (
    <div
      className="flex items-start gap-2.5 p-2.5 rounded-lg transition-all"
      style={{
        background: 'var(--color-bg)',
        border: '1px solid var(--color-border)',
        marginBottom: '6px',
      }}
    >
      {/* Icon */}
      <div
        className="shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-sm"
        style={{ background: `${color}18` }}
      >
        {icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-0">
            <p
              className="text-xs font-medium truncate leading-tight"
              style={{ color: 'var(--color-text-primary)' }}
            >
              {asset.name}
            </p>
            {locationLabel && (
              <p
                className="text-xs font-mono mt-0.5 truncate"
                style={{ color: color, opacity: 0.8, fontSize: '10px' }}
              >
                {locationLabel}
              </p>
            )}
            {asset.description && (
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)', lineHeight: '1.3' }}>
                {asset.description.slice(0, 80)}{asset.description.length > 80 && '…'}
              </p>
            )}
          </div>

          {asset.url && (
            <a
              href={asset.url}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 flex items-center gap-0.5 text-xs transition-all mt-0.5"
              style={{ color: '#60A5FA' }}
              title="Open in workspace"
            >
              <ExternalLink size={11} />
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
