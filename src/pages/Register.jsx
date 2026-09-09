import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import PasswordInput from '../components/PasswordInput'
import { AuthShell } from './Login'

export default function Register() {
  const { registerAndCreateFloor, registerAndRequestJoin } = useAuth()
  const { t } = useLanguage()
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
    // Mismo motivo que en Login: un gestor de contraseñas puede rellenar
    // email/contraseña escribiendo directo en el DOM sin disparar los
    // eventos de React, así que se leen los valores reales del
    // formulario en vez de confiar solo en el estado.
    const form = e.currentTarget
    const nameValue = form.name.value
    const emailValue = form.email.value
    const passwordValue = form.password.value
    setName(nameValue)
    setEmail(emailValue)
    setPassword(passwordValue)
    setError('')
    setSubmitting(true)
    try {
      if (mode === 'create') {
        await registerAndCreateFloor({ name: nameValue, email: emailValue, password: passwordValue, floorName })
      } else {
        await registerAndRequestJoin({ name: nameValue, email: emailValue, password: passwordValue, inviteCode })
      }
      navigate('/bienvenida')
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell>
      <h1 className="font-display text-2xl font-bold tracking-tight mb-1">{t('auth.register.title')}</h1>
      <p className="text-sm text-ink-900/60 dark:text-cream-100/60 mb-5">
        {t('auth.register.subtitle')}
      </p>

      <div className="flex bg-cream-200 dark:bg-ink-700 rounded-xl p-1 mb-5 text-sm font-semibold">
        <button
          type="button"
          onClick={() => setMode('create')}
          className={`flex-1 py-1.5 rounded-lg ${mode === 'create' ? 'bg-white dark:bg-ink-800 shadow-sm' : ''}`}
        >
          {t('auth.register.createTab')}
        </button>
        <button
          type="button"
          onClick={() => setMode('join')}
          className={`flex-1 py-1.5 rounded-lg ${mode === 'join' ? 'bg-white dark:bg-ink-800 shadow-sm' : ''}`}
        >
          {t('auth.register.joinTab')}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input className="input" name="name" autoComplete="name" placeholder={t('auth.register.namePlaceholder')} value={name} onChange={(e) => setName(e.target.value)} required />
        <input className="input" type="email" name="email" autoComplete="email" placeholder={t('auth.register.emailPlaceholder')} value={email} onChange={(e) => setEmail(e.target.value)} required />
        <PasswordInput
          name="password"
          autoComplete="new-password"
          placeholder={t('auth.register.passwordPlaceholder')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={4}
        />
        {mode === 'create' ? (
          <input
            className="input"
            placeholder={t('auth.register.floorNamePlaceholder')}
            value={floorName}
            onChange={(e) => setFloorName(e.target.value)}
            required
          />
        ) : (
          <input
            className="input uppercase"
            placeholder={t('auth.register.inviteCodePlaceholder')}
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            required
          />
        )}
        {mode === 'join' && (
          <p className="text-xs text-ink-900/50 dark:text-cream-100/50 -mt-1">
            {t('auth.register.joinNotice')}
          </p>
        )}
        {error && <p className="text-sm font-medium text-clay-500">{error}</p>}
        <button className="btn-primary mt-2" type="submit" disabled={submitting}>
          {submitting ? t('auth.register.submitting') : mode === 'create' ? t('auth.register.submitCreate') : t('auth.register.submitJoin')}
        </button>
      </form>

      <p className="text-sm mt-5 text-center text-ink-900/60 dark:text-cream-100/60">
        {t('auth.register.haveAccount')} <Link to="/login" className="text-violet-500 font-semibold hover:underline">{t('auth.register.loginLink')}</Link>
      </p>
    </AuthShell>
  )
}
