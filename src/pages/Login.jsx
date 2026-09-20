import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import Mascot from '../components/Mascot'
import PasswordInput from '../components/PasswordInput'
import LanguageSwitcher from '../components/LanguageSwitcher'
import { authErrorMessage } from '../lib/authErrors'

export default function Login() {
  const { login, user, loading } = useAuth()
  const { t } = useLanguage()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    // Algunos gestores de contraseñas rellenan el formulario escribiendo
    // directo en el DOM sin disparar los eventos que React escucha para
    // actualizar `email`/`password` — si confiáramos solo en ese estado,
    // este primer submit iría con los campos vacíos (y habría que
    // reintentar). Por eso se leen los valores reales del formulario en
    // vez del estado, y de paso se sincroniza el estado con ellos.
    const form = e.currentTarget
    const emailValue = form.email.value
    const passwordValue = form.password.value
    setEmail(emailValue)
    setPassword(passwordValue)
    setError('')
    setSubmitting(true)
    try {
      // Al terminar, `user` ya está cargado y el <Navigate> de abajo
      // lleva a "/" solo — sin navegar a mano desde acá (ver login()).
      await login(emailValue, passwordValue)
    } catch (err) {
      setError(authErrorMessage(err, t))
    } finally {
      setSubmitting(false)
    }
  }

  // Sesión ya iniciada (recién logueado, o entró a /login con la sesión
  // abierta): no tiene sentido mostrar el formulario.
  if (!loading && user) return <Navigate to="/" replace />

  return (
    <AuthShell>
      <h1 className="font-display text-2xl font-bold tracking-tight mb-1">{t('auth.login.title')}</h1>
      <p className="text-sm text-ink-900/60 dark:text-cream-100/60 mb-6">
        {t('auth.login.subtitle')}
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          className="input"
          type="email"
          name="email"
          autoComplete="email"
          placeholder={t('auth.login.emailPlaceholder')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <PasswordInput
          name="password"
          autoComplete="current-password"
          placeholder={t('auth.login.passwordPlaceholder')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <Link to="/olvide-contrasena" className="text-xs font-semibold text-violet-500 hover:underline -mt-1 self-end">
          {t('auth.login.forgotPassword')}
        </Link>
        {error && <p className="text-sm font-medium text-clay-500">{error}</p>}
        <button className="btn-primary mt-2" type="submit" disabled={submitting}>
          {submitting ? t('auth.login.submitting') : t('auth.login.submit')}
        </button>
      </form>
      <p className="text-sm mt-5 text-center text-ink-900/60 dark:text-cream-100/60">
        {t('auth.login.noAccount')} <Link to="/register" className="text-violet-500 font-semibold hover:underline">{t('auth.login.registerLink')}</Link>
      </p>
    </AuthShell>
  )
}

// min-h con dvh: en el navegador del móvil 100vh incluye la barra de direcciones y
// deja parte del formulario fuera de la pantalla. El py evita que algo quede pegado
// al borde; si el contenido no cabe en alto, la página hace scroll (no se encoge).
export function AuthShell({ children }) {
  const { t } = useLanguage()
  return (
    <div className="min-h-screen [min-height:100dvh] flex items-center justify-center bg-white dark:bg-ink-900 px-4 py-6 landscape-sm:py-3 relative overflow-x-hidden">
      <div className="dot-grid absolute inset-0 text-ink-900/[0.06] dark:text-cream-100/[0.05] pointer-events-none" />
      <div className="relative w-full max-w-sm min-w-0">
        {/* Selector de idioma: el mismo de Ajustes, disponible antes de entrar. */}
        <div className="flex justify-end mb-3 landscape-sm:mb-1.5">
          <LanguageSwitcher />
        </div>
        <div className="flex flex-col items-center gap-1 mb-7 landscape-sm:mb-3 [@media(max-height:700px)]:mb-4">
          <Mascot className="w-20 h-20 mb-1 landscape-sm:w-10 landscape-sm:h-10 [@media(max-height:700px)]:w-14 [@media(max-height:700px)]:h-14" />
          <div className="flex items-center gap-2.5">
            <svg width="32" height="32" viewBox="0 0 32 32" className="chore-wheel">
              <circle cx="16" cy="16" r="13.5" fill="none" stroke="currentColor" className="text-ink-900 dark:text-cream-100" strokeWidth="2" strokeDasharray="1 7" strokeLinecap="round" opacity="0.5" />
              <circle cx="16" cy="7.5" r="4" fill="#6B4FE0" />
              <circle cx="8.5" cy="20.5" r="3" fill="#FF6B4A" />
              <circle cx="23.5" cy="20.5" r="2.6" fill="#F5B942" />
              <path d="M16 11 10.5 18.5M16 11 21.5 18" stroke="#17131C" strokeWidth="1.4" strokeLinecap="round" opacity="0.55" />
            </svg>
            <span className="font-display font-bold text-2xl tracking-tight">Convive</span>
          </div>
          <p className="text-xs font-medium text-ink-900/50 dark:text-cream-100/50 uppercase tracking-wide">{t('auth.tagline')}</p>
        </div>
        <div className="card p-5 min-[380px]:p-7 landscape-sm:p-4">{children}</div>
      </div>
    </div>
  )
}
