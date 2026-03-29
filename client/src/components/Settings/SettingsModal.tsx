import { CheckCircle, Eye, EyeOff, Loader2, Settings, X, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { fetchSettings, testGitHubConnection, testSnowConnection, updateSettings } from '../../lib/api'
import type { AppSettings } from '../../lib/types'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
}

export function SettingsModal({ open, onClose, onSaved }: Props) {
  const [instance, setInstance] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [filter, setFilter] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [ghRepo, setGhRepo] = useState('')
  const [ghToken, setGhToken] = useState('')
  const [showGhToken, setShowGhToken] = useState(false)
  const [loading, setLoading] = useState(false)
  const [testingSnow, setTestingSnow] = useState(false)
  const [testingGh, setTestingGh] = useState(false)
  const [snowTestResult, setSnowTestResult] = useState<{ ok: boolean; error: string | null } | null>(null)
  const [ghTestResult, setGhTestResult] = useState<{ ok: boolean; error: string | null } | null>(null)
  const [saved, setSaved] = useState(false)
  const [passwordSet, setPasswordSet] = useState(false)
  const [ghTokenSet, setGhTokenSet] = useState(false)

  useEffect(() => {
    if (!open) return
    fetchSettings()
      .then((s: AppSettings) => {
        setInstance(s.snow_instance || '')
        setUsername(s.snow_username || '')
        setFilter(s.snow_filter || '')
        setPasswordSet(s.snow_password_set)
        setPassword('')
        setGhRepo(s.github_repo || '')
        setGhTokenSet(s.github_token_set)
        setGhToken('')
        setSaved(false)
        setSnowTestResult(null)
        setGhTestResult(null)
      })
      .catch(() => {})
  }, [open])

  if (!open) return null

  const handleTestSnow = async () => {
    setTestingSnow(true)
    setSnowTestResult(null)
    try {
      const result = await testSnowConnection(instance, username, password)
      setSnowTestResult(result)
    } catch (e: unknown) {
      setSnowTestResult({ ok: false, error: e instanceof Error ? e.message : 'Unknown error' })
    } finally {
      setTestingSnow(false)
    }
  }

  const handleTestGh = async () => {
    setTestingGh(true)
    setGhTestResult(null)
    try {
      const result = await testGitHubConnection(ghToken, ghRepo)
      setGhTestResult({ ok: result.ok, error: result.error ?? null })
    } catch (e: unknown) {
      setGhTestResult({ ok: false, error: e instanceof Error ? e.message : 'Unknown error' })
    } finally {
      setTestingGh(false)
    }
  }

  const handleSave = async () => {
    setLoading(true)
    setSaved(false)
    try {
      const payload: Record<string, string> = {
        snow_instance: instance.trim(),
        snow_username: username.trim(),
        snow_filter: filter.trim(),
        github_repo: ghRepo.trim(),
      }
      if (password) payload.snow_password = password
      if (ghToken) payload.github_token = ghToken
      await updateSettings(payload)
      setSaved(true)
      setPasswordSet(!!password || passwordSet)
      setGhTokenSet(!!ghToken || ghTokenSet)
      setPassword('')
      setGhToken('')
      onSaved()
      setTimeout(() => setSaved(false), 2000)
    } catch (e: unknown) {
      alert(`Failed to save: ${e instanceof Error ? e.message : 'error'}`)
    } finally {
      setLoading(false)
    }
  }

  const canSaveSnow = instance.trim() && username.trim()
  const canSaveGh = ghRepo.trim() && (ghToken.trim() || ghTokenSet)
  const canSave = canSaveSnow || canSaveGh

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto py-8"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="relative rounded-2xl shadow-2xl w-full max-w-lg mx-4 my-auto max-h-[90vh] overflow-y-auto"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
      >
        <div
          className="flex items-center justify-between px-6 py-4 sticky top-0 z-10"
          style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)' }}
        >
          <div className="flex items-center gap-2">
            <Settings size={16} style={{ color: '#818CF8' }} />
            <span className="text-base font-semibold text-white">Settings</span>
          </div>
          <button onClick={onClose} className="p-1 rounded" style={{ color: 'var(--color-text-muted)' }}>
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-8">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: '#818CF8' }}>
              ServiceNow Connection
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Instance URL</label>
                <input type="text" value={instance} onChange={e => setInstance(e.target.value)} placeholder="dev12345.service-now.com" className="input text-sm w-full" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Username</label>
                <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="admin" className="input text-sm w-full" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                  Password
                  {passwordSet && !password && <span className="ml-2 text-xs font-normal" style={{ color: '#22C55E' }}>● saved</span>}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder={passwordSet ? '••••••••  (leave blank to keep current)' : 'Enter password'}
                    className="input text-sm w-full pr-9"
                  />
                  <button type="button" onClick={() => setShowPassword(p => !p)} className="absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }}>
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Incident Filter Query (optional)</label>
                <input type="text" value={filter} onChange={e => setFilter(e.target.value)} placeholder="active=true^stateNOT IN7,8" className="input text-sm w-full font-mono" />
              </div>
            </div>
            {snowTestResult && (
              <div className="flex items-start gap-2 mt-3 rounded-lg px-3 py-2 text-sm" style={{ background: snowTestResult.ok ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${snowTestResult.ok ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`, color: snowTestResult.ok ? '#22C55E' : '#FCA5A5' }}>
                {snowTestResult.ok ? <CheckCircle size={14} className="mt-0.5 shrink-0" /> : <XCircle size={14} className="mt-0.5 shrink-0" />}
                {snowTestResult.ok ? 'ServiceNow OK' : snowTestResult.error ?? 'Failed'}
              </div>
            )}
            <button
              onClick={handleTestSnow}
              disabled={testingSnow || !instance || !username || (!password && !passwordSet)}
              className="mt-3 flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium"
              style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', opacity: (testingSnow || !instance || !username || (!password && !passwordSet)) ? 0.5 : 1 }}
            >
              {testingSnow ? <Loader2 size={13} className="animate-spin" /> : null}
              Test ServiceNow
            </button>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: '#818CF8' }}>
              GitHub Connection
            </h3>
            <p className="text-xs mb-3" style={{ color: 'var(--color-text-muted)' }}>
              Personal access token needs <code className="text-[10px]">repo</code> scope to read issues. Repository format: <code className="text-[10px]">owner/repo</code>
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Repository</label>
                <input type="text" value={ghRepo} onChange={e => setGhRepo(e.target.value)} placeholder="octocat/Hello-World" className="input text-sm w-full font-mono" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                  Personal access token
                  {ghTokenSet && !ghToken && <span className="ml-2 text-xs font-normal" style={{ color: '#22C55E' }}>● saved</span>}
                </label>
                <div className="relative">
                  <input
                    type={showGhToken ? 'text' : 'password'}
                    value={ghToken}
                    onChange={e => setGhToken(e.target.value)}
                    placeholder={ghTokenSet ? 'Leave blank to keep current' : 'ghp_...'}
                    className="input text-sm w-full pr-9 font-mono"
                  />
                  <button type="button" onClick={() => setShowGhToken(p => !p)} className="absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }}>
                    {showGhToken ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
            </div>
            {ghTestResult && (
              <div className="flex items-start gap-2 mt-3 rounded-lg px-3 py-2 text-sm" style={{ background: ghTestResult.ok ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${ghTestResult.ok ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`, color: ghTestResult.ok ? '#22C55E' : '#FCA5A5' }}>
                {ghTestResult.ok ? <CheckCircle size={14} className="mt-0.5 shrink-0" /> : <XCircle size={14} className="mt-0.5 shrink-0" />}
                {ghTestResult.ok ? 'GitHub OK' : ghTestResult.error ?? 'Failed'}
              </div>
            )}
            <button
              onClick={handleTestGh}
              disabled={testingGh || !ghRepo.trim() || (!ghToken.trim() && !ghTokenSet)}
              className="mt-3 flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium"
              style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', opacity: (testingGh || !ghRepo.trim() || (!ghToken.trim() && !ghTokenSet)) ? 0.5 : 1 }}
            >
              {testingGh ? <Loader2 size={13} className="animate-spin" /> : null}
              Test GitHub
            </button>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 sticky bottom-0" style={{ borderTop: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm" style={{ color: 'var(--color-text-muted)' }}>Cancel</button>
          <button
            onClick={handleSave}
            disabled={loading || !canSave}
            className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-semibold"
            style={{ background: saved ? '#22C55E' : '#6366F1', color: 'white', opacity: loading || !canSave ? 0.6 : 1 }}
          >
            {loading ? <Loader2 size={13} className="animate-spin" /> : saved ? <CheckCircle size={13} /> : null}
            {saved ? 'Saved!' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
