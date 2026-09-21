import LanguageSwitcher from '../components/LanguageSwitcher'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import Reveal from '../components/Reveal'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { useTheme } from '../context/ThemeContext'
import { usePush } from '../context/PushContext'
import { useToast } from '../context/ToastContext'
import { useLanguage } from '../context/LanguageContext'
import { LockIcon, MoonIcon, SunIcon, BellIcon, AlertIcon, MailIcon, InfoIcon, GearIcon } from '../components/icons'
import PageBanner, { SectionLabel } from '../components/PageBanner'
import { cleanPinInput, isValidPin } from '../lib/publicPoll'
import { hasPollPin, setPollPin } from '../lib/publicPollApi'

const PASSWORD_RULE = /^(?=.*[A-Z])(?=.*\d).{8,}$/
const APP_VERSION = '1.0.0 Beta'
const SUPPORT_EMAIL = 'Kota.dproducto@gmail.com'

/**
 * Configuración: cómo funciona la app para vos — tutorial, — tema, idioma,
 * notificaciones, seguridad de la cuenta y "acerca de". Todo lo de
 * identidad (quién sos, cómo te ven) vive en Perfil.jsx.
 */
export default function Ajustes() {
  const { user, membership, floor, changePassword, logout, verifyPassword, banAccount, refresh } = useAuth()
  const { removeMember, setMemberRole, updateProfile, members } = useData()
  const { showToast } = useToast()
  const { t } = useLanguage()

  if (!user) return null

  return (
    <AppLayout title={t('ajustes.title')}>
      <div className="flex flex-col gap-5 max-w-2xl">
        <Reveal>
          <PageBanner
            tone="gold"
            Icon={GearIcon}
            title={t('ajustes.bannerTitle')}
            subtitle={t('ajustes.bannerSubtitle')}
            linkTo="/perfil"
            linkLabel={t('ajustes.bannerLink')}
          />
        </Reveal>

        <SectionLabel>{t('ajustes.groupApp')}</SectionLabel>
        <Reveal>
          <TutorialCard user={user} updateProfile={updateProfile} refresh={refresh} showToast={showToast} t={t} />
        </Reveal>
        <Reveal delay={40}>
          <AppPreferencesCard t={t} />
        </Reveal>
        <Reveal delay={80}>
          <NotificationsCard t={t} />
        </Reveal>

        <SectionLabel>{t('ajustes.groupAccount')}</SectionLabel>
        <Reveal delay={120}>
          <SecurityCard
            changePassword={changePassword}
            logout={logout}
            removeMember={removeMember}
            membership={membership}
            userId={user.id}
            floorName={floor?.name}
            showToast={showToast}
            t={t}
          />
        </Reveal>
        <Reveal delay={180}>
          <DangerZoneCard
            user={user}
            membership={membership}
            floor={floor}
            members={members}
            removeMember={removeMember}
            setMemberRole={setMemberRole}
            updateProfile={updateProfile}
            verifyPassword={verifyPassword}
            banAccount={banAccount}
            logout={logout}
            showToast={showToast}
            t={t}
          />
        </Reveal>
        <SectionLabel>{t('ajustes.groupInfo')}</SectionLabel>
        <Reveal delay={220}>
          <AboutCard t={t} />
        </Reveal>
      </div>
    </AppLayout>
  )
}

/** "Tutorial de la aplicación" con el interruptor "Modo tutorial": activarlo
 * vuelve a mostrar la guía de los botones principales (ver AppTutorial.jsx);
 * al terminarla o cerrarla se desactiva sola. */
function TutorialCard({ user, updateProfile, refresh, showToast, t }) {
  const enabled = Boolean(user.tutorialEnabled)
  const [saving, setSaving] = useState(false)

  async function toggle() {
    setSaving(true)
    try {
      await updateProfile(user.id, { tutorialEnabled: !enabled })
      await refresh()
    } catch (err) {
      console.error('tutorial toggle', err)
      showToast(t('ajustes.tutorialErrorToast'), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card p-5">
      <h2 className="font-display font-semibold mb-1">{t('ajustes.tutorialTitle')}</h2>
      <p className="text-sm text-ink-900/60 dark:text-cream-100/60 mb-4">{t('ajustes.tutorialBody')}</p>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold min-w-0">{t('ajustes.tutorialMode')}</span>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={t('ajustes.tutorialMode')}
          disabled={saving}
          onClick={toggle}
          className="flex items-center gap-2 shrink-0 disabled:opacity-60"
        >
          <span className={`text-xs font-bold ${enabled ? 'text-sage-500' : 'text-ink-900/50 dark:text-cream-100/50'}`}>
            {enabled ? t('ajustes.tutorialOn') : t('ajustes.tutorialOff')}
          </span>
          <span className={`relative w-11 h-6 rounded-full border-2 border-ink-900/70 dark:border-cream-100/40 transition-colors ${enabled ? 'bg-sage-500' : 'bg-cream-200 dark:bg-ink-700'}`}>
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white border-2 border-ink-900/70 transition-all ${enabled ? 'left-[22px]' : 'left-0.5'}`} />
          </span>
        </button>
      </div>
      <p className="text-xs text-ink-900/50 dark:text-cream-100/50 mt-3">{enabled ? t('ajustes.tutorialOnHint') : t('ajustes.tutorialOffHint')}</p>
    </div>
  )
}

function AppPreferencesCard({ t }) {
  const { theme, toggleTheme } = useTheme()
  const currentThemeLabel = theme === 'light' ? t('perfil.lightTheme') : t('perfil.darkTheme')
  const targetThemeLabel = theme === 'light' ? t('perfil.darkTheme') : t('perfil.lightTheme')

  return (
    <div className="card p-5">
      <h2 className="font-display font-semibold mb-3">{t('perfil.preferencesTitle')}</h2>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          {theme === 'light' ? <MoonIcon className="w-4 h-4" /> : <SunIcon className="w-4 h-4" />}
          {t('perfil.themeLabel', { theme: currentThemeLabel })}
        </div>
        <button type="button" className="btn-secondary text-sm" onClick={toggleTheme}>
          {t('perfil.switchTo', { theme: targetThemeLabel })}
        </button>
      </div>

      <div className="flex items-center justify-between mt-4 pt-4 border-t border-ink-900/10 dark:border-cream-100/15">
        <span className="text-sm font-semibold">{t('topbar.language')}</span>
        <LanguageSwitcher variant="compact" />
      </div>
    </div>
  )
}

function NotificationsCard({ t }) {
  const { supported, subscribed, needsInstall, optIn, optOut } = usePush()

  if (!supported && !needsInstall) return null

  return (
    <div className="card p-5">
      <h2 className="font-display font-semibold mb-3">{t('ajustes.notificationsTitle')}</h2>
      {supported && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <BellIcon className="w-4 h-4" />
            {t('perfil.pushLabel', { status: subscribed ? t('perfil.pushOn') : t('perfil.pushOff') })}
          </div>
          <button type="button" className="btn-secondary text-sm" onClick={subscribed ? optOut : optIn}>
            {subscribed ? t('perfil.deactivate') : t('perfil.activate')}
          </button>
        </div>
      )}
      {!supported && needsInstall && (
        <div className="flex items-center gap-2 text-sm">
          <BellIcon className="w-4 h-4" />
          {t('perfil.pushNotifications')}
        </div>
      )}
      {needsInstall && <p className="text-xs text-ink-900/50 dark:text-cream-100/50 mt-2">{t('perfil.iosHint')}</p>}
    </div>
  )
}

function SecurityCard({ changePassword, logout, removeMember, membership, userId, floorName, showToast, t }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState('')

  async function handleChangePassword(e) {
    e.preventDefault()
    setPasswordError('')
    if (!PASSWORD_RULE.test(newPassword)) {
      setPasswordError(t('perfil.passwordRuleError'))
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t('perfil.passwordMismatch'))
      return
    }
    setChangingPassword(true)
    try {
      await changePassword(currentPassword, newPassword)
      showToast(t('perfil.passwordUpdatedToast'), 'success')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setPasswordError(err.message)
    } finally {
      setChangingPassword(false)
    }
  }

  function handleLeaveFloor() {
    if (!membership) return
    if (confirm(t('perfil.leaveFloorConfirm', { floorName }))) {
      removeMember(membership.id, userId)
    }
  }

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4">
        <LockIcon className="w-4 h-4 text-ink-900/50 dark:text-cream-100/50" />
        <h2 className="font-display font-semibold">{t('perfil.securityTitle')}</h2>
      </div>

      <form onSubmit={handleChangePassword} className="flex flex-col gap-3 mb-5">
        <p className="text-sm font-medium">{t('perfil.changePasswordTitle')}</p>
        <input
          type="password"
          className="input"
          placeholder={t('perfil.currentPasswordPlaceholder')}
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
        />
        <input
          type="password"
          className="input"
          placeholder={t('perfil.newPasswordPlaceholder')}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
        />
        <input
          type="password"
          className="input"
          placeholder={t('perfil.confirmPasswordPlaceholder')}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />
        <p className="text-xs text-ink-900/40 dark:text-cream-100/40">{t('perfil.passwordHint')}</p>
        {passwordError && <p className="text-sm font-medium text-clay-500">{passwordError}</p>}
        <button className="btn-secondary text-sm self-start" type="submit" disabled={changingPassword}>
          {changingPassword ? t('perfil.updatingPassword') : t('perfil.updatePassword')}
        </button>
      </form>

      <PollPinSection showToast={showToast} t={t} />

      <div className="flex flex-wrap gap-2 pt-4 border-t border-ink-900/10 dark:border-cream-100/15">
        <button type="button" className="btn-secondary text-sm" onClick={logout}>
          {t('perfil.logout')}
        </button>
        {membership && (
          <button type="button" className="btn-danger text-sm" onClick={handleLeaveFloor}>
            {t('perfil.leaveFloor')}
          </button>
        )}
      </div>
    </div>
  )
}

/** PIN personal de 6 dígitos para votar consultas desde un link, sin iniciar
 * sesión (ver PublicPoll.jsx). Se guarda cifrado en la base; cambiarlo cierra
 * la sesión de los móviles recordados. */
function PollPinSection({ showToast, t }) {
  const [hasPin, setHasPin] = useState(null)
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    hasPollPin()
      .then((value) => active && setHasPin(Boolean(value)))
      .catch((err) => console.error('has_poll_pin', err))
    return () => {
      active = false
    }
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!isValidPin(pin)) {
      setError(t('ajustes.pin.errFormat'))
      return
    }
    if (pin !== confirmPin) {
      setError(t('ajustes.pin.errMismatch'))
      return
    }
    setSaving(true)
    try {
      const result = await setPollPin(pin)
      if (!result?.ok) throw new Error(result?.error || 'set_poll_pin')
      showToast(t('ajustes.pin.savedToast'), 'success')
      setHasPin(true)
      setPin('')
      setConfirmPin('')
    } catch (err) {
      console.error('set_poll_pin', err)
      setError(t('ajustes.pin.errGeneric'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 mb-5 pb-5 border-b border-ink-900/10 dark:border-cream-100/15">
      <p className="text-sm font-medium">{t('ajustes.pin.title')}</p>
      <p className="text-xs text-ink-900/60 dark:text-cream-100/60">{t('ajustes.pin.body')}</p>
      {hasPin && <p className="text-xs font-semibold text-sage-500">{t('ajustes.pin.hasPin')}</p>}
      <input
        type="password"
        inputMode="numeric"
        autoComplete="off"
        maxLength={6}
        className="input"
        placeholder={t(hasPin ? 'ajustes.pin.newPlaceholder' : 'ajustes.pin.placeholder')}
        value={pin}
        onChange={(e) => setPin(cleanPinInput(e.target.value))}
        required
      />
      <input
        type="password"
        inputMode="numeric"
        autoComplete="off"
        maxLength={6}
        className="input"
        placeholder={t('ajustes.pin.confirmPlaceholder')}
        value={confirmPin}
        onChange={(e) => setConfirmPin(cleanPinInput(e.target.value))}
        required
      />
      {hasPin && <p className="text-xs text-ink-900/40 dark:text-cream-100/40">{t('ajustes.pin.changeNote')}</p>}
      {error && <p className="text-sm font-medium text-clay-500">{error}</p>}
      <button className="btn-secondary text-sm self-start" type="submit" disabled={saving}>
        {saving ? t('ajustes.pin.saving') : t(hasPin ? 'ajustes.pin.change' : 'ajustes.pin.save')}
      </button>
    </form>
  )
}

/** Eliminar cuenta: 1) verifica la contraseña actual (sin tocar nada
 * todavía, para que un error acá no deje pasos irreversibles a medias),
 * 2) si soy admin único con otros miembros activos, paso la posta,
 * 3) dejo el piso (mismo flujo que "Dejar el piso"), 4) anonimizo mi
 * perfil, 5) baneo la cuenta (Edge Function) y cierro sesión. */
function DangerZoneCard({ user, membership, floor, members, removeMember, setMemberRole, updateProfile, verifyPassword, banAccount, logout, showToast, t }) {
  const [password, setPassword] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  async function handleDelete(e) {
    e.preventDefault()
    setError('')
    if (!confirm(t('ajustes.deleteAccountConfirmDialog'))) return
    setDeleting(true)
    try {
      await verifyPassword(password)

      if (membership?.role === 'admin') {
        const others = members.filter((m) => m.id !== user.id && !m.isVirtual)
        const anotherAdmin = others.find((m) => m.role === 'admin')
        if (others.length > 0 && !anotherAdmin) {
          const rotationOrder = floor?.rotationOrder || []
          const nextAdmin = rotationOrder.map((id) => others.find((m) => m.id === id)).find(Boolean) || others[0]
          if (nextAdmin) await setMemberRole(nextAdmin.membershipId, 'admin')
        }
      }

      if (membership) {
        await removeMember(membership.id, user.id)
      }

      await updateProfile(user.id, {
        name: t('ajustes.deletedAccountName'),
        nickname: null,
        age: null,
        phone: null,
        interests: null,
        occupation: null,
        allergies: null,
        presentationMessage: null,
        color: null,
        avatarUrl: null
      })

      await banAccount()
      await logout()
    } catch (err) {
      showToast(t('ajustes.deleteAccountErrorToast', { error: err.message }), 'default')
      setError(err.message)
      setDeleting(false)
    }
  }

  return (
    <div className="card p-5 border-clay-500/50">
      <div className="flex items-center gap-2 mb-1">
        <AlertIcon className="w-4 h-4 text-clay-500" />
        <h2 className="font-display font-semibold text-clay-500">{t('ajustes.dangerZoneTitle')}</h2>
      </div>
      <p className="text-sm font-medium mt-3">{t('ajustes.deleteAccountTitle')}</p>
      <p className="text-xs text-ink-900/50 dark:text-cream-100/50 mt-1 mb-3">{t('ajustes.deleteAccountBody')}</p>
      <form onSubmit={handleDelete} className="flex flex-col gap-2">
        <input
          type="password"
          className="input text-sm"
          placeholder={t('ajustes.deleteAccountConfirmPasswordPlaceholder')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <p className="text-sm font-medium text-clay-500">{error}</p>}
        <button type="submit" className="btn-danger text-sm self-start" disabled={deleting || !password}>
          {deleting ? t('ajustes.deletingAccount') : t('ajustes.deleteAccountButton')}
        </button>
      </form>
    </div>
  )
}

function AboutCard({ t }) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4">
        <InfoIcon className="w-4 h-4 text-ink-900/50 dark:text-cream-100/50" />
        <h2 className="font-display font-semibold">{t('ajustes.aboutTitle')}</h2>
      </div>
      <div className="flex flex-col gap-2.5 text-sm">
        <p className="text-ink-900/50 dark:text-cream-100/50">{t('ajustes.appVersion', { version: APP_VERSION })}</p>
        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className="flex items-center gap-1.5 font-semibold text-violet-500 hover:underline w-fit"
        >
          <MailIcon className="w-3.5 h-3.5" />
          {t('ajustes.helpSupport')}
        </a>
        <Link to="/terminos" className="font-semibold text-violet-500 hover:underline w-fit">
          {t('ajustes.termsLink')}
        </Link>
        <Link to="/privacidad" className="font-semibold text-violet-500 hover:underline w-fit">
          {t('ajustes.privacyLink')}
        </Link>
      </div>
    </div>
  )
}
