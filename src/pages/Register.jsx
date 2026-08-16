import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { AuthShell } from './Login'

export default function Register() {
  const { registerAndCreateFloor, registerAndJoinFloor } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState('create') // 'create' | 'join'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [floorName, setFloorName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      if (mode === 'create') {
        await registerAndCreateFloor({ name, email, password, floorName })
      } else {
        await registerAndJoinFloor({ name, email, password, inviteCode })
      }
      navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell>
      <h1 className="font-display text-2xl font-bold tracking-tight mb-1">Crea tu cuenta</h1>
      <p className="text-sm text-ink-900/60 dark:text-cream-100/60 mb-5">
        Empieza un piso nuevo o únete a uno con un código.
      </p>

      <div className="flex bg-cream-200 dark:bg-ink-700 rounded-xl p-1 mb-5 text-sm font-semibold">
        <button
          type="button"
          onClick={() => setMode('create')}
          className={`flex-1 py-1.5 rounded-lg ${mode === 'create' ? 'bg-white dark:bg-ink-800 shadow-sm' : ''}`}
        >
          Crear piso
        </button>
        <button
          type="button"
          onClick={() => setMode('join')}
          className={`flex-1 py-1.5 rounded-lg ${mode === 'join' ? 'bg-white dark:bg-ink-800 shadow-sm' : ''}`}
        >
          Unirme a un piso
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input className="input" placeholder="Tu nombre" value={name} onChange={(e) => setName(e.target.value)} required />
        <input className="input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input
          className="input"
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={4}
        />
        {mode === 'create' ? (
          <input
            className="input"
            placeholder="Nombre del piso (ej: Piso Malasaña 3ºB)"
            value={floorName}
            onChange={(e) => setFloorName(e.target.value)}
            required
          />
        ) : (
          <input
            className="input uppercase"
            placeholder="Código de invitación"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            required
          />
        )}
        {error && <p className="text-sm font-medium text-clay-500">{error}</p>}
        <button className="btn-primary mt-2" type="submit" disabled={submitting}>
          {submitting ? 'Creando…' : mode === 'create' ? 'Crear piso y cuenta' : 'Unirme'}
        </button>
      </form>

      <p className="text-sm mt-5 text-center text-ink-900/60 dark:text-cream-100/60">
        ¿Ya tienes cuenta? <Link to="/login" className="text-violet-500 font-semibold hover:underline">Inicia sesión</Link>
      </p>
    </AuthShell>
  )
}
