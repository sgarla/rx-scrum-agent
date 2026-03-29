import { useEffect, useState } from 'react'
import { Toaster, toast } from 'sonner'
import { AlertTriangle, Github, LayoutDashboard, Sparkles } from 'lucide-react'
import { AssetsPanel } from './components/AssetsPanel/AssetsPanel'
import { ChatPanel } from './components/ChatPanel/ChatPanel'
import { GeniePanel } from './components/GeniePanel/GeniePanel'
import { Header } from './components/layout/Header'
import { IncidentChatPanel } from './components/IncidentPanel/IncidentChatPanel'
import { IncidentPanel } from './components/IncidentPanel/IncidentPanel'
import { IssuePanel } from './components/GitHubIssuePanel/IssuePanel'
import { SettingsModal } from './components/Settings/SettingsModal'
import { StoryPanel } from './components/StoryPanel/StoryPanel'
import { useAssets } from './hooks/useAssets'
import { useConversation } from './hooks/useConversation'
import { useGitHubIssues } from './hooks/useGitHubIssues'
import { useIncidents } from './hooks/useIncidents'
import { useStories } from './hooks/useStories'
import { fetchHealth, fetchSettings, reparseStoryAssets, updateStoryStatus } from './lib/api'
import { githubIssueAsJiraStory } from './lib/github'
import type { JiraStory, ServiceNowIncident } from './lib/types'

type AppTab = 'board' | 'issues' | 'incidents' | 'genie'

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('board')

  const [activeStoryKey, setActiveStoryKey] = useState<string | null>(null)
  const [activeStory, setActiveStory] = useState<JiraStory | null>(null)

  const [activeIssueKey, setActiveIssueKey] = useState<string | null>(null)

  const [activeIncidentNumber, setActiveIncidentNumber] = useState<string | null>(null)
  const [activeIncident, setActiveIncident] = useState<ServiceNowIncident | null>(null)

  const [settingsOpen, setSettingsOpen] = useState(false)

  const [workspaceUrl, setWorkspaceUrl] = useState<string | undefined>()
  const [snowInstance, setSnowInstance] = useState<string | undefined>()

  const { stories, loading, filters, updateFilter, assignees, sprints, reload: reloadStories } = useStories()
  const { messages: storyMessages, isBuilding: storyBuilding, conversationLoading: storyConvLoading, conversation: storyConv, conversations: storyConversations, sendMessage: storySend, stop: storyStop, error: storyError, createNewConversation: storyNewConv, switchConversation: storySwitchConv, renameConversation: storyRenameConv } = useConversation(activeStoryKey)
  const { sessions, loading: assetsLoading, reload: reloadAssets } = useAssets(storyConv?.id ?? null, activeStoryKey, storyBuilding)

  const { issues: ghIssues, loading: ghLoading, configured: ghConfigured, error: ghError, filters: ghFilters, updateFilter: updateGhFilter, reload: reloadGhIssues } = useGitHubIssues()
  const { messages: ghMessages, isBuilding: ghBuilding, conversationLoading: ghConvLoading, conversation: ghConv, conversations: ghConversations, sendMessage: ghSend, stop: ghStop, error: ghErr, createNewConversation: ghNewConv, switchConversation: ghSwitchConv, renameConversation: ghRenameConv } = useConversation(activeIssueKey)
  const { sessions: ghSessions, loading: ghAssetsLoading, reload: reloadGhAssets } = useAssets(ghConv?.id ?? null, activeIssueKey, ghBuilding)

  const activeGhIssue = ghIssues.find(i => i.key === activeIssueKey) ?? null
  const ghStoryView: JiraStory | null = activeGhIssue ? githubIssueAsJiraStory(activeGhIssue) : null

  const { incidents, loading: incLoading, configured: incConfigured, error: incError, filters: incFilters, updateFilter: updateIncFilter, reload: reloadIncidents } = useIncidents()
  const { messages: incMessages, isBuilding: incBuilding, conversationLoading: incConvLoading, conversation: incConv, startBuild: incStartBuild, sendMessage: incSend, stop: incStop, error: incError2 } = useConversation(activeIncidentNumber)
  const { sessions: incSessions, loading: incAssetsLoading, reload: reloadIncAssets } = useAssets(incConv?.id ?? null, activeIncidentNumber, incBuilding)

  useEffect(() => {
    fetchHealth()
      .then(h => setWorkspaceUrl(h.workspace_url || undefined))
      .catch(() => {})
    fetchSettings()
      .then(s => setSnowInstance(s.snow_instance || undefined))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!activeStoryKey) { setActiveStory(null); return }
    const s = stories.find(s => s.key === activeStoryKey) ?? null
    setActiveStory(s)
  }, [activeStoryKey, stories])

  useEffect(() => {
    if (!activeIncidentNumber) { setActiveIncident(null); return }
    const inc = incidents.find(i => i.number === activeIncidentNumber) ?? null
    setActiveIncident(inc)
  }, [activeIncidentNumber, incidents])

  useEffect(() => { if (storyError) toast.error(storyError) }, [storyError])
  useEffect(() => { if (incError2) toast.error(incError2) }, [incError2])
  useEffect(() => { if (ghErr) toast.error(ghErr) }, [ghErr])

  const handleStorySelect = (key: string) => {
    setActiveStoryKey(key)
    setActiveTab('board')
  }

  const handleIssueSelect = (key: string) => {
    setActiveIssueKey(key)
    setActiveTab('issues')
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

  const handleRefreshGhAssets = async () => {
    if (activeIssueKey && ghSessions.length === 0) {
      try { await reparseStoryAssets(activeIssueKey) } catch {}
    }
    reloadGhAssets()
  }

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
    reloadGhIssues()
    fetchSettings().then(s => setSnowInstance(s.snow_instance || undefined)).catch(() => {})
  }

  const tabActive = (tab: AppTab) => ({
    background: activeTab === tab ? (tab === 'board' ? 'var(--color-accent)' : 'rgba(99,102,241,0.2)') : 'transparent',
    color: activeTab === tab ? (tab === 'board' ? 'white' : '#818CF8') : 'var(--color-text-secondary)',
  })

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

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} onSaved={handleSettingsSaved} />

      <Header
        activeSprint={filters.sprint}
        onSprintChange={sprint => updateFilter({ sprint })}
        activeAssignee={filters.assignee}
        onAssigneeChange={assignee => updateFilter({ assignee })}
        sprints={sprints}
        assignees={assignees}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <div
        className="shrink-0 flex items-center gap-1 px-3 py-2"
        style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)' }}
      >
        <button type="button" onClick={() => setActiveTab('board')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all" style={tabActive('board')}>
          <LayoutDashboard size={13} />
          Story Board
        </button>
        <button type="button" onClick={() => setActiveTab('issues')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all" style={tabActive('issues')}>
          <Github size={13} />
          Issues
        </button>
        <button type="button" onClick={() => setActiveTab('incidents')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all" style={tabActive('incidents')}>
          <AlertTriangle size={13} />
          Incidents
        </button>
        <button type="button" onClick={() => setActiveTab('genie')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all" style={tabActive('genie')}>
          <Sparkles size={13} />
          Genie
        </button>
      </div>

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
              onSendMessage={(text, mode) => storySend(text, mode)}
              onStop={storyStop}
              conversations={storyConversations}
              activeConversationId={storyConv?.id ?? null}
              onNewConversation={storyNewConv}
              onSwitchConversation={storySwitchConv}
              onRenameConversation={storyRenameConv}
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

        {activeTab === 'issues' && (
          <>
            <IssuePanel
              issues={ghIssues}
              loading={ghLoading}
              configured={ghConfigured}
              error={ghError}
              filters={ghFilters}
              onFilterChange={updateGhFilter}
              activeIssueKey={activeIssueKey}
              onIssueSelect={handleIssueSelect}
              onRefresh={reloadGhIssues}
              onOpenSettings={() => setSettingsOpen(true)}
            />
            <ChatPanel
              story={ghStoryView}
              externalIssueLink={activeGhIssue?.html_url ? { label: 'GitHub', url: activeGhIssue.html_url } : null}
              messages={ghMessages}
              isBuilding={ghBuilding}
              conversationLoading={ghConvLoading}
              error={ghErr}
              onSendMessage={(text, mode) => ghSend(text, mode)}
              onStop={ghStop}
              conversations={ghConversations}
              activeConversationId={ghConv?.id ?? null}
              onNewConversation={ghNewConv}
              onSwitchConversation={ghSwitchConv}
              onRenameConversation={ghRenameConv}
            />
            <AssetsPanel
              story={ghStoryView}
              sessions={ghSessions}
              loading={ghAssetsLoading}
              isBuilding={ghBuilding}
              workspaceUrl={workspaceUrl}
              onRefresh={handleRefreshGhAssets}
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
