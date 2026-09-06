import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { PASSWORD_RULE, PASSWORD_RULE_MESSAGE } from '../lib/validation'
import { AuthShell } from './Login'

export default function ForgotPassword() {
  const { requestPasswordReset, confirmPasswordResetWithCode } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Paso 2: código de 6 dígitos que llega en el mismo correo + contraseña nueva.
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [codeError, setCodeError] = useState('')
  const [confirmingCode, setConfirmingCode] = useState(false)
  const [resent, setResent] = useState(false)
  const [done, setDone] = useState(false)

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

  async function handleResend() {
    setResent(false)
    try {
      await requestPasswordReset(email.trim())
      setResent(true)
    } catch (err) {
      setCodeError(err.message)
    }
  }

  async function handleConfirm(e) {
    e.preventDefault()
    setCodeError('')
    if (!/^\d{6}$/.test(code.trim())) {
      setCodeError('El código son 6 números — revisa el correo que te enviamos.')
      return
    }
    if (!PASSWORD_RULE.test(newPassword)) {
      setCodeError(PASSWORD_RULE_MESSAGE)
      return
    }
    if (newPassword !== confirmPassword) {
      setCodeError('Las contraseñas no coinciden.')
      return
    }
    setConfirmingCode(true)
    try {
      await confirmPasswordResetWithCode(email.trim(), code.trim(), newPassword)
      setDone(true)
      setTimeout(() => navigate('/'), 1500)
    } catch (err) {
      setCodeError(err.message)
    } finally {
      setConfirmingCode(false)
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

  if (sent) {
    return (
      <AuthShell>
        <h1 className="font-display text-2xl font-bold tracking-tight mb-1">Revisa tu correo</h1>
        <p className="text-sm text-ink-900/60 dark:text-cream-100/60 mb-6">
          Le enviamos a <strong>{email}</strong> un código de 6 dígitos. Escríbelo aquí junto con tu nueva contraseña —
          puede tardar unos minutos en llegar, revisa también la carpeta de spam.
        </p>
        <form onSubmit={handleConfirm} className="flex flex-col gap-3">
          <input
            className="input text-center text-lg font-display font-bold tracking-[0.3em]"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            required
          />
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
          {codeError && <p className="text-sm font-medium text-clay-500">{codeError}</p>}
          <button className="btn-primary mt-2" type="submit" disabled={confirmingCode}>
            {confirmingCode ? 'Comprobando…' : 'Cambiar contraseña'}
          </button>
        </form>
        <div className="text-sm mt-5 text-center text-ink-900/60 dark:text-cream-100/60">
          {resent ? (
            'Te mandamos otro código — el anterior ya no sirve.'
          ) : (
            <button type="button" onClick={handleResend} className="text-violet-500 font-semibold hover:underline">
              ¿No te llegó? Reenviar código
            </button>
          )}
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <h1 className="font-display text-2xl font-bold tracking-tight mb-1">¿Olvidaste tu contraseña?</h1>
      <p className="text-sm text-ink-900/60 dark:text-cream-100/60 mb-6">
        Escribe el email de tu cuenta y te enviaremos un código para restablecerla.
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
          {submitting ? 'Enviando…' : 'Enviar código'}
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
