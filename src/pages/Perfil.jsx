import { useEffect, useState } from 'react'
import AppLayout from '../components/AppLayout'
import Reveal from '../components/Reveal'
import Avatar from '../components/Avatar'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { useTheme } from '../context/ThemeContext'
import { usePush } from '../context/PushContext'
import { useToast } from '../context/ToastContext'
import { getFloorHistory } from '../lib/db'
import { CameraIcon, LockIcon, MoonIcon, SunIcon, AlertIcon, BellIcon } from '../components/icons'
import { format, formatDistanceToNowStrict } from 'date-fns'
import { es } from 'date-fns/locale'

const PASSWORD_RULE = /^(?=.*[A-Z])(?=.*\d).{8,}$/

export default function Perfil() {
  const { user, email, membership, floor, changePassword, logout, refresh } = useAuth()
  const { updateProfile, removeMember, members, potContributions } = useData()
  const { showToast } = useToast()

  if (!user) return null

  return (
    <AppLayout title="Perfil">
      <div className="flex flex-col gap-5 max-w-2xl">
        {membership?.removalRequestedBy && (
          <Reveal>
            <RemovalPendingCard
              floorName={floor?.name}
              membership={membership}
              userId={user.id}
              members={members}
              potContributions={potContributions}
              removeMember={removeMember}
              showToast={showToast}
            />
          </Reveal>
        )}
        <Reveal>
          <ProfileHeader user={user} email={email} membership={membership} floor={floor} onSaved={refresh} />
        </Reveal>
        <Reveal delay={60}>
          <PersonalInfoCard user={user} updateProfile={updateProfile} showToast={showToast} onSaved={refresh} />
        </Reveal>
        <Reveal delay={120}>
          <AccountCard user={user} email={email} membership={membership} floor={floor} />
        </Reveal>
        <Reveal delay={180}>
          <SecurityCard
            changePassword={changePassword}
            logout={logout}
            removeMember={removeMember}
            membership={membership}
            userId={user.id}
            floorName={floor?.name}
            showToast={showToast}
          />
        </Reveal>
        <Reveal delay={220}>
          <PreferencesCard />
        </Reveal>
      </div>
    </AppLayout>
  )
}

function RemovalPendingCard({ floorName, membership, userId, members, potContributions, removeMember, showToast }) {
  const [confirming, setConfirming] = useState(false)

  const activeMembers = members.filter((m) => m.potActive !== false)
  const aportes = potContributions.filter((c) => Number(c.amount) > 0)
  const myContributed = aportes.filter((c) => c.userId === userId).reduce((sum, c) => sum + Number(c.amount), 0)
  const totalAmongActive = aportes
    .filter((c) => activeMembers.some((m) => m.id === c.userId))
    .reduce((sum, c) => sum + Number(c.amount), 0)
  const fairShare = activeMembers.length ? totalAmongActive / activeMembers.length : 0
  const balance = myContributed - fairShare

  async function handleConfirm() {
    if (!confirm(`¿Confirmas tu salida de ${floorName}? Perderás acceso a todas las funcionalidades y tu información quedará archivada.`)) {
      return
    }
    setConfirming(true)
    try {
      await removeMember(membership.id, userId)
      showToast('Saliste del piso', 'default')
    } catch (err) {
      showToast('No se pudo procesar la salida: ' + err.message, 'default')
      setConfirming(false)
    }
  }

  return (
    <div className="card p-5 border-clay-500/50">
      <div className="flex items-start gap-3">
        <AlertIcon className="w-5 h-5 text-clay-500 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h2 className="font-display font-semibold text-clay-500">Salida pendiente de confirmación</h2>
          <p className="text-sm text-ink-900/70 dark:text-cream-100/70 mt-1">
            Un administrador ha iniciado tu salida de <strong>{floorName}</strong>. Debes confirmarla para que se
            haga efectiva; tus responsabilidades se reasignarán automáticamente.
          </p>
          <div className="text-sm bg-cream-100 dark:bg-ink-700 rounded-xl px-3 py-2.5 mt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-900/40 dark:text-cream-100/40 mb-1">
              Tu saldo en el pote de dinero
            </p>
            <p>
              Aportaste <strong>{myContributed.toFixed(2)}€</strong>, tu parte equitativa era{' '}
              <strong>{fairShare.toFixed(2)}€</strong> — saldo final:{' '}
              <strong className={balance >= 0 ? 'text-sage-500' : 'text-clay-500'}>
                {balance > 0 ? '+' : ''}
                {balance.toFixed(2)}€
              </strong>
            </p>
            <p className="text-xs text-ink-900/40 dark:text-cream-100/40 mt-1">
              La app no transfiere dinero real: si corresponde, liquídalo con el piso por fuera (efectivo, Bizum, etc.).
            </p>
          </div>
          <button type="button" className="btn-danger text-sm mt-3" onClick={handleConfirm} disabled={confirming}>
            {confirming ? 'Procesando…' : 'Confirmar salida'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ProfileHeader({ user, email, membership, floor, onSaved }) {
  const { updateProfile } = useData()
  const { showToast } = useToast()
  const [uploading, setUploading] = useState(false)

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      await updateProfile(user.id, { avatarFile: file })
      await onSaved()
      showToast('Foto de perfil actualizada', 'success')
    } catch (err) {
      showToast('No se pudo subir la foto: ' + err.message, 'default')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="card p-5 flex items-center gap-4">
      <div className="relative shrink-0">
        <Avatar url={user.avatarUrl} name={user.name} size="w-16 h-16" textSize="text-xl" />
        <label className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-violet-500 text-cream-100 flex items-center justify-center cursor-pointer border-2 border-cream-100 dark:border-ink-900">
          <CameraIcon className="w-3.5 h-3.5" />
          <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleAvatarChange} disabled={uploading} />
        </label>
      </div>
      <div className="min-w-0">
        <p className="font-display text-xl font-bold truncate">
          {user.name}
          {user.nickname && <span className="text-base font-normal text-ink-900/50 dark:text-cream-100/50"> · @{user.nickname}</span>}
        </p>
        <p className="text-sm text-ink-900/60 dark:text-cream-100/60 truncate">{email}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] uppercase font-bold text-violet-500 bg-violet-50 dark:bg-violet-700/25 px-1.5 py-0.5 rounded-md">
            {membership?.role === 'admin' ? 'Admin' : 'Miembro'}
          </span>
          {floor && <span className="text-xs text-ink-900/40 dark:text-cream-100/40">{floor.name}</span>}
        </div>
      </div>
    </div>
  )
}

function PersonalInfoCard({ user, updateProfile, showToast, onSaved }) {
  const [name, setName] = useState(user.name || '')
  const [nickname, setNickname] = useState(user.nickname || '')
  const [age, setAge] = useState(user.age || '')
  const [agePublic, setAgePublic] = useState(user.agePublic !== false)
  const [phone, setPhone] = useState(user.phone || '')
  const [phonePublic, setPhonePublic] = useState(user.phonePublic !== false)
  const [interests, setInterests] = useState(user.interests || '')
  const [bio, setBio] = useState(user.presentationMessage || '')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      await updateProfile(user.id, {
        name: name.trim(),
        nickname: nickname.trim() || null,
        age: age ? Number(age) : null,
        agePublic,
        phone: phone.trim() || null,
        phonePublic,
        interests: interests.trim() || null,
        presentationMessage: bio.trim() || null
      })
      await onSaved()
      showToast('Perfil actualizado correctamente', 'success')
    } catch (err) {
      showToast('No se pudo guardar: ' + err.message, 'default')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card p-5 flex flex-col gap-3">
      <h2 className="font-display font-semibold mb-1">Información personal</h2>
      <p className="text-xs text-ink-900/50 dark:text-cream-100/50 -mt-2 mb-1">
        Esto es lo que ven tus compañeros de piso en tu tarjeta de Convives.
      </p>

      <label className="text-sm">
        Nombre completo
        <input className="input mt-1" value={name} onChange={(e) => setName(e.target.value)} required />
      </label>

      <label className="text-sm">
        Apodo
        <input className="input mt-1" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="Cómo te dicen" />
      </label>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="text-sm block">
            Edad
            <input type="number" min="1" max="129" className="input mt-1" value={age} onChange={(e) => setAge(e.target.value)} />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-ink-900/50 dark:text-cream-100/50 mt-1.5">
            <input type="checkbox" checked={agePublic} onChange={(e) => setAgePublic(e.target.checked)} />
            Visible para otros
          </label>
        </div>
        <div>
          <label className="text-sm block">
            Teléfono
            <input type="tel" className="input mt-1" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Opcional" />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-ink-900/50 dark:text-cream-100/50 mt-1.5">
            <input type="checkbox" checked={phonePublic} onChange={(e) => setPhonePublic(e.target.checked)} />
            Visible para otros
          </label>
        </div>
      </div>

      <label className="text-sm">
        Gustos / intereses
        <input className="input mt-1" value={interests} onChange={(e) => setInterests(e.target.value)} placeholder="Ej. Música, cine, deporte" />
      </label>

      <label className="text-sm">
        Biografía
        <textarea
          className="input mt-1 min-h-20"
          value={bio}
          maxLength={240}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Cuéntale algo de ti a tus roommates"
        />
        <span className="text-xs text-ink-900/40 dark:text-cream-100/40">{bio.length}/240</span>
      </label>

      <button className="btn-primary text-sm self-start mt-1" type="submit" disabled={saving}>
        {saving ? 'Guardando…' : 'Guardar cambios'}
      </button>
    </form>
  )
}

function AccountCard({ user, email, membership, floor }) {
  const [history, setHistory] = useState(null)

  useEffect(() => {
    let cancelled = false
    getFloorHistory(user.id).then((rows) => {
      if (!cancelled) setHistory(rows)
    })
    return () => {
      cancelled = true
    }
  }, [user.id])

  return (
    <div className="card p-5">
      <h2 className="font-display font-semibold mb-1">Cuenta</h2>
      <p className="text-xs text-ink-900/50 dark:text-cream-100/50 mb-4">Esta información es privada, solo tú la ves.</p>

      <dl className="flex flex-col gap-2.5 text-sm mb-4">
        <div className="flex justify-between">
          <dt className="text-ink-900/50 dark:text-cream-100/50">Correo electrónico</dt>
          <dd className="font-medium">{email}</dd>
        </div>
        {floor && membership?.joinedAt && (
          <div className="flex justify-between">
            <dt className="text-ink-900/50 dark:text-cream-100/50">En {floor.name} desde</dt>
            <dd className="font-medium">{format(new Date(membership.joinedAt), "d 'de' MMMM 'de' yyyy", { locale: es })}</dd>
          </div>
        )}
      </dl>

      <p className="text-xs font-semibold uppercase tracking-wide text-ink-900/40 dark:text-cream-100/40 mb-2">Historial de pisos</p>
      {history === null ? (
        <p className="text-sm text-ink-900/50 dark:text-cream-100/50">Cargando…</p>
      ) : history.length === 0 ? (
        <p className="text-sm text-ink-900/50 dark:text-cream-100/50">Sin historial todavía.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {history.map((h) => (
            <li key={h.id} className="flex items-center justify-between text-sm px-2.5 py-2 rounded-lg bg-cream-100 dark:bg-ink-700">
              <span className="min-w-0 truncate">
                <strong>{h.floorName}</strong>{' '}
                <span className="text-ink-900/50 dark:text-cream-100/50">
                  {h.status === 'active' ? '· activo ahora' : h.status === 'rejected' ? '· solicitud rechazada' : `· hasta ${h.leftAt ? format(new Date(h.leftAt), 'd MMM yyyy', { locale: es }) : '—'}`}
                </span>
              </span>
              <span className="text-xs text-ink-900/40 dark:text-cream-100/40 shrink-0 ml-2">
                {formatDistanceToNowStrict(new Date(h.joinedAt), { locale: es, addSuffix: true })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function SecurityCard({ changePassword, logout, removeMember, membership, userId, floorName, showToast }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState('')

  async function handleChangePassword(e) {
    e.preventDefault()
    setPasswordError('')
    if (!PASSWORD_RULE.test(newPassword)) {
      setPasswordError('La nueva contraseña debe tener al menos 8 caracteres, una mayúscula y un número.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Las contraseñas no coinciden.')
      return
    }
    setChangingPassword(true)
    try {
      await changePassword(currentPassword, newPassword)
      showToast('Contraseña actualizada', 'success')
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
    if (confirm(`¿Estás seguro de que quieres salir del piso ${floorName}? Perderás acceso a todas las funcionalidades y tu información será archivada.`)) {
      removeMember(membership.id, userId)
    }
  }

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4">
        <LockIcon className="w-4 h-4 text-ink-900/50 dark:text-cream-100/50" />
        <h2 className="font-display font-semibold">Seguridad</h2>
      </div>

      <form onSubmit={handleChangePassword} className="flex flex-col gap-3 mb-5">
        <p className="text-sm font-medium">Cambiar contraseña</p>
        <input
          type="password"
          className="input"
          placeholder="Contraseña actual"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
        />
        <input
          type="password"
          className="input"
          placeholder="Nueva contraseña"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
        />
        <input
          type="password"
          className="input"
          placeholder="Confirmar nueva contraseña"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />
        <p className="text-xs text-ink-900/40 dark:text-cream-100/40">Mínimo 8 caracteres, con una mayúscula y un número.</p>
        {passwordError && <p className="text-sm font-medium text-clay-500">{passwordError}</p>}
        <button className="btn-secondary text-sm self-start" type="submit" disabled={changingPassword}>
          {changingPassword ? 'Actualizando…' : 'Actualizar contraseña'}
        </button>
      </form>

      <div className="flex flex-wrap gap-2 pt-4 border-t border-ink-900/10 dark:border-cream-100/15">
        <button type="button" className="btn-secondary text-sm" onClick={logout}>
          Cerrar sesión
        </button>
        {membership && (
          <button type="button" className="btn-danger text-sm" onClick={handleLeaveFloor}>
            Dejar el piso
          </button>
        )}
      </div>
    </div>
  )
}

function PreferencesCard() {
  const { theme, toggleTheme } = useTheme()
  const { supported, subscribed, needsInstall, optIn, optOut } = usePush()

  return (
    <div className="card p-5">
      <h2 className="font-display font-semibold mb-3">Preferencias</h2>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          {theme === 'light' ? <MoonIcon className="w-4 h-4" /> : <SunIcon className="w-4 h-4" />}
          Tema {theme === 'light' ? 'claro' : 'oscuro'}
        </div>
        <button type="button" className="btn-secondary text-sm" onClick={toggleTheme}>
          Cambiar a {theme === 'light' ? 'oscuro' : 'claro'}
        </button>
      </div>

      {(supported || needsInstall) && (
        <div className="mt-4 pt-4 border-t border-ink-900/10 dark:border-cream-100/15">
          {supported && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <BellIcon className="w-4 h-4" />
                Notificaciones push {subscribed ? 'activadas' : 'desactivadas'}
              </div>
              <button type="button" className="btn-secondary text-sm" onClick={subscribed ? optOut : optIn}>
                {subscribed ? 'Desactivar' : 'Activar'}
              </button>
            </div>
          )}
          {!supported && needsInstall && (
            <div className="flex items-center gap-2 text-sm">
              <BellIcon className="w-4 h-4" />
              Notificaciones push
            </div>
          )}
          {needsInstall && (
            <p className="text-xs text-ink-900/50 dark:text-cream-100/50 mt-2">
              En iPhone/iPad: primero añade Convive a tu pantalla de inicio (Compartir → "Añadir a pantalla de
              inicio") y ábrela desde ahí para poder activarlas.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
