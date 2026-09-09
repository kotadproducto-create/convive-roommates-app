import { useState } from 'react'
import { Link } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import Reveal from '../components/Reveal'
import Avatar from '../components/Avatar'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import { TASK_LABEL } from '../lib/rotation'
import { currentPeriodKey } from '../lib/activities'
import { CoinIcon, SunIcon, HomeIcon, PhoneIcon, EditIcon, PlusIcon, MinusIcon } from '../components/icons'
import { formatDistanceToNowStrict } from 'date-fns'
import { es } from 'date-fns/locale'

export default function Convives() {
  const { user, membership } = useAuth()
  const {
    members,
    tasks,
    weekKey,
    activities,
    activityCompletions,
    completeTask,
    setActivityProgress,
    incomingSwapRequests,
    outgoingSwapRequests,
    requestSwap,
    acceptSwap,
    declineSwap,
    cancelSwap
  } = useData()
  const isAdmin = membership?.role === 'admin'

  return (
    <AppLayout title="Convives">
      <div className="mb-5">
        <h2 className="font-display text-lg font-bold">Quiénes viven aquí</h2>
        <p className="text-sm text-ink-900/60 dark:text-cream-100/60">
          El registro de todos los que comparten el piso contigo.
        </p>
      </div>

      {(incomingSwapRequests.length > 0 || outgoingSwapRequests.length > 0) && (
        <Reveal>
          <SwapRequestsBanner
            incoming={incomingSwapRequests}
            outgoing={outgoingSwapRequests}
            acceptSwap={acceptSwap}
            declineSwap={declineSwap}
            cancelSwap={cancelSwap}
          />
        </Reveal>
      )}

      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {members.map((m, i) => (
          <Reveal key={m.id} delay={i * 60}>
            <ConviveCard
              member={m}
              currentUserId={user.id}
              isAdmin={isAdmin}
              members={members}
              tasks={tasks}
              weekKey={weekKey}
              activities={activities}
              activityCompletions={activityCompletions}
              completeTask={completeTask}
              setActivityProgress={setActivityProgress}
              requestSwap={requestSwap}
              outgoingSwapRequests={outgoingSwapRequests}
            />
          </Reveal>
        ))}
      </div>
    </AppLayout>
  )
}

/** Pendientes de esta semana/período para un miembro: junta las 3
 * tareas fijas (tasks) con el período actual de cada actividad propia
 * (activityCompletions), ambas sin completar — una sola lista, con lo
 * necesario para poder marcar hecho o proponer un intercambio sobre
 * cada ítem (mismo target_type/target_id que espera requestSwap). */
function getPendingItems(memberId, tasks, activities, activityCompletions, weekKey) {
  const fixed = tasks
    .filter((t) => t.assignedUserId === memberId && !t.completed)
    .map((t) => ({ targetType: 'task', targetId: t.id, title: TASK_LABEL[t.type] || t.type, completion: t, activity: null }))

  const custom = activities
    .map((a) => {
      const period = currentPeriodKey(a, weekKey)
      const completion = activityCompletions.find((c) => c.activityId === a.id && c.periodKey === period)
      if (!completion || completion.assignedUserId !== memberId || completion.completed) return null
      return { targetType: 'activity_completion', targetId: completion.id, title: a.title, completion, activity: a }
    })
    .filter(Boolean)

  return [...fixed, ...custom]
}

/** Una fila de "Esta semana": título del turno + Marcar hecho +
 * Intercambiar (con un <select> de compañeros que se abre al tocar,
 * mismo patrón que el picker de compañero de habitación en Perfil). */
function PendingItemRow({ item, members, currentUserId, completeTask, setActivityProgress, requestSwap, hasOutgoingSwap }) {
  const { showToast } = useToast()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [selected, setSelected] = useState('')
  const otherMembers = members.filter((m) => m.id !== currentUserId)

  const isStepped = item.activity?.frequencyType === 'weekly' && (item.activity.timesPerWeek || 1) > 1

  function handleDone() {
    if (item.targetType === 'task') completeTask(item.targetId)
    else setActivityProgress(item.completion, 1)
  }

  async function handleSwap() {
    if (!selected) return
    await requestSwap({ targetType: item.targetType, targetId: item.targetId, toUserId: selected, title: item.title })
    showToast('Solicitud de intercambio enviada', 'success')
    setPickerOpen(false)
    setSelected('')
  }

  return (
    <div className="flex flex-col gap-1.5 px-3 py-2 rounded-xl bg-cream-100 dark:bg-ink-700">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium min-w-0 truncate">{item.title}</span>
        <div className="flex items-center gap-2 shrink-0">
          <button type="button" onClick={handleDone} className="text-xs font-semibold text-sage-500 hover:underline">
            {isStepped ? `+1 (${item.completion.timesDone || 0}/${item.activity.timesPerWeek})` : 'Marcar hecho'}
          </button>
          {!hasOutgoingSwap && otherMembers.length > 0 && (
            <button
              type="button"
              onClick={() => setPickerOpen((s) => !s)}
              className="text-xs font-semibold text-violet-500 hover:underline"
            >
              Intercambiar
            </button>
          )}
        </div>
      </div>
      {hasOutgoingSwap && <p className="text-xs text-ink-900/40 dark:text-cream-100/40">Esperando confirmación del intercambio.</p>}
      {pickerOpen && (
        <div className="flex gap-2">
          <select className="input text-sm" value={selected} onChange={(e) => setSelected(e.target.value)}>
            <option value="">¿Con quién?</option>
            {otherMembers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <button type="button" className="btn-primary text-xs px-3" onClick={handleSwap} disabled={!selected}>
            Proponer
          </button>
        </div>
      )}
    </div>
  )
}

function SwapRequestsBanner({ incoming, outgoing, acceptSwap, declineSwap, cancelSwap }) {
  const { showToast } = useToast()

  async function handleAccept(req) {
    const result = await acceptSwap(req.id)
    if (result?.ok === false) {
      showToast(result.message, 'default')
    } else {
      showToast(`Intercambiaste "${req.title}" con ${req.fromMember?.name || 'tu compañero'}`, 'success')
    }
  }

  return (
    <div className="card p-4 mb-5 flex flex-col gap-2">
      <h3 className="font-display font-semibold text-sm">Solicitudes de intercambio</h3>
      {incoming.map((r) => (
        <div key={r.id} className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-gold-100 dark:bg-gold-400/15">
          <span className="text-sm min-w-0">
            <strong>{r.fromMember?.name || 'Alguien'}</strong> te propone intercambiar <strong>"{r.title}"</strong>
          </span>
          <div className="flex gap-2 shrink-0">
            <button onClick={() => declineSwap(r.id)} className="btn-danger text-xs px-3 py-1.5">
              Rechazar
            </button>
            <button onClick={() => handleAccept(r)} className="btn-primary text-xs px-3 py-1.5">
              Aceptar
            </button>
          </div>
        </div>
      ))}
      {outgoing.map((r) => (
        <div key={r.id} className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-cream-100 dark:bg-ink-700">
          <span className="text-sm min-w-0">
            Esperando que <strong>{r.toMember?.name || 'tu compañero'}</strong> confirme "{r.title}"
          </span>
          <button onClick={() => cancelSwap(r.id)} className="text-xs font-semibold text-violet-500 hover:underline shrink-0">
            Anular
          </button>
        </div>
      ))}
    </div>
  )
}

function timeInFloor(joinedAt) {
  if (!joinedAt) return null
  return formatDistanceToNowStrict(new Date(joinedAt), { locale: es })
}

function ConviveCard({
  member,
  currentUserId,
  isAdmin,
  members,
  tasks,
  weekKey,
  activities,
  activityCompletions,
  completeTask,
  setActivityProgress,
  requestSwap,
  outgoingSwapRequests
}) {
  const { setMemberPotActive, setMemberActiveStatus } = useData()
  const [adjusting, setAdjusting] = useState(false)

  const isSelf = member.id === currentUserId
  const pendingItems = isSelf ? getPendingItems(member.id, tasks, activities, activityCompletions, weekKey) : []
  const canManage = isSelf || isAdmin
  const onVacation = member.potActive === false
  const isActive = member.activeStatus !== false
  const showAge = member.age && (isSelf || member.agePublic !== false)
  const showPhone = member.phone && (isSelf || member.phonePublic !== false)
  const showOccupation = member.occupation && (isSelf || member.occupationPublic !== false)

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
          <Avatar url={member.avatarUrl} name={member.name} size="w-11 h-11" />
          <div className="min-w-0">
            <p className="font-display font-bold truncate">
              {member.name}
              {isSelf && <span className="text-xs font-normal text-ink-900/40 dark:text-cream-100/40"> (tú)</span>}
            </p>
            {member.nickname && (
              <p className="text-xs text-ink-900/50 dark:text-cream-100/50 truncate">@{member.nickname}</p>
            )}
            {showOccupation && (
              <p className="text-xs font-medium text-violet-500 dark:text-violet-300 truncate">{member.occupation}</p>
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
            <Link to="/perfil" className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-cream-200 dark:hover:bg-ink-700" title="Editar mi perfil">
              <EditIcon className="w-4 h-4" />
            </Link>
          )}
        </div>
      </div>

      <p className="text-sm text-ink-900/70 dark:text-cream-100/70 min-h-[2.5em]">
        {member.presentationMessage || <span className="text-ink-900/35 dark:text-cream-100/35 italic">Sin bio todavía.</span>}
      </p>

      {member.interests && (
        <p className="text-xs text-ink-900/50 dark:text-cream-100/50 -mt-2">
          <span className="font-semibold">Le gusta:</span> {member.interests}
        </p>
      )}

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

      {isSelf && pendingItems.length > 0 && (
        <div className="flex flex-col gap-2 pt-1 border-t border-ink-900/10 dark:border-cream-100/15 pt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-900/50 dark:text-cream-100/50">Esta semana</p>
          {pendingItems.map((item) => (
            <PendingItemRow
              key={`${item.targetType}-${item.targetId}`}
              item={item}
              members={members}
              currentUserId={currentUserId}
              completeTask={completeTask}
              setActivityProgress={setActivityProgress}
              requestSwap={requestSwap}
              hasOutgoingSwap={outgoingSwapRequests.some((r) => r.targetId === item.targetId)}
            />
          ))}
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-ink-900/50 dark:text-cream-100/50 border-t border-ink-900/10 dark:border-cream-100/15 pt-3">
        <div className="flex flex-col gap-1">
          {showAge && <span>{member.age} años</span>}
          {timeInFloor(member.joinedAt) && <span>Vive aquí desde hace {timeInFloor(member.joinedAt)}</span>}
          {showPhone && (
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
    showToast(`${sign > 0 ? 'Otorgaste' : 'Restaste'} ${n} recompensas a ${member.name}`, 'success')
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
