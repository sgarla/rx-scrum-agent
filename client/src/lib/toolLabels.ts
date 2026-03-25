/**
 * Maps claude-agent-sdk tool names and their inputs to human-readable labels
 * shown in the live execution step tracker.
 */

export function toolLabel(
  name: string,
  input: Record<string, unknown>
): { label: string; detail?: string } {
  // Databricks MCP tools use double-underscore namespace prefix
  const bare = name.includes('__') ? name.split('__').slice(1).join('__') : name

  switch (bare) {
    // ── Skills ──────────────────────────────────────────────────────────────
    case 'invoke_skill':
    case 'list_skills': {
      const skillName = str(input.skill_name ?? input.name)
      return skillName
        ? { label: 'Load skill', detail: skillName }
        : { label: 'Load skill' }
    }

    // ── Notebooks / Files ────────────────────────────────────────────────────
    case 'create_notebook':
    case 'upload_notebook': {
      return { label: 'Create notebook', detail: shortPath(str(input.path ?? input.notebook_path)) }
    }
    case 'upload_file': {
      return { label: 'Upload file', detail: shortPath(str(input.path ?? input.remote_path)) }
    }
    case 'run_notebook':
    case 'run_python_file_on_databricks': {
      return { label: 'Run notebook', detail: shortPath(str(input.path ?? input.notebook_path)) }
    }
    case 'execute_databricks_command': {
      const lang = str(input.language ?? 'code')
      return { label: `Run ${lang}`, detail: snippet(str(input.command ?? input.code)) }
    }

    // ── SQL ──────────────────────────────────────────────────────────────────
    case 'execute_sql':
    case 'run_sql': {
      return { label: 'Run SQL', detail: snippet(str(input.query ?? input.sql)) }
    }

    // ── Pipelines ────────────────────────────────────────────────────────────
    case 'create_pipeline':
    case 'create_or_update_pipeline':
    case 'update_pipeline': {
      return { label: 'Create pipeline', detail: str(input.name ?? input.pipeline_name) }
    }
    case 'run_pipeline':
    case 'start_pipeline': {
      return { label: 'Run pipeline', detail: str(input.name ?? input.pipeline_name ?? input.pipeline_id) }
    }
    case 'get_pipeline_status': {
      return { label: 'Check pipeline status', detail: str(input.pipeline_id ?? input.name) }
    }

    // ── Clusters / Jobs ───────────────────────────────────────────────────────
    case 'create_cluster': {
      return { label: 'Create cluster', detail: str(input.cluster_name ?? input.name) }
    }
    case 'get_cluster':
    case 'wait_for_cluster': {
      return { label: 'Wait for cluster', detail: str(input.cluster_id ?? input.cluster_name) }
    }
    case 'create_job': {
      return { label: 'Create job', detail: str(input.name ?? input.job_name) }
    }
    case 'run_job':
    case 'run_now': {
      return { label: 'Run job', detail: str(input.job_id ?? input.name) }
    }

    // ── Model Serving ─────────────────────────────────────────────────────────
    case 'create_serving_endpoint':
    case 'create_or_update_serving_endpoint': {
      return { label: 'Deploy model endpoint', detail: str(input.name) }
    }
    case 'query_serving_endpoint': {
      return { label: 'Test model endpoint', detail: str(input.name ?? input.endpoint_name) }
    }

    // ── Dashboards ────────────────────────────────────────────────────────────
    case 'create_dashboard':
    case 'import_dashboard': {
      return { label: 'Create dashboard', detail: str(input.display_name ?? input.name) }
    }
    case 'publish_dashboard': {
      return { label: 'Publish dashboard', detail: str(input.dashboard_id ?? input.name) }
    }
    case 'get_dashboard': {
      return { label: 'Load dashboard', detail: str(input.dashboard_id ?? input.name) }
    }

    // ── Unity Catalog / Grants ────────────────────────────────────────────────
    case 'manage_uc_grants':
    case 'grant_permissions': {
      return { label: 'Grant permissions', detail: str(input.securable_full_name ?? input.name) }
    }
    case 'create_catalog': {
      return { label: 'Create catalog', detail: str(input.name) }
    }
    case 'create_schema': {
      return { label: 'Create schema', detail: str(input.full_name ?? input.name) }
    }
    case 'create_table': {
      return { label: 'Create table', detail: str(input.full_name ?? input.table_name ?? input.name) }
    }

    // ── Volumes / Storage ─────────────────────────────────────────────────────
    case 'create_volume': {
      return { label: 'Create volume', detail: str(input.full_name ?? input.name) }
    }
    case 'upload_to_volume': {
      return { label: 'Upload to volume', detail: shortPath(str(input.path ?? input.file_path)) }
    }

    // ── Vector Search ─────────────────────────────────────────────────────────
    case 'create_vector_search_index':
    case 'create_index': {
      return { label: 'Create vector index', detail: str(input.index_name ?? input.name) }
    }
    case 'query_vector_index':
    case 'similarity_search': {
      return { label: 'Query vector index', detail: str(input.index_name ?? input.name) }
    }

    // ── Local file tools ──────────────────────────────────────────────────────
    case 'Read': {
      return { label: 'Read file', detail: shortPath(str(input.file_path ?? input.path)) }
    }
    case 'Write': {
      return { label: 'Write file', detail: shortPath(str(input.file_path ?? input.path)) }
    }
    case 'Edit': {
      return { label: 'Edit file', detail: shortPath(str(input.file_path ?? input.path)) }
    }
    case 'Glob': {
      return { label: 'Search files', detail: str(input.pattern) }
    }
    case 'Grep': {
      return { label: 'Search code', detail: str(input.pattern) }
    }
    case 'Bash': {
      return { label: 'Run command', detail: snippet(str(input.command)) }
    }

    default: {
      // Prettify raw tool name: strip namespace, replace _ with spaces, capitalize
      const pretty = bare
        .replace(/__/g, ' ')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase())
      return { label: pretty }
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function str(v: unknown): string {
  if (v === undefined || v === null) return ''
  return String(v)
}

/** Return the last 2 path segments for display */
function shortPath(p: string): string {
  if (!p) return ''
  const parts = p.replace(/\\/g, '/').split('/').filter(Boolean)
  return parts.length > 2 ? '…/' + parts.slice(-2).join('/') : p
}

/** Return the first N chars of a multiline string, single-lined */
function snippet(s: string, max = 50): string {
  if (!s) return ''
  const oneLine = s.replace(/\s+/g, ' ').trim()
  return oneLine.length > max ? oneLine.slice(0, max) + '…' : oneLine
}
