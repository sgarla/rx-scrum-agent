import type { Asset, AssetSession, Conversation, JiraStory, StoredMessage, StoryFilters } from './types'

const BASE = '/api'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`API ${res.status}: ${body}`)
  }
  return res.json()
}

// Stories
export async function fetchStories(filters?: Partial<StoryFilters>): Promise<JiraStory[]> {
  const params = new URLSearchParams()
  if (filters?.status && filters.status !== 'all') params.set('status', filters.status)
  if (filters?.assignee) params.set('assignee', filters.assignee)
  if (filters?.search) params.set('search', filters.search)
  if (filters?.sprint) params.set('sprint', filters.sprint)
  const qs = params.toString()
  const data = await request<{ stories: JiraStory[] } | JiraStory[]>(`/stories${qs ? '?' + qs : ''}`)
  return Array.isArray(data) ? data : data.stories
}

export async function fetchStory(key: string): Promise<JiraStory> {
  return request<JiraStory>(`/stories/${key}`)
}

// Conversations
export async function createConversation(story_key: string): Promise<Conversation> {
  return request<Conversation>('/conversations', {
    method: 'POST',
    body: JSON.stringify({ story_key }),
  })
}

export async function fetchConversationStatus(conversation_id: string): Promise<Conversation> {
  return request<Conversation>(`/conversations/${conversation_id}/status`)
}

export async function fetchConversationsByStory(story_key: string): Promise<Conversation[]> {
  const data = await request<{ conversations: Conversation[] }>(
    `/conversations?story_key=${encodeURIComponent(story_key)}`
  )
  return data.conversations
}

export async function fetchConversationFull(
  id: string
): Promise<Conversation & { messages: StoredMessage[] }> {
  return request(`/conversations/${id}`)
}

// Agent
export interface InvokeAgentResponse {
  execution_id: string
  conversation_id: string
  message: string
}

export async function invokeAgent(
  conversation_id: string,
  _story_key: string,
  message: string
): Promise<InvokeAgentResponse> {
  return request<InvokeAgentResponse>('/invoke_agent', {
    method: 'POST',
    body: JSON.stringify({ conversation_id, message }),
  })
}

export async function stopAgent(execution_id: string): Promise<{ status: string }> {
  return request<{ status: string }>(`/stop/${execution_id}`, { method: 'POST' })
}

// Assets — always fetch story-level (all sessions)
export async function fetchStoryAssets(story_key: string): Promise<{ assets: Asset[]; session_count: number }> {
  return request<{ assets: Asset[]; session_count: number; story_key: string }>(`/stories/${story_key}/assets`)
}

/** Group flat asset list into chronological sessions */
export function groupAssetsBySessions(assets: Asset[]): AssetSession[] {
  const map = new Map<number, { session_created_at: string | null; assets: Asset[] }>()
  for (const a of assets) {
    const n = a.session_number ?? 1
    if (!map.has(n)) map.set(n, { session_created_at: a.session_created_at ?? null, assets: [] })
    map.get(n)!.assets.push(a)
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a - b)
    .map(([session_number, { session_created_at, assets }]) => ({ session_number, session_created_at, assets }))
}

export async function fetchAllAssets(): Promise<Record<string, Asset[]>> {
  return request<Record<string, Asset[]>>('/assets')
}

// Health
export async function fetchHealth(): Promise<{ status: string; workspace_url: string; databricks_configured: boolean }> {
  return request('/health')
}

// Genie
export interface GenieStatusResponse {
  configured: boolean
  space_id: string | null
  host: string | null
}

export interface GenieAskResponse {
  conversation_id: string
  message_id: string
  answer: string
  sql: string | null
}

export async function fetchGenieStatus(): Promise<GenieStatusResponse> {
  return request<GenieStatusResponse>('/genie/status')
}

export async function askGenie(message: string, conversation_id?: string): Promise<GenieAskResponse> {
  return request<GenieAskResponse>('/genie/ask', {
    method: 'POST',
    body: JSON.stringify({ message, conversation_id: conversation_id ?? null }),
  })
}

export async function triggerGenieSync(): Promise<{ status: string; message: string }> {
  return request('/genie/sync', { method: 'POST' })
}
