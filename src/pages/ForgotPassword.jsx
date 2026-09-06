import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { PASSWORD_RULE, PASSWORD_RULE_MESSAGE } from '../lib/validation'
import { AuthShell } from './Login'

export default function ForgotPassword() {
  const { requestPasswordReset, confirmPasswordResetWithCode } = useAuth()
  const { t } = useLanguage()
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
      setCodeError(t('auth.forgot.codeErrorFormat'))
      return
    }
    if (!PASSWORD_RULE.test(newPassword)) {
      setCodeError(PASSWORD_RULE_MESSAGE)
      return
    }
    if (newPassword !== confirmPassword) {
      setCodeError(t('auth.forgot.passwordMismatch'))
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
        <h1 className="font-display text-2xl font-bold tracking-tight mb-1">{t('auth.forgot.updatedTitle')}</h1>
        <p className="text-sm text-ink-900/60 dark:text-cream-100/60">
          {t('auth.forgot.updatedBody')}
        </p>
      </AuthShell>
    )
  }

  if (sent) {
    return (
      <AuthShell>
        <h1 className="font-display text-2xl font-bold tracking-tight mb-1">{t('auth.forgot.checkEmailTitle')}</h1>
        <p className="text-sm text-ink-900/60 dark:text-cream-100/60 mb-6">
          {(() => {
            const [before, after] = t('auth.forgot.checkEmailBody').split('{{email}}')
            return (
              <>
                {before}
                <strong>{email}</strong>
                {after}
              </>
            )
          })()}
        </p>
        <form onSubmit={handleConfirm} className="flex flex-col gap-3">
          <input
            className="input text-center text-lg font-display font-bold tracking-[0.3em]"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder={t('auth.forgot.codePlaceholder')}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            required
          />
          <input
            className="input"
            type="password"
            placeholder={t('auth.forgot.newPasswordPlaceholder')}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
          <input
            className="input"
            type="password"
            placeholder={t('auth.forgot.confirmPasswordPlaceholder')}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
          {codeError && <p className="text-sm font-medium text-clay-500">{codeError}</p>}
          <button className="btn-primary mt-2" type="submit" disabled={confirmingCode}>
            {confirmingCode ? t('auth.forgot.checking') : t('auth.forgot.changePassword')}
          </button>
        </form>
        <div className="text-sm mt-5 text-center text-ink-900/60 dark:text-cream-100/60">
          {resent ? (
            t('auth.forgot.resent')
          ) : (
            <button type="button" onClick={handleResend} className="text-violet-500 font-semibold hover:underline">
              {t('auth.forgot.resendPrompt')}
            </button>
          )}
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <h1 className="font-display text-2xl font-bold tracking-tight mb-1">{t('auth.forgot.title')}</h1>
      <p className="text-sm text-ink-900/60 dark:text-cream-100/60 mb-6">
        {t('auth.forgot.subtitle')}
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          className="input"
          type="email"
          placeholder={t('auth.forgot.emailPlaceholder')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        {error && <p className="text-sm font-medium text-clay-500">{error}</p>}
        <button className="btn-primary mt-2" type="submit" disabled={submitting}>
          {submitting ? t('auth.forgot.sending') : t('auth.forgot.submit')}
        </button>
      </form>
      <p className="text-sm mt-5 text-center text-ink-900/60 dark:text-cream-100/60">
        <Link to="/login" className="text-violet-500 font-semibold hover:underline">
          {t('auth.forgot.backToLogin')}
        </Link>
      </p>
    </AuthShell>
  )
}
