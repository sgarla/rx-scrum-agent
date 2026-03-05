export interface JiraStory {
  key: string
  summary: string
  description: string
  acceptance_criteria: string[]
  story_points: number
  priority: 'Critical' | 'High' | 'Medium' | 'Low'
  assignee: string
  labels: string[]
  type: 'data_pipeline' | 'dashboard' | 'ml_model' | 'synthetic_data' | 'ai_agent' | 'job' | 'generic'
  skill_hint: string
  status: 'todo' | 'building' | 'done'
  sprint: string
}

export interface Conversation {
  id: string
  story_key: string
  status: 'idle' | 'building' | 'done'
  session_id: string | null
  created_at: string
  updated_at: string
  message_count: number
  execution_id?: string   // present when status === 'building' (active SSE stream)
}

export interface StoredMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  message_type: 'text' | 'tool_use' | 'tool_result' | 'thinking' | 'summary'
  created_at: string
}

export interface Asset {
  id: string
  conversation_id: string
  story_key: string
  asset_type: 'pipeline' | 'table' | 'dashboard' | 'endpoint' | 'job' | 'schema' | 'notebook' | 'index' | 'volume' | 'model'
  name: string
  url: string | null
  description: string | null
  catalog: string | null
  schema_name: string | null
  full_path: string | null
  created_at: string
  // session grouping (returned by /stories/{key}/assets)
  session_number?: number
  session_created_at?: string | null
}

export interface AssetSession {
  session_number: number
  session_created_at: string | null
  assets: Asset[]
}

export interface TextBlock {
  type: 'text'
  text: string
}

export interface ThinkingBlock {
  type: 'thinking'
  thinking: string
}

export interface ToolUseBlock {
  type: 'tool_use'
  id: string
  name: string
  input: Record<string, unknown>
}

export interface ToolResultBlock {
  type: 'tool_result'
  tool_use_id: string
  content: string | Array<{ type: string; text: string }>
  is_error: boolean
}

export type ContentBlock = TextBlock | ThinkingBlock | ToolUseBlock | ToolResultBlock

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  blocks?: ContentBlock[]
  text?: string
  timestamp: Date
  isStreaming?: boolean
}

// SSE event types
export interface SSEDoneEvent {
  type: 'done'
}

export interface SSEReconnectEvent {
  type: 'reconnect'
  event_index: number
}

export interface SSEErrorEvent {
  type: 'error'
  message: string
}

export interface SSEAssistantMessageEvent {
  type: 'assistant_message'
  blocks: ContentBlock[]
}

export interface SSEResultEvent {
  type: 'result'
  session_id: string | null
  stop_reason: string | null
}

export type SSEEvent =
  | SSEDoneEvent
  | SSEReconnectEvent
  | SSEErrorEvent
  | SSEAssistantMessageEvent
  | SSEResultEvent

export interface StoryFilters {
  status: 'all' | 'todo' | 'building' | 'done'
  assignee: string | null
  search: string
  sprint: string
}

// Genie
export interface GenieMessage {
  id: string
  role: 'user' | 'genie'
  content: string
  sql?: string | null
  timestamp: Date
}
