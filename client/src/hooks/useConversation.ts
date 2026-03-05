import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createConversation,
  fetchConversationFull,
  fetchConversationsByStory,
  fetchConversationStatus,
  invokeAgent,
  stopAgent,
} from '../lib/api'
import type {
  ChatMessage,
  ContentBlock,
  Conversation,
  SSEAssistantMessageEvent,
  SSEEvent,
} from '../lib/types'

interface UseConversationReturn {
  conversation: Conversation | null
  messages: ChatMessage[]
  isBuilding: boolean
  conversationLoading: boolean
  currentExecutionId: string | null
  startBuild: (storyKey: string, message?: string) => Promise<void>
  sendMessage: (text: string) => Promise<void>
  stop: () => Promise<void>
  error: string | null
}

export function useConversation(storyKey: string | null): UseConversationReturn {
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isBuilding, setIsBuilding] = useState(false)
  const [conversationLoading, setConversationLoading] = useState(false)
  const [currentExecutionId, setCurrentExecutionId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const sseRef = useRef<EventSource | null>(null)
  const executionRef = useRef<string | null>(null)

  // Load (or reset) conversation when story changes
  useEffect(() => {
    // Reset current state immediately
    setConversation(null)
    setMessages([])
    setIsBuilding(false)
    setCurrentExecutionId(null)
    setError(null)
    executionRef.current = null
    if (sseRef.current) {
      sseRef.current.close()
      sseRef.current = null
    }

    if (!storyKey) return

    setConversationLoading(true)

    // Attempt to load an existing conversation from the DB
    fetchConversationsByStory(storyKey)
      .then(convs => {
        if (convs.length === 0) return

        const conv = convs[0]
        setConversation(conv)

        // Load full message history, then check live status for active SSE.
        // The list/full endpoints never include execution_id — only the status
        // endpoint returns it when an execution is actively running in stream_manager.
        return fetchConversationFull(conv.id)
          .then(full => {
            const msgs: ChatMessage[] = (full.messages ?? [])
              .filter(m => m.message_type === 'text')
              .map(m => ({
                id: m.id,
                role: m.role as 'user' | 'assistant',
                text: m.content,
                timestamp: new Date(m.created_at),
              }))
            setMessages(msgs)

            return fetchConversationStatus(conv.id)
          })
          .then(status => {
            if (status.status === 'building' && status.execution_id) {
              setIsBuilding(true)
              setCurrentExecutionId(status.execution_id)
              executionRef.current = status.execution_id
              streamExecution(status.execution_id)
            }
          })
      })
      .catch(() => {})
      .finally(() => setConversationLoading(false))
  }, [storyKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const addMessage = useCallback((msg: ChatMessage) => {
    setMessages(prev => [...prev, msg])
  }, [])

  const updateLastMessage = useCallback((updater: (msg: ChatMessage) => ChatMessage) => {
    setMessages(prev => {
      if (prev.length === 0) return prev
      const last = prev[prev.length - 1]
      return [...prev.slice(0, -1), updater(last)]
    })
  }, [])

  const streamExecution = useCallback(
    (executionId: string, eventIndex = 0) => {
      if (sseRef.current) {
        sseRef.current.close()
      }

      const url = `/api/stream_progress/${executionId}?last_event_index=${eventIndex}`
      const es = new EventSource(url)
      sseRef.current = es

      let pendingBlocks: ContentBlock[] = []
      let streamingMsgId: string | null = null
      let seenEventCount = eventIndex

      const flushPending = () => {
        if (pendingBlocks.length === 0) return
        const blocks = [...pendingBlocks]
        pendingBlocks = []

        if (streamingMsgId) {
          updateLastMessage(msg =>
            msg.id === streamingMsgId
              ? { ...msg, blocks: [...(msg.blocks ?? []), ...blocks], isStreaming: true }
              : msg
          )
        } else {
          streamingMsgId = `stream-${Date.now()}`
          addMessage({
            id: streamingMsgId,
            role: 'assistant',
            blocks,
            timestamp: new Date(),
            isStreaming: true,
          })
        }
      }

      es.onmessage = (e) => {
        let event: SSEEvent
        try {
          event = JSON.parse(e.data)
        } catch {
          return
        }

        if (event.type !== 'done' && event.type !== 'reconnect' && event.type !== 'error') {
          seenEventCount++
        }

        if (event.type === 'assistant_message') {
          const ev = event as SSEAssistantMessageEvent
          pendingBlocks.push(...ev.blocks)
          flushPending()
        } else if (event.type === 'result') {
          if (streamingMsgId) {
            updateLastMessage(msg =>
              msg.id === streamingMsgId ? { ...msg, isStreaming: false } : msg
            )
            streamingMsgId = null
          }
          setConversation(prev =>
            prev ? { ...prev, session_id: (event as { session_id: string }).session_id } : prev
          )
        } else if (event.type === 'done') {
          es.close()
          sseRef.current = null
          setIsBuilding(false)
          setCurrentExecutionId(null)
          executionRef.current = null
          if (streamingMsgId) {
            updateLastMessage(msg =>
              msg.id === streamingMsgId ? { ...msg, isStreaming: false } : msg
            )
          }
          // Refresh conversation status after done
          setConversation(prev => {
            if (!prev) return prev
            fetchConversationStatus(prev.id)
              .then(updated => setConversation(updated))
              .catch(() => {})
            return prev
          })
        } else if (event.type === 'reconnect') {
          const idx = (event as { event_index: number }).event_index
          seenEventCount = idx
          es.close()
          sseRef.current = null
          streamExecution(executionId, idx)
        } else if (event.type === 'error') {
          setError((event as { message: string }).message)
          es.close()
          sseRef.current = null
          setIsBuilding(false)
        }
      }

      es.onerror = () => {
        es.close()
        sseRef.current = null
        if (executionRef.current === executionId) {
          const resumeIdx = seenEventCount
          setTimeout(() => {
            if (executionRef.current === executionId) {
              streamExecution(executionId, resumeIdx)
            }
          }, 2000)
        }
      }
    },
    [addMessage, updateLastMessage]
  )

  const ensureConversation = useCallback(async (storyKey: string): Promise<Conversation> => {
    if (conversation) return conversation
    const conv = await createConversation(storyKey)
    setConversation(conv)
    return conv
  }, [conversation])

  const startBuild = useCallback(async (sk: string, message?: string) => {
    if (!sk) return
    setError(null)
    setIsBuilding(true)

    try {
      const conv = await ensureConversation(sk)
      const userMsg = message || 'Build this user story end-to-end. Implement all acceptance criteria.'

      addMessage({
        id: `user-${Date.now()}`,
        role: 'user',
        text: userMsg,
        timestamp: new Date(),
      })

      const { execution_id } = await invokeAgent(conv.id, sk, userMsg)
      setCurrentExecutionId(execution_id)
      executionRef.current = execution_id
      streamExecution(execution_id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start build')
      setIsBuilding(false)
    }
  }, [ensureConversation, addMessage, streamExecution])

  const sendMessage = useCallback(async (text: string) => {
    if (!storyKey || !text.trim()) return
    setError(null)
    setIsBuilding(true)

    try {
      const conv = await ensureConversation(storyKey)

      addMessage({
        id: `user-${Date.now()}`,
        role: 'user',
        text,
        timestamp: new Date(),
      })

      const { execution_id } = await invokeAgent(conv.id, storyKey, text)
      setCurrentExecutionId(execution_id)
      executionRef.current = execution_id
      streamExecution(execution_id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message')
      setIsBuilding(false)
    }
  }, [storyKey, ensureConversation, addMessage, streamExecution])

  const stop = useCallback(async () => {
    if (!currentExecutionId) return
    try {
      await stopAgent(currentExecutionId)
    } catch {}
    if (sseRef.current) {
      sseRef.current.close()
      sseRef.current = null
    }
    executionRef.current = null
    setIsBuilding(false)
    setCurrentExecutionId(null)
  }, [currentExecutionId])

  return {
    conversation,
    messages,
    isBuilding,
    conversationLoading,
    currentExecutionId,
    startBuild,
    sendMessage,
    stop,
    error,
  }
}
