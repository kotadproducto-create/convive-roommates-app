import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { useToast } from '../context/ToastContext'
import PasswordInput from '../components/PasswordInput'
import { AuthShell } from './Login'
import { authErrorMessage } from '../lib/authErrors'
import { PIN_LENGTH, cleanPinInput, isValidPin } from '../lib/publicPoll'
import { setPollPin } from '../lib/publicPollApi'
import { getAll } from '../lib/db'
import { normalizeInviteCode, savePendingInvite, clearPendingInvite } from '../lib/invite'

export default function Register() {
  const { registerAndCreateFloor, registerAndRequestJoin, user, loading } = useAuth()
  const { t } = useLanguage()
  const { showToast } = useToast()
  const navigate = useNavigate()
  // Llegando por un link de invitación (/unirse/<código>) se abre directo en "Unirme a un piso".
  const linkCode = normalizeInviteCode(useParams().code)
  const [mode, setMode] = useState(linkCode ? 'join' : 'create') // 'create' | 'join'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [floorName, setFloorName] = useState('')
  const [inviteCode, setInviteCode] = useState(linkCode)
  // Piso al que invita el link: undefined = comprobando, null = no existe, texto = su nombre.
  const [invitedFloor, setInvitedFloor] = useState(undefined)
  // PIN opcional para votar consultas desde un link, sin iniciar sesión (ver PublicPoll.jsx).
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!linkCode) return undefined
    let active = true
    savePendingInvite(linkCode)
    getAll('floors', { inviteCode: linkCode })
      .then((rows) => active && setInvitedFloor(rows[0]?.name || null))
      .catch((err) => {
        console.error('invited floor', err)
        if (active) setInvitedFloor(undefined)
      })
    return () => {
      active = false
    }
  }, [linkCode])

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
    // Se valida antes de crear nada: un PIN a medias no debe dejar la cuenta creada.
    if (pin && !isValidPin(pin)) {
      setError(t('auth.register.pinInvalid'))
      return
    }
    setSubmitting(true)
    try {
      if (mode === 'create') {
        await registerAndCreateFloor({ name: nameValue, email: emailValue, password: passwordValue, floorName })
      } else {
        await registerAndRequestJoin({ name: nameValue, email: emailValue, password: passwordValue, inviteCode })
      }
      // Con la cuenta ya creada y la sesión abierta se guarda el PIN. Si falla no se
      // frena el registro: se puede crear luego en Configuración → Seguridad.
      if (pin) {
        try {
          const result = await setPollPin(pin)
          if (!result?.ok) throw new Error(result?.error || 'set_poll_pin')
        } catch (pinErr) {
          console.error('set_poll_pin (registro)', pinErr)
          showToast(t('auth.register.pinLater'), 'default')
        }
      }
      clearPendingInvite()
      navigate('/bienvenida')
    } catch (err) {
      setError(authErrorMessage(err, t))
    } finally {
      setSubmitting(false)
    }
  }

  // Con sesión ya abierta el link no tiene nada que registrar: sin piso, la pantalla de
  // unirse deja el código puesto; con piso, va a la app. (Sin esto solo si llegó por el
  // link: /register a secas se comporta como siempre.)
  if (linkCode && !loading && user && !submitting) return <Navigate to="/" replace />

  return (
    <AuthShell>
      <h1 className="font-display text-2xl font-bold tracking-tight mb-1">{t('auth.register.title')}</h1>
      <p className="text-sm text-ink-900/60 dark:text-cream-100/60 mb-5">
        {t('auth.register.subtitle')}
      </p>

      {linkCode && invitedFloor !== undefined && (
        <p
          className={`text-sm font-semibold rounded-xl px-3 py-2 mb-4 break-words ${
            invitedFloor ? 'bg-sage-100 dark:bg-sage-500/20 text-ink-900 dark:text-cream-100' : 'bg-clay-100 dark:bg-clay-500/20 text-clay-500'
          }`}
        >
          {invitedFloor ? t('auth.register.invitedBanner', { floor: invitedFloor }) : t('auth.register.invitedInvalid')}
        </p>
      )}

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
        <div>
          <input
            className="input"
            type="password"
            name="pollPin"
            inputMode="numeric"
            autoComplete="off"
            maxLength={PIN_LENGTH}
            placeholder={t('auth.register.pinPlaceholder')}
            value={pin}
            onChange={(e) => setPin(cleanPinInput(e.target.value))}
          />
          <p className="text-xs text-ink-900/50 dark:text-cream-100/50 mt-1">{t('auth.register.pinHint')}</p>
        </div>
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
