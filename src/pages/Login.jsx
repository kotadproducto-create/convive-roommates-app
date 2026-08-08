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
      <h1 className="font-display text-2xl font-semibold mb-1">Bienvenido de nuevo</h1>
      <p className="text-sm text-charcoal-900/60 dark:text-linen-100/60 mb-6">
        Entra para ver las tareas de tu piso.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          className="input"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="input"
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <p className="text-sm text-clay-500">{error}</p>}
        <button className="btn-primary mt-2" type="submit" disabled={submitting}>
          {submitting ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
      <p className="text-sm mt-5 text-center text-charcoal-900/60 dark:text-linen-100/60">
        ¿No tienes cuenta? <Link to="/register" className="text-plum-500 font-medium hover:underline">Regístrate</Link>
      </p>
    </AuthShell>
  )
}

export function AuthShell({ children }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-linen-100 dark:bg-charcoal-900 px-4">
      <div className="w-full max-w-sm card p-7">
        <div className="flex items-center gap-2 mb-6 justify-center">
          <svg width="30" height="30" viewBox="0 0 30 30">
            <circle cx="15" cy="15" r="13" fill="none" stroke="#5B4B8A" strokeWidth="2.5" />
            <path d="M15 2 A13 13 0 0 1 26.25 8.5" fill="none" stroke="#E8A33D" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="15" cy="15" r="3" fill="#5B4B8A" />
          </svg>
          <span className="font-display font-semibold text-lg">Convive</span>
        </div>
        {children}
      </div>
    </div>
  )
}
