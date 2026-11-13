import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import Icon from '../components/Icons'
import { HOME } from '../roleRoutes'

const DEMO = [
  { label: 'Ambulance driver', email: 'driver@ayu.test' },
  { label: 'Ambulance staff', email: 'staff@ayu.test' },
  { label: 'Hospital staff', email: 'hospital@ayu.test' },
  { label: 'Doctor', email: 'doctor@ayu.test' },
  { label: 'Administrator', email: 'admin@ayu.test' },
]
const DEMO_PASSWORD = 'ayu12345'

export default function Login() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to={HOME[user.role] ?? '/'} replace />

  async function submit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const me = await login(email.trim(), password)
      navigate(HOME[me.role] ?? '/', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function signInAsDemo(demo) {
    if (busy) return
    setError('')
    setBusy(true)
    try {
      const me = await login(demo.email, DEMO_PASSWORD)
      navigate(HOME[me.role] ?? '/', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="login-page">
      <div className="login-panel">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="login-brand">
              <span className="app-brand-mark"><Icon name="activity" /></span>
              AYU-LINK
            </h1>
            <p className="mt-2 text-[13px] leading-5 text-[var(--text-muted)]">Emergency handoff, clearly connected.</p>
          </div>
        </div>

        <section>
          <h2 className="text-[17px] font-bold text-[var(--ink)]">Sign in</h2>
          <p className="mt-1 text-[12px] leading-5 text-[var(--text-muted)]">Use your account or open a seeded demo workspace in one step.</p>

          <form onSubmit={submit} className="mt-5 space-y-4">
              <label className="block">
                <span className="paper-label">Email</span>
                <input
                  type="email"
                  required
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="field mt-1"
                />
              </label>
              <label className="block">
                <span className="paper-label">Password</span>
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="field mt-1"
                />
              </label>

              {error ? (
                <p role="alert" className="notice notice-alarm">
                  {error}
                </p>
              ) : null}

              <button type="submit" disabled={busy} className="btn-ink w-full">
                {busy ? 'Signing in…' : 'Sign in'}
              </button>
          </form>

          <div className="mt-6 border-t border-[var(--paper-line)] pt-5">
              <h2 className="text-[14px] font-bold text-[var(--ink)]">Present a demo</h2>
              <p className="mt-1 text-[12px] leading-5 text-[var(--text-muted)]">Choose a role to enter directly.</p>
              <div className="demo-account-grid mt-3">
                {DEMO.map((demo) => (
                  <button
                    key={demo.email}
                    type="button"
                    disabled={busy}
                    onClick={() => signInAsDemo(demo)}
                    className="demo-account"
                  >
                    {demo.label}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-[11px] text-[var(--paper-muted)]">Seeded demo accounts · shared demo password: {DEMO_PASSWORD}</p>
          </div>
        </section>
      </div>
    </main>
  )
}
