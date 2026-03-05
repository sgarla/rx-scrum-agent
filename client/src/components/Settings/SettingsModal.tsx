import { CheckCircle, Eye, EyeOff, Loader2, Settings, X, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { fetchSettings, testSnowConnection, updateSettings } from '../../lib/api'
import type { ServiceNowSettings } from '../../lib/types'

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
  const [loading, setLoading] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; error: string | null } | null>(null)
  const [saved, setSaved] = useState(false)
  const [passwordSet, setPasswordSet] = useState(false)

  useEffect(() => {
    if (!open) return
    fetchSettings()
      .then((s: ServiceNowSettings) => {
        setInstance(s.snow_instance || '')
        setUsername(s.snow_username || '')
        setFilter(s.snow_filter || '')
        setPasswordSet(s.snow_password_set)
        setPassword('')  // never pre-fill password
        setSaved(false)
        setTestResult(null)
      })
      .catch(() => {})
  }, [open])

  if (!open) return null

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const result = await testSnowConnection(instance, username, password)
      setTestResult(result)
    } catch (e: any) {
      setTestResult({ ok: false, error: e.message ?? 'Unknown error' })
    } finally {
      setTesting(false)
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
      }
      if (password) {
        payload.snow_password = password
      }
      await updateSettings(payload)
      setSaved(true)
      setPasswordSet(!!password || passwordSet)
      setPassword('')
      onSaved()
      setTimeout(() => setSaved(false), 2000)
    } catch (e: any) {
      alert(`Failed to save: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="relative rounded-2xl shadow-2xl w-full max-w-lg mx-4"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid var(--color-border)' }}
        >
          <div className="flex items-center gap-2">
            <Settings size={16} style={{ color: '#818CF8' }} />
            <span className="text-base font-semibold text-white">Settings</span>
          </div>
          <button onClick={onClose} className="p-1 rounded" style={{ color: 'var(--color-text-muted)' }}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          <div>
            <h3
              className="text-xs font-semibold uppercase tracking-wider mb-4"
              style={{ color: '#818CF8' }}
            >
              ServiceNow Connection
            </h3>

            {/* Instance URL */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                  Instance URL
                </label>
                <input
                  type="text"
                  value={instance}
                  onChange={e => setInstance(e.target.value)}
                  placeholder="dev12345.service-now.com"
                  className="input text-sm w-full"
                />
                <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                  Enter your ServiceNow instance domain (without https://)
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="admin"
                  className="input text-sm w-full"
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                  Password
                  {passwordSet && !password && (
                    <span className="ml-2 text-xs font-normal" style={{ color: '#22C55E' }}>● saved</span>
                  )}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder={passwordSet ? '••••••••  (leave blank to keep current)' : 'Enter password'}
                    className="input text-sm w-full pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(p => !p)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                  Incident Filter Query <span className="font-normal" style={{ color: 'var(--color-text-muted)' }}>(optional)</span>
                </label>
                <input
                  type="text"
                  value={filter}
                  onChange={e => setFilter(e.target.value)}
                  placeholder="active=true^stateNOT IN7,8"
                  className="input text-sm w-full font-mono"
                />
                <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                  ServiceNow encoded query to filter incidents. Default: <code>active=true</code>
                </p>
              </div>
            </div>

            {/* Test result */}
            {testResult && (
              <div
                className="flex items-start gap-2 mt-3 rounded-lg px-3 py-2 text-sm"
                style={{
                  background: testResult.ok ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
                  border: `1px solid ${testResult.ok ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
                  color: testResult.ok ? '#22C55E' : '#FCA5A5',
                }}
              >
                {testResult.ok ? <CheckCircle size={14} className="mt-0.5 shrink-0" /> : <XCircle size={14} className="mt-0.5 shrink-0" />}
                {testResult.ok ? 'Connection successful!' : testResult.error ?? 'Connection failed'}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between gap-3 px-6 py-4"
          style={{ borderTop: '1px solid var(--color-border)' }}
        >
          <button
            onClick={handleTest}
            disabled={testing || !instance || !username || (!password && !passwordSet)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              background: 'var(--color-surface-2)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-secondary)',
              opacity: (testing || !instance || !username || (!password && !passwordSet)) ? 0.5 : 1,
              cursor: (testing || !instance || !username || (!password && !passwordSet)) ? 'not-allowed' : 'pointer',
            }}
          >
            {testing ? <Loader2 size={13} className="animate-spin" /> : null}
            Test Connection
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm transition-all"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={loading || !instance || !username}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-semibold transition-all"
              style={{
                background: saved ? '#22C55E' : '#6366F1',
                color: 'white',
                opacity: loading || !instance || !username ? 0.6 : 1,
                cursor: loading || !instance || !username ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? <Loader2 size={13} className="animate-spin" /> : saved ? <CheckCircle size={13} /> : null}
              {saved ? 'Saved!' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
