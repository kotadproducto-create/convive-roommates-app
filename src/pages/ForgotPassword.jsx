import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { AuthShell } from './Login'

export default function ForgotPassword() {
  const { requestPasswordReset } = useAuth()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await requestPasswordReset(email.trim())
      setSent(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (sent) {
    return (
      <AuthShell>
        <h1 className="font-display text-2xl font-bold tracking-tight mb-1">Revisa tu correo</h1>
        <p className="text-sm text-ink-900/60 dark:text-cream-100/60 mb-6">
          Si <strong>{email}</strong> tiene una cuenta en Convive, te hemos enviado un enlace para restablecer tu contraseña. Puede
          tardar unos minutos en llegar — revisa también la carpeta de spam.
        </p>
        <Link to="/login" className="btn-secondary w-full text-center block">
          Volver a entrar
        </Link>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <h1 className="font-display text-2xl font-bold tracking-tight mb-1">¿Olvidaste tu contraseña?</h1>
      <p className="text-sm text-ink-900/60 dark:text-cream-100/60 mb-6">
        Escribe el email de tu cuenta y te enviaremos un enlace para restablecerla.
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
        {error && <p className="text-sm font-medium text-clay-500">{error}</p>}
        <button className="btn-primary mt-2" type="submit" disabled={submitting}>
          {submitting ? 'Enviando…' : 'Enviar enlace'}
        </button>
      </form>
      <p className="text-sm mt-5 text-center text-ink-900/60 dark:text-cream-100/60">
        <Link to="/login" className="text-violet-500 font-semibold hover:underline">
          Volver a entrar
        </Link>
      </p>
    </AuthShell>
  )
}
