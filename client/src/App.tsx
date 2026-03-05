import { useEffect, useState } from 'react'
import { Toaster, toast } from 'sonner'
import { Sparkles, LayoutDashboard } from 'lucide-react'
import { AssetsPanel } from './components/AssetsPanel/AssetsPanel'
import { ChatPanel } from './components/ChatPanel/ChatPanel'
import { GeniePanel } from './components/GeniePanel/GeniePanel'
import { Header } from './components/layout/Header'
import { StoryPanel } from './components/StoryPanel/StoryPanel'
import { useAssets } from './hooks/useAssets'
import { useConversation } from './hooks/useConversation'
import { useStories } from './hooks/useStories'
import { fetchHealth, updateStoryStatus } from './lib/api'
import type { JiraStory } from './lib/types'

type AppTab = 'board' | 'genie'

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('board')
  const [activeStoryKey, setActiveStoryKey] = useState<string | null>(null)
  const [activeStory, setActiveStory] = useState<JiraStory | null>(null)
  const [workspaceUrl, setWorkspaceUrl] = useState<string | undefined>()

  const { stories, loading, filters, updateFilter, assignees, sprints, reload: reloadStories } = useStories()
  const { messages, isBuilding, conversationLoading, conversation, startBuild, sendMessage, stop, error } = useConversation(activeStoryKey)
  const { sessions, loading: assetsLoading, reload: reloadAssets } = useAssets(conversation?.id ?? null, activeStoryKey, isBuilding)

  useEffect(() => {
    fetchHealth()
      .then(h => setWorkspaceUrl(h.workspace_url || undefined))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!activeStoryKey) { setActiveStory(null); return }
    const s = stories.find(s => s.key === activeStoryKey) ?? null
    setActiveStory(s)
  }, [activeStoryKey, stories])

  useEffect(() => {
    if (error) toast.error(error)
  }, [error])

  const handleStorySelect = (key: string) => {
    setActiveStoryKey(key)
    setActiveTab('board')
  }

  const handleStartBuild = async () => {
    if (!activeStoryKey) return
    await startBuild(activeStoryKey, undefined, 'agent')
    setTimeout(reloadStories, 1000)
  }

  const handleStatusToggle = async (key: string) => {
    const story = stories.find(s => s.key === key)
    if (!story || story.status === 'building') return
    const next = story.status === 'done' ? 'todo' : 'done'
    try {
      await updateStoryStatus(key, next)
      reloadStories()
    } catch (err) {
      toast.error('Failed to update status')
    }
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Toaster
        position="top-right"
        theme="dark"
        toastOptions={{
          style: {
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-primary)',
          },
        }}
      />

      <Header
        activeSprint={filters.sprint}
        onSprintChange={sprint => updateFilter({ sprint })}
        activeAssignee={filters.assignee}
        onAssigneeChange={assignee => updateFilter({ assignee })}
        sprints={sprints}
        assignees={assignees}
      />

      {/* Tab bar */}
      <div
        className="shrink-0 flex items-center gap-1 px-3 py-2"
        style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)' }}
      >
        <button
          onClick={() => setActiveTab('board')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
          style={activeTab === 'board' ? {
            background: 'var(--color-accent)',
            color: 'white',
          } : {
            color: 'var(--color-text-secondary)',
          }}
        >
          <LayoutDashboard size={13} />
          Story Board
        </button>
        <button
          onClick={() => setActiveTab('genie')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
          style={activeTab === 'genie' ? {
            background: 'rgba(99,102,241,0.2)',
            color: '#818CF8',
          } : {
            color: 'var(--color-text-secondary)',
          }}
        >
          <Sparkles size={13} />
          Genie
        </button>
      </div>

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel — always visible */}
        <StoryPanel
          stories={stories}
          loading={loading}
          filters={filters}
          onFilterChange={updateFilter}
          activeStoryKey={activeStoryKey}
          onStorySelect={handleStorySelect}
          onStatusToggle={handleStatusToggle}
        />

        {activeTab === 'board' ? (
          <>
            <ChatPanel
              story={activeStory}
              messages={messages}
              isBuilding={isBuilding}
              conversationLoading={conversationLoading}
              error={error}
              onStartBuild={handleStartBuild}
              onSendMessage={(text, mode) => sendMessage(text, mode)}
              onStop={stop}
            />
            <AssetsPanel
              story={activeStory}
              sessions={sessions}
              loading={assetsLoading}
              isBuilding={isBuilding}
              workspaceUrl={workspaceUrl}
              onRefresh={reloadAssets}
            />
          </>
        ) : (
          <GeniePanel />
        )}
      </div>
    </div>
  )
}
