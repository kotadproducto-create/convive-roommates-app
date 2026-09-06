import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { PASSWORD_RULE, PASSWORD_RULE_MESSAGE } from '../lib/validation'
import { AuthShell } from './Login'

export default function ResetPassword() {
  const { user, loading, updatePasswordWithRecovery } = useAuth()
  const navigate = useNavigate()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!PASSWORD_RULE.test(newPassword)) {
      setError(PASSWORD_RULE_MESSAGE)
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }
    setSubmitting(true)
    try {
      await updatePasswordWithRecovery(newPassword)
      setDone(true)
      setTimeout(() => navigate('/'), 1500)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <AuthShell>
        <h1 className="font-display text-2xl font-bold tracking-tight mb-1">Contraseña actualizada</h1>
        <p className="text-sm text-ink-900/60 dark:text-cream-100/60">
          Ya puedes usarla la próxima vez que entres. Te llevamos dentro…
        </p>
      </AuthShell>
    )
  }

  if (loading) return null

  // El enlace del correo crea una sesión temporal de recuperación al
  // cargar esta página. Si no hay usuario, el enlace ya caducó o es
  // inválido (o se entró directo a esta URL sin pasar por el correo).
  if (!user) {
    return (
      <AuthShell>
        <h1 className="font-display text-2xl font-bold tracking-tight mb-1">Enlace no válido</h1>
        <p className="text-sm text-ink-900/60 dark:text-cream-100/60 mb-6">
          Este enlace de recuperación no es válido o ya caducó — a veces pasa porque el propio correo lo abre antes que
          tú, por seguridad. El mismo email trae también un código de 6 dígitos que puedes escribir a mano.
        </p>
        <Link to="/olvide-contrasena" className="btn-primary w-full text-center block">
          Usar el código del correo
        </Link>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <h1 className="font-display text-2xl font-bold tracking-tight mb-1">Elige una nueva contraseña</h1>
      <p className="text-sm text-ink-900/60 dark:text-cream-100/60 mb-6">Mínimo 8 caracteres, con una mayúscula y un número.</p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          className="input"
          type="password"
          placeholder="Nueva contraseña"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
        />
        <input
          className="input"
          type="password"
          placeholder="Confirmar nueva contraseña"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />
        {error && <p className="text-sm font-medium text-clay-500">{error}</p>}
        <button className="btn-primary mt-2" type="submit" disabled={submitting}>
          {submitting ? 'Guardando…' : 'Guardar contraseña'}
        </button>
      </form>
    </AuthShell>
  )
}
