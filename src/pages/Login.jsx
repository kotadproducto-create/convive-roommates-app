import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login(email, password)
      navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell>
      <h1 className="font-display text-2xl font-bold tracking-tight mb-1">Bienvenido de nuevo</h1>
      <p className="text-sm text-ink-900/60 dark:text-cream-100/60 mb-6">
        Entra para ver las tareas de tu piso.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input className="input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className="input" type="password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <p className="text-sm font-medium text-clay-500">{error}</p>}
        <button className="btn-primary mt-2" type="submit" disabled={submitting}>
          {submitting ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
      <p className="text-sm mt-5 text-center text-ink-900/60 dark:text-cream-100/60">
        ¿No tienes cuenta? <Link to="/register" className="text-violet-500 font-semibold hover:underline">Regístrate</Link>
      </p>
    </AuthShell>
  )
}

export function AuthShell({ children }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-cream-100 dark:bg-ink-900 px-4 relative overflow-hidden">
      <div className="dot-grid absolute inset-0 text-ink-900/[0.06] dark:text-cream-100/[0.05] pointer-events-none" />
      <div className="relative w-full max-w-sm">
        <div className="flex flex-col items-center gap-2 mb-7">
          <svg width="44" height="44" viewBox="0 0 32 32" className="chore-wheel">
            <circle cx="16" cy="16" r="13.5" fill="none" stroke="currentColor" className="text-ink-900 dark:text-cream-100" strokeWidth="2" strokeDasharray="1 7" strokeLinecap="round" opacity="0.5" />
            <circle cx="16" cy="7.5" r="4" fill="#6B4FE0" />
            <circle cx="8.5" cy="20.5" r="3" fill="#FF6B4A" />
            <circle cx="23.5" cy="20.5" r="2.6" fill="#F5B942" />
            <path d="M16 11 10.5 18.5M16 11 21.5 18" stroke="#17131C" strokeWidth="1.4" strokeLinecap="round" opacity="0.55" />
          </svg>
          <span className="font-display font-bold text-2xl tracking-tight">Convive</span>
          <p className="text-xs font-medium text-ink-900/50 dark:text-cream-100/50 uppercase tracking-wide">Organizar el piso, sin dramas</p>
        </div>
        <div className="card p-7">{children}</div>
      </div>
    </div>
  )
}
