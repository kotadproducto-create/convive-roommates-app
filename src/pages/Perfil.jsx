import { useEffect, useState } from 'react'
import AppLayout from '../components/AppLayout'
import Reveal from '../components/Reveal'
import Avatar from '../components/Avatar'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import { useLanguage } from '../context/LanguageContext'
import { getFloorHistory } from '../lib/db'
import { getMemberColor } from '../lib/roomieColors'
import { CameraIcon, AlertIcon, MailIcon } from '../components/icons'
import { format, formatDistanceToNowStrict } from 'date-fns'

/**
 * Perfil: identidad — quién sos y cómo te ven tus compañeros de piso.
 * Todo lo de "cómo funciona la app para vos" (tema, idioma,
 * notificaciones, contraseña, eliminar cuenta) vive en Ajustes.jsx.
 */
export default function Perfil() {
  const { user, email, membership, floor, updateEmail, refresh } = useAuth()
  const {
    updateProfile,
    removeMember,
    members,
    potContributions,
    myRoomPartner,
    incomingPartnerRequests,
    outgoingPartnerRequest,
    requestRoomPartner,
    acceptRoomPartner,
    rejectRoomPartner,
    cancelRoomPartner
  } = useData()
  const { showToast } = useToast()
  const { t, dateLocale } = useLanguage()

  if (!user) return null

  return (
    <AppLayout title={t('perfil.title')}>
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
              t={t}
            />
          </Reveal>
        )}
        <Reveal>
          <ProfileHeader user={user} email={email} membership={membership} floor={floor} onSaved={refresh} t={t} />
        </Reveal>
        <Reveal delay={60}>
          <PersonalInfoCard user={user} updateProfile={updateProfile} showToast={showToast} onSaved={refresh} t={t} />
        </Reveal>
        <Reveal delay={120}>
          <AccountCard
            user={user}
            email={email}
            membership={membership}
            floor={floor}
            updateEmail={updateEmail}
            showToast={showToast}
            t={t}
            dateLocale={dateLocale}
          />
        </Reveal>
        <Reveal delay={150}>
          <RoomPartnerCard
            user={user}
            members={members}
            myRoomPartner={myRoomPartner}
            incomingPartnerRequests={incomingPartnerRequests}
            outgoingPartnerRequest={outgoingPartnerRequest}
            requestRoomPartner={requestRoomPartner}
            acceptRoomPartner={acceptRoomPartner}
            rejectRoomPartner={rejectRoomPartner}
            cancelRoomPartner={cancelRoomPartner}
            showToast={showToast}
            t={t}
          />
        </Reveal>
      </div>
    </AppLayout>
  )
}

function RemovalPendingCard({ floorName, membership, userId, members, potContributions, removeMember, showToast, t }) {
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
    if (!confirm(t('perfil.confirmExitDialog', { floorName }))) {
      return
    }
    setConfirming(true)
    try {
      await removeMember(membership.id, userId)
      showToast(t('perfil.exitedToast'), 'default')
    } catch (err) {
      showToast(t('perfil.exitErrorToast', { error: err.message }), 'default')
      setConfirming(false)
    }
  }

  return (
    <div className="card p-5 border-clay-500/50">
      <div className="flex items-start gap-3">
        <AlertIcon className="w-5 h-5 text-clay-500 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h2 className="font-display font-semibold text-clay-500">{t('perfil.removalPendingTitle')}</h2>
          <p className="text-sm text-ink-900/70 dark:text-cream-100/70 mt-1">
            {t('perfil.removalPendingBody', { floorName })}
          </p>
          <div className="text-sm bg-cream-100 dark:bg-ink-700 rounded-xl px-3 py-2.5 mt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-900/40 dark:text-cream-100/40 mb-1">
              {t('perfil.potBalanceTitle')}
            </p>
            <p>
              {t('perfil.potBalanceLine', {
                contributed: myContributed.toFixed(2),
                fairShare: fairShare.toFixed(2),
                balance: `${balance > 0 ? '+' : ''}${balance.toFixed(2)}`
              })}
            </p>
            <p className="text-xs text-ink-900/40 dark:text-cream-100/40 mt-1">{t('perfil.potBalanceDisclaimer')}</p>
          </div>
          <button type="button" className="btn-danger text-sm mt-3" onClick={handleConfirm} disabled={confirming}>
            {confirming ? t('perfil.confirmingExit') : t('perfil.confirmExit')}
          </button>
        </div>
      </div>
    </div>
  )
}

function ProfileHeader({ user, email, membership, floor, onSaved, t }) {
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
      showToast(t('perfil.avatarUpdatedToast'), 'success')
    } catch (err) {
      showToast(t('perfil.avatarErrorToast', { error: err.message }), 'default')
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
            {membership?.role === 'admin' ? t('perfil.admin') : t('perfil.member')}
          </span>
          {floor && <span className="text-xs text-ink-900/40 dark:text-cream-100/40">{floor.name}</span>}
        </div>
      </div>
    </div>
  )
}

function PersonalInfoCard({ user, updateProfile, showToast, onSaved, t }) {
  const [name, setName] = useState(user.name || '')
  const [nickname, setNickname] = useState(user.nickname || '')
  const [age, setAge] = useState(user.age || '')
  const [agePublic, setAgePublic] = useState(user.agePublic !== false)
  const [phone, setPhone] = useState(user.phone || '')
  const [phonePublic, setPhonePublic] = useState(user.phonePublic !== false)
  const [interests, setInterests] = useState(user.interests || '')
  const [occupation, setOccupation] = useState(user.occupation || '')
  const [occupationPublic, setOccupationPublic] = useState(user.occupationPublic !== false)
  const [allergies, setAllergies] = useState(user.allergies || '')
  const [bio, setBio] = useState(user.presentationMessage || '')
  const [saving, setSaving] = useState(false)
  const [color, setColor] = useState(getMemberColor(user))
  const [savingColor, setSavingColor] = useState(false)

  async function handleColorChange(e) {
    const next = e.target.value
    setColor(next)
    setSavingColor(true)
    try {
      await updateProfile(user.id, { color: next })
      await onSaved()
      showToast(t('perfil.colorUpdatedToast'), 'success')
    } catch (err) {
      showToast(t('perfil.colorErrorToast', { error: err.message }), 'default')
    } finally {
      setSavingColor(false)
    }
  }

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
        occupation: occupation.trim() || null,
        occupationPublic,
        allergies: allergies.trim() || null,
        presentationMessage: bio.trim() || null
      })
      await onSaved()
      showToast(t('perfil.profileUpdatedToast'), 'success')
    } catch (err) {
      showToast(t('perfil.profileErrorToast', { error: err.message }), 'default')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card p-5 flex flex-col gap-3">
      <h2 className="font-display font-semibold mb-1">{t('perfil.personalInfoTitle')}</h2>
      <p className="text-xs text-ink-900/50 dark:text-cream-100/50 -mt-2 mb-1">{t('perfil.personalInfoSubtitle')}</p>

      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          <span
            className="block w-9 h-9 rounded-full border-2 border-ink-900 dark:border-cream-100/40"
            style={{ backgroundColor: color }}
          />
          <input
            type="color"
            value={color}
            onChange={handleColorChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            aria-label={t('perfil.yourColorAria')}
          />
        </div>
        <div className="text-sm">
          <p className="font-medium">{t('perfil.yourColor')}</p>
          <p className="text-xs text-ink-900/50 dark:text-cream-100/50">
            {savingColor ? t('perfil.savingColor') : t('perfil.colorHint')}
          </p>
        </div>
      </div>

      <label className="text-sm">
        {t('perfil.fullName')}
        <input className="input mt-1" value={name} onChange={(e) => setName(e.target.value)} required />
      </label>

      <label className="text-sm">
        {t('perfil.nickname')}
        <input className="input mt-1" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder={t('perfil.nicknamePlaceholder')} />
      </label>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="text-sm block">
            {t('perfil.age')}
            <input type="number" min="1" max="129" className="input mt-1" value={age} onChange={(e) => setAge(e.target.value)} />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-ink-900/50 dark:text-cream-100/50 mt-1.5">
            <input type="checkbox" checked={agePublic} onChange={(e) => setAgePublic(e.target.checked)} />
            {t('perfil.visibleToOthers')}
          </label>
        </div>
        <div>
          <label className="text-sm block">
            {t('perfil.phone')}
            <input type="tel" className="input mt-1" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t('perfil.phonePlaceholder')} />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-ink-900/50 dark:text-cream-100/50 mt-1.5">
            <input type="checkbox" checked={phonePublic} onChange={(e) => setPhonePublic(e.target.checked)} />
            {t('perfil.visibleToOthers')}
          </label>
        </div>
      </div>

      <label className="text-sm">
        {t('perfil.interests')}
        <input className="input mt-1" value={interests} onChange={(e) => setInterests(e.target.value)} placeholder={t('perfil.interestsPlaceholder')} />
      </label>

      <div>
        <label className="text-sm block">
          {t('perfil.occupation')}
          <input
            className="input mt-1"
            value={occupation}
            onChange={(e) => setOccupation(e.target.value)}
            placeholder={t('perfil.occupationPlaceholder')}
          />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-ink-900/50 dark:text-cream-100/50 mt-1.5">
          <input type="checkbox" checked={occupationPublic} onChange={(e) => setOccupationPublic(e.target.checked)} />
          {t('perfil.visibleToOthers')}
        </label>
      </div>

      <div>
        <label className="text-sm block">
          {t('perfil.allergies')}
          <input
            className="input mt-1"
            value={allergies}
            onChange={(e) => setAllergies(e.target.value)}
            placeholder={t('perfil.allergiesPlaceholder')}
          />
        </label>
        <p className="text-xs text-ink-900/50 dark:text-cream-100/50 mt-1.5">{t('perfil.allergiesHint')}</p>
      </div>

      <label className="text-sm">
        {t('perfil.bio')}
        <textarea
          className="input mt-1 min-h-20"
          value={bio}
          maxLength={240}
          onChange={(e) => setBio(e.target.value)}
          placeholder={t('perfil.bioPlaceholder')}
        />
        <span className="text-xs text-ink-900/40 dark:text-cream-100/40">{bio.length}/240</span>
      </label>

      <button className="btn-primary text-sm self-start mt-1" type="submit" disabled={saving}>
        {saving ? t('perfil.saving') : t('perfil.saveChanges')}
      </button>
    </form>
  )
}

function AccountCard({ user, email, membership, floor, updateEmail, showToast, t, dateLocale }) {
  const [history, setHistory] = useState(null)
  const [newEmail, setNewEmail] = useState('')
  const [updatingEmail, setUpdatingEmail] = useState(false)

  useEffect(() => {
    let cancelled = false
    getFloorHistory(user.id).then((rows) => {
      if (!cancelled) setHistory(rows)
    })
    return () => {
      cancelled = true
    }
  }, [user.id])

  async function handleUpdateEmail(e) {
    e.preventDefault()
    if (!newEmail.trim()) return
    setUpdatingEmail(true)
    try {
      await updateEmail(newEmail.trim())
      showToast(t('perfil.emailUpdateRequestedToast'), 'success')
      setNewEmail('')
    } catch (err) {
      showToast(t('perfil.emailUpdateErrorToast', { error: err.message }), 'default')
    } finally {
      setUpdatingEmail(false)
    }
  }

  return (
    <div className="card p-5">
      <h2 className="font-display font-semibold mb-1">{t('perfil.accountTitle')}</h2>
      <p className="text-xs text-ink-900/50 dark:text-cream-100/50 mb-4">{t('perfil.accountSubtitle')}</p>

      <dl className="flex flex-col gap-2.5 text-sm mb-4">
        <div className="flex justify-between">
          <dt className="text-ink-900/50 dark:text-cream-100/50">{t('perfil.email')}</dt>
          <dd className="font-medium">{email}</dd>
        </div>
        {floor && membership?.joinedAt && (
          <div className="flex justify-between">
            <dt className="text-ink-900/50 dark:text-cream-100/50">{t('perfil.inFloorSince', { floorName: floor.name })}</dt>
            <dd className="font-medium">{format(new Date(membership.joinedAt), t('perfil.longDateFormat'), { locale: dateLocale })}</dd>
          </div>
        )}
      </dl>

      <form onSubmit={handleUpdateEmail} className="flex flex-col gap-2 mb-4 pt-4 border-t border-ink-900/10 dark:border-cream-100/15">
        <p className="text-sm font-medium flex items-center gap-1.5">
          <MailIcon className="w-4 h-4 shrink-0" />
          {t('perfil.changeEmailTitle')}
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="email"
            className="input text-sm flex-1"
            placeholder={t('perfil.newEmailPlaceholder')}
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
          />
          <button type="submit" className="btn-secondary text-sm shrink-0" disabled={updatingEmail || !newEmail.trim()}>
            {updatingEmail ? t('perfil.updatingEmail') : t('perfil.updateEmailButton')}
          </button>
        </div>
      </form>

      <p className="text-xs font-semibold uppercase tracking-wide text-ink-900/40 dark:text-cream-100/40 mb-2">{t('perfil.floorHistoryTitle')}</p>
      {history === null ? (
        <p className="text-sm text-ink-900/50 dark:text-cream-100/50">{t('perfil.loading')}</p>
      ) : history.length === 0 ? (
        <p className="text-sm text-ink-900/50 dark:text-cream-100/50">{t('perfil.noHistoryYet')}</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {history.map((h) => (
            <li key={h.id} className="flex items-center justify-between text-sm px-2.5 py-2 rounded-lg bg-cream-100 dark:bg-ink-700">
              <span className="min-w-0 truncate">
                <strong>{h.floorName}</strong>{' '}
                <span className="text-ink-900/50 dark:text-cream-100/50">
                  {h.status === 'active'
                    ? t('perfil.activeNow')
                    : h.status === 'rejected'
                    ? t('perfil.rejectedRequest')
                    : t('perfil.untilDate', { date: h.leftAt ? format(new Date(h.leftAt), 'd MMM yyyy', { locale: dateLocale }) : '—' })}
                </span>
              </span>
              <span className="text-xs text-ink-900/40 dark:text-cream-100/40 shrink-0 ml-2">
                {formatDistanceToNowStrict(new Date(h.joinedAt), { locale: dateLocale, addSuffix: true })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function RoomPartnerCard({
  user,
  members,
  myRoomPartner,
  incomingPartnerRequests,
  outgoingPartnerRequest,
  requestRoomPartner,
  acceptRoomPartner,
  rejectRoomPartner,
  cancelRoomPartner,
  showToast,
  t
}) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [selected, setSelected] = useState('')
  const otherMembers = members.filter((m) => m.id !== user.id)
  const outgoingTarget = outgoingPartnerRequest
    ? members.find((m) => m.id === outgoingPartnerRequest.partnerId)
    : null

  async function handleInvite() {
    if (!selected) return
    await requestRoomPartner(selected)
    showToast(t('perfil.invitedToast'), 'success')
    setPickerOpen(false)
    setSelected('')
  }

  return (
    <div className="card p-5">
      <h2 className="font-display font-semibold mb-1">{t('perfil.roomPartnerTitle')}</h2>
      <p className="text-sm text-ink-900/60 dark:text-cream-100/60 mb-3">{t('perfil.roomPartnerSubtitle')}</p>

      {myRoomPartner?.member && (
        <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-cream-100 dark:bg-ink-700">
          <div className="flex items-center gap-2 min-w-0">
            <Avatar url={myRoomPartner.member.avatarUrl} name={myRoomPartner.member.name} size="w-8 h-8" />
            <span className="text-sm font-medium truncate">{myRoomPartner.member.name}</span>
          </div>
          <button
            onClick={() => cancelRoomPartner(myRoomPartner.requestId)}
            className="text-xs font-semibold text-clay-500 hover:underline shrink-0 ml-2"
          >
            {t('perfil.unlink')}
          </button>
        </div>
      )}

      {incomingPartnerRequests.map((r) => {
        const requester = members.find((m) => m.id === r.requesterId)
        return (
          <div
            key={r.id}
            className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-gold-100 dark:bg-gold-400/15 mt-2"
          >
            <span className="text-sm min-w-0">
              {t('perfil.invitedYou', { name: requester?.name || t('perfil.someone') })}
            </span>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => rejectRoomPartner(r.id)} className="btn-danger text-xs px-3 py-1.5">
                {t('perfil.reject')}
              </button>
              <button onClick={() => acceptRoomPartner(r.id)} className="btn-primary text-xs px-3 py-1.5">
                {t('perfil.accept')}
              </button>
            </div>
          </div>
        )
      })}

      {outgoingPartnerRequest && (
        <div className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-cream-100 dark:bg-ink-700 mt-2">
          <span className="text-sm">{t('perfil.waitingConfirm', { name: outgoingTarget?.name || t('perfil.theOtherPerson') })}</span>
          <button
            onClick={() => cancelRoomPartner(outgoingPartnerRequest.id)}
            className="text-xs font-semibold text-violet-500 hover:underline shrink-0"
          >
            {t('perfil.cancelInvite')}
          </button>
        </div>
      )}

      {!myRoomPartner?.member &&
        !outgoingPartnerRequest &&
        (otherMembers.length === 0 ? (
          <p className="text-sm text-ink-900/50 dark:text-cream-100/50">{t('perfil.noMoreMembers')}</p>
        ) : pickerOpen ? (
          <div className="flex flex-col gap-2 mt-2">
            <select className="input" value={selected} onChange={(e) => setSelected(e.target.value)}>
              <option value="">{t('perfil.chooseRoommate')}</option>
              {otherMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <button type="button" className="btn-secondary text-sm" onClick={() => setPickerOpen(false)}>
                {t('perfil.cancel')}
              </button>
              <button type="button" className="btn-primary text-sm" onClick={handleInvite} disabled={!selected}>
                {t('perfil.invite')}
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn-secondary text-sm" onClick={() => setPickerOpen(true)}>
            {t('perfil.addSomeone')}
          </button>
        ))}
    </div>
  )
}
