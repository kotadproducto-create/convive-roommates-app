import { useState } from 'react'
import AppLayout from '../components/AppLayout'
import Reveal from '../components/Reveal'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import { CoinIcon, SunIcon, HomeIcon, PhoneIcon, EditIcon, CloseIcon, PlusIcon, MinusIcon } from '../components/icons'
import { formatDistanceToNowStrict } from 'date-fns'
import { es } from 'date-fns/locale'

export default function Convives() {
  const { user, membership } = useAuth()
  const { members } = useData()
  const isAdmin = membership?.role === 'admin'
  const [editing, setEditing] = useState(null)

  return (
    <AppLayout title="Convives">
      <div className="mb-5">
        <h2 className="font-display text-lg font-bold">Quiénes viven aquí</h2>
        <p className="text-sm text-ink-900/60 dark:text-cream-100/60">
          El registro de todos los que comparten el piso contigo.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {members.map((m, i) => (
          <Reveal key={m.id} delay={i * 60}>
            <ConviveCard
              member={m}
              currentUserId={user.id}
              isAdmin={isAdmin}
              onEdit={() => setEditing(m)}
            />
          </Reveal>
        ))}
      </div>

      {editing && <EditModal member={editing} onClose={() => setEditing(null)} />}
    </AppLayout>
  )
}

function timeInFloor(joinedAt) {
  if (!joinedAt) return null
  return formatDistanceToNowStrict(new Date(joinedAt), { locale: es })
}

function ConviveCard({ member, currentUserId, isAdmin, onEdit }) {
  const { setMemberPotActive, setMemberActiveStatus } = useData()
  const [adjusting, setAdjusting] = useState(false)

  const isSelf = member.id === currentUserId
  const canManage = isSelf || isAdmin
  const onVacation = member.potActive === false
  const isActive = member.activeStatus !== false

  function toggleVacation() {
    setMemberPotActive(member.membershipId, onVacation)
  }

  function toggleActive() {
    setMemberActiveStatus(member.membershipId, !isActive)
  }

  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-full bg-gold-400 border-2 border-ink-900 text-ink-900 flex items-center justify-center text-base font-bold shrink-0">
            {member.name?.[0]?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="font-display font-bold truncate">
              {member.name}
              {isSelf && <span className="text-xs font-normal text-ink-900/40 dark:text-cream-100/40"> (tú)</span>}
            </p>
            {member.nickname && (
              <p className="text-xs text-ink-900/50 dark:text-cream-100/50 truncate">@{member.nickname}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {member.role === 'admin' && (
            <span className="text-[10px] uppercase font-bold text-violet-500 bg-violet-50 dark:bg-violet-700/25 px-1.5 py-0.5 rounded-md">
              admin
            </span>
          )}
          {isSelf && (
            <button onClick={onEdit} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-cream-200 dark:hover:bg-ink-700" title="Editar mi perfil">
              <EditIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <p className="text-sm text-ink-900/70 dark:text-cream-100/70 min-h-[2.5em]">
        {member.presentationMessage || <span className="text-ink-900/35 dark:text-cream-100/35 italic">Sin bio todavía.</span>}
      </p>

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          disabled={!canManage}
          onClick={toggleActive}
          className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full transition-colors ${
            isActive
              ? 'bg-sage-500/15 text-sage-500'
              : 'bg-ink-900/10 dark:bg-cream-100/10 text-ink-900/50 dark:text-cream-100/50'
          } ${canManage ? 'active:scale-95' : 'cursor-default'}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-sage-500' : 'bg-ink-900/30 dark:bg-cream-100/30'}`} />
          {isActive ? 'Activo' : 'Inactivo'}
        </button>
        <button
          type="button"
          disabled={!canManage}
          onClick={toggleVacation}
          className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full transition-colors ${
            onVacation ? 'bg-gold-400/20 text-gold-500' : 'bg-violet-500/10 text-violet-500'
          } ${canManage ? 'active:scale-95' : 'cursor-default'}`}
        >
          {onVacation ? <SunIcon className="w-3 h-3" /> : <HomeIcon className="w-3 h-3" />}
          {onVacation ? 'De vacaciones' : 'En el piso'}
        </button>
      </div>

      <div className="flex items-center justify-between text-xs text-ink-900/50 dark:text-cream-100/50 border-t border-ink-900/10 dark:border-cream-100/15 pt-3">
        <div className="flex flex-col gap-1">
          {member.age && <span>{member.age} años</span>}
          {timeInFloor(member.joinedAt) && <span>Vive aquí desde hace {timeInFloor(member.joinedAt)}</span>}
          {member.phone && (
            <a href={`tel:${member.phone}`} className="flex items-center gap-1 text-violet-500 hover:underline">
              <PhoneIcon className="w-3 h-3" />{member.phone}
            </a>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="flex items-center gap-1 font-semibold text-sm text-ink-900 dark:text-cream-100">
            <CoinIcon className="w-4 h-4 text-gold-500" />{member.points || 0}
          </span>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setAdjusting((s) => !s)}
              className="text-[11px] font-semibold text-violet-500 hover:underline"
            >
              Ajustar
            </button>
          )}
        </div>
      </div>

      {adjusting && (
        <PointsAdjustForm
          member={member}
          onDone={() => setAdjusting(false)}
        />
      )}
    </div>
  )
}

function PointsAdjustForm({ member, onDone }) {
  const { adjustMemberPoints } = useData()
  const { showToast } = useToast()
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')

  async function submit(sign) {
    const n = Number(amount)
    if (!n || n <= 0) return
    await adjustMemberPoints(member.id, sign * n, reason.trim() || null)
    showToast(`${sign > 0 ? 'Otorgaste' : 'Restaste'} ${n} Convis a ${member.name}`, 'success')
    onDone()
  }

  return (
    <div className="flex flex-col gap-2 pt-1 border-t border-ink-900/10 dark:border-cream-100/15">
      <input
        type="number"
        min="1"
        className="input text-sm"
        placeholder="Cantidad"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <input
        type="text"
        className="input text-sm"
        placeholder="Motivo (opcional)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <div className="flex gap-2">
        <button type="button" onClick={() => submit(1)} className="btn-secondary text-xs flex-1 flex items-center justify-center gap-1">
          <PlusIcon className="w-3.5 h-3.5" />Otorgar
        </button>
        <button type="button" onClick={() => submit(-1)} className="btn-secondary text-xs flex-1 flex items-center justify-center gap-1">
          <MinusIcon className="w-3.5 h-3.5" />Restar
        </button>
      </div>
    </div>
  )
}

function EditModal({ member, onClose }) {
  const { updateProfile } = useData()
  const { showToast } = useToast()
  const [nickname, setNickname] = useState(member.nickname || '')
  const [bio, setBio] = useState(member.presentationMessage || '')
  const [age, setAge] = useState(member.age || '')
  const [phone, setPhone] = useState(member.phone || '')
  const [saving, setSaving] = useState(false)

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await updateProfile(member.id, {
        nickname: nickname.trim() || null,
        presentationMessage: bio.trim() || null,
        age: age ? Number(age) : null,
        phone: phone.trim() || null
      })
      showToast('Perfil actualizado', 'success')
      onClose()
    } catch (err) {
      showToast('No se pudo guardar: ' + err.message, 'default')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 bg-ink-900/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <form
        onSubmit={handleSave}
        onClick={(e) => e.stopPropagation()}
        className="card p-5 w-full max-w-sm flex flex-col gap-3"
      >
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-display font-bold text-lg">Editar mi perfil</h3>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-cream-200 dark:hover:bg-ink-700">
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>

        <label className="text-sm">
          Apodo
          <input className="input mt-1" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="Cómo te dicen" />
        </label>

        <label className="text-sm">
          Bio
          <textarea
            className="input mt-1 min-h-20"
            value={bio}
            maxLength={240}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Cuéntale algo de ti a tus roommates"
          />
          <span className="text-xs text-ink-900/40 dark:text-cream-100/40">{bio.length}/240</span>
        </label>

        <label className="text-sm">
          Edad
          <input type="number" min="1" max="129" className="input mt-1" value={age} onChange={(e) => setAge(e.target.value)} />
        </label>

        <label className="text-sm">
          Teléfono
          <input type="tel" className="input mt-1" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Opcional" />
        </label>

        <button className="btn-primary text-sm mt-2" type="submit" disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </form>
    </div>
  )
}
