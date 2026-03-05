import { useEffect, useState } from 'react'
import { Toaster, toast } from 'sonner'
import { AlertTriangle, LayoutDashboard, Sparkles } from 'lucide-react'
import { AssetsPanel } from './components/AssetsPanel/AssetsPanel'
import { ChatPanel } from './components/ChatPanel/ChatPanel'
import { GeniePanel } from './components/GeniePanel/GeniePanel'
import { Header } from './components/layout/Header'
import { IncidentChatPanel } from './components/IncidentPanel/IncidentChatPanel'
import { IncidentPanel } from './components/IncidentPanel/IncidentPanel'
import { SettingsModal } from './components/Settings/SettingsModal'
import { StoryPanel } from './components/StoryPanel/StoryPanel'
import { useAssets } from './hooks/useAssets'
import { useConversation } from './hooks/useConversation'
import { useIncidents } from './hooks/useIncidents'
import { useStories } from './hooks/useStories'
import { fetchHealth, fetchSettings, reparseStoryAssets, updateStoryStatus } from './lib/api'
import type { JiraStory, ServiceNowIncident } from './lib/types'

type AppTab = 'board' | 'incidents' | 'genie'

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('board')

  // Story board state
  const [activeStoryKey, setActiveStoryKey] = useState<string | null>(null)
  const [activeStory, setActiveStory] = useState<JiraStory | null>(null)

  // Incidents state
  const [activeIncidentNumber, setActiveIncidentNumber] = useState<string | null>(null)
  const [activeIncident, setActiveIncident] = useState<ServiceNowIncident | null>(null)

  // Settings modal
  const [settingsOpen, setSettingsOpen] = useState(false)

  const [workspaceUrl, setWorkspaceUrl] = useState<string | undefined>()
  const [snowInstance, setSnowInstance] = useState<string | undefined>()

  // Story board hooks
  const { stories, loading, filters, updateFilter, assignees, sprints, reload: reloadStories } = useStories()
  const { messages: storyMessages, isBuilding: storyBuilding, conversationLoading: storyConvLoading, conversation: storyConv, startBuild, sendMessage: storySend, stop: storyStop, error: storyError } = useConversation(activeStoryKey)
  const { sessions, loading: assetsLoading, reload: reloadAssets } = useAssets(storyConv?.id ?? null, activeStoryKey, storyBuilding)

  // Incidents hooks
  const { incidents, loading: incLoading, configured: incConfigured, error: incError, filters: incFilters, updateFilter: updateIncFilter, reload: reloadIncidents } = useIncidents()
  // Conversation keyed by incident number (reuses same backend — story_key column accepts incident numbers)
  const { messages: incMessages, isBuilding: incBuilding, conversationLoading: incConvLoading, conversation: incConv, startBuild: incStartBuild, sendMessage: incSend, stop: incStop, error: incError2 } = useConversation(activeIncidentNumber)
  const { sessions: incSessions, loading: incAssetsLoading, reload: reloadIncAssets } = useAssets(incConv?.id ?? null, activeIncidentNumber, incBuilding)

  // Fetch workspace info + ServiceNow instance once
  useEffect(() => {
    fetchHealth()
      .then(h => setWorkspaceUrl(h.workspace_url || undefined))
      .catch(() => {})
    fetchSettings()
      .then(s => setSnowInstance(s.snow_instance || undefined))
      .catch(() => {})
  }, [])

  // Track active story object
  useEffect(() => {
    if (!activeStoryKey) { setActiveStory(null); return }
    const s = stories.find(s => s.key === activeStoryKey) ?? null
    setActiveStory(s)
  }, [activeStoryKey, stories])

  // Track active incident object
  useEffect(() => {
    if (!activeIncidentNumber) { setActiveIncident(null); return }
    const inc = incidents.find(i => i.number === activeIncidentNumber) ?? null
    setActiveIncident(inc)
  }, [activeIncidentNumber, incidents])

  // Toast errors
  useEffect(() => { if (storyError) toast.error(storyError) }, [storyError])
  useEffect(() => { if (incError2) toast.error(incError2) }, [incError2])

  // Story board handlers
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
    } catch {
      toast.error('Failed to update status')
    }
  }

  const handleRefreshAssets = async () => {
    if (activeStoryKey && sessions.length === 0) {
      try { await reparseStoryAssets(activeStoryKey) } catch {}
    }
    reloadAssets()
  }

  // Incident handlers
  const handleIncidentSelect = (number: string) => {
    setActiveIncidentNumber(number)
  }

  const handleStartInvestigation = async () => {
    if (!activeIncidentNumber || !activeIncident) return
    const prompt = `Investigate this ServiceNow incident:

Number: ${activeIncident.number}
Summary: ${activeIncident.short_description}
State: ${activeIncident.state} | Priority: ${activeIncident.priority}
Category: ${activeIncident.category}${activeIncident.cmdb_ci ? ` | Affected CI: ${activeIncident.cmdb_ci}` : ''}${activeIncident.assigned_to ? ` | Assigned to: ${activeIncident.assigned_to}` : ''}

Description:
${activeIncident.description || 'No description provided.'}

Please investigate this incident by:
1. Analyzing the affected Databricks resources (pipelines, jobs, tables, clusters) based on the CI and description.
2. Checking recent run history, error logs, and resource health using available Databricks tools.
3. Identifying the root cause.
4. Recommending remediation steps.
5. Summarizing any assets you inspected in the <assets_summary> block.`

    await incStartBuild(activeIncidentNumber, prompt, 'agent')
  }

  const handleRefreshIncAssets = async () => {
    if (activeIncidentNumber && incSessions.length === 0) {
      try { await reparseStoryAssets(activeIncidentNumber) } catch {}
    }
    reloadIncAssets()
  }

  const handleSettingsSaved = () => {
    reloadIncidents()
    fetchSettings().then(s => setSnowInstance(s.snow_instance || undefined)).catch(() => {})
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

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSaved={handleSettingsSaved}
      />

      <Header
        activeSprint={filters.sprint}
        onSprintChange={sprint => updateFilter({ sprint })}
        activeAssignee={filters.assignee}
        onAssigneeChange={assignee => updateFilter({ assignee })}
        sprints={sprints}
        assignees={assignees}
        onOpenSettings={() => setSettingsOpen(true)}
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
          onClick={() => setActiveTab('incidents')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
          style={activeTab === 'incidents' ? {
            background: 'rgba(99,102,241,0.2)',
            color: '#818CF8',
          } : {
            color: 'var(--color-text-secondary)',
          }}
        >
          <AlertTriangle size={13} />
          Incidents
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
        {activeTab === 'board' && (
          <>
            <StoryPanel
              stories={stories}
              loading={loading}
              filters={filters}
              onFilterChange={updateFilter}
              activeStoryKey={activeStoryKey}
              onStorySelect={handleStorySelect}
              onStatusToggle={handleStatusToggle}
            />
            <ChatPanel
              story={activeStory}
              messages={storyMessages}
              isBuilding={storyBuilding}
              conversationLoading={storyConvLoading}
              error={storyError}
              onStartBuild={handleStartBuild}
              onSendMessage={(text, mode) => storySend(text, mode)}
              onStop={storyStop}
            />
            <AssetsPanel
              story={activeStory}
              sessions={sessions}
              loading={assetsLoading}
              isBuilding={storyBuilding}
              workspaceUrl={workspaceUrl}
              onRefresh={handleRefreshAssets}
            />
          </>
        )}

        {activeTab === 'incidents' && (
          <>
            <IncidentPanel
              incidents={incidents}
              loading={incLoading}
              configured={incConfigured}
              error={incError}
              filters={incFilters}
              onFilterChange={updateIncFilter}
              activeIncidentNumber={activeIncidentNumber}
              onIncidentSelect={handleIncidentSelect}
              onRefresh={reloadIncidents}
              onOpenSettings={() => setSettingsOpen(true)}
            />
            <IncidentChatPanel
              incident={activeIncident}
              messages={incMessages}
              isBuilding={incBuilding}
              conversationLoading={incConvLoading}
              error={incError2}
              onStartInvestigation={handleStartInvestigation}
              onSendMessage={(text, mode) => incSend(text, mode)}
              onStop={incStop}
              snowInstance={snowInstance}
            />
            <AssetsPanel
              story={null}
              sessions={incSessions}
              loading={incAssetsLoading}
              isBuilding={incBuilding}
              workspaceUrl={workspaceUrl}
              onRefresh={handleRefreshIncAssets}
            />
          </>
        )}

        {activeTab === 'genie' && <GeniePanel />}
      </div>
    </div>
  )
}
