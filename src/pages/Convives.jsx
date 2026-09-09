import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import Reveal from '../components/Reveal'
import Avatar from '../components/Avatar'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import { useLanguage } from '../context/LanguageContext'
import { currentPeriodKey } from '../lib/activities'
import { getMemberColor } from '../lib/roomieColors'
import { CoinIcon, SunIcon, HomeIcon, PhoneIcon, EditIcon, PlusIcon, MinusIcon, ChevronDownIcon } from '../components/icons'
import { formatDistanceToNowStrict } from 'date-fns'

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
  const { t, dateLocale } = useLanguage()
  const isAdmin = membership?.role === 'admin'

  return (
    <AppLayout title={t('nav.convives')}>
      <div className="mb-5">
        <h2 className="font-display text-lg font-bold">{t('convives.heading')}</h2>
        <p className="text-sm text-ink-900/60 dark:text-cream-100/60">{t('convives.subtitle')}</p>
      </div>

      {(incomingSwapRequests.length > 0 || outgoingSwapRequests.length > 0) && (
        <Reveal>
          <SwapRequestsBanner
            incoming={incomingSwapRequests}
            outgoing={outgoingSwapRequests}
            acceptSwap={acceptSwap}
            declineSwap={declineSwap}
            cancelSwap={cancelSwap}
            t={t}
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
              t={t}
              dateLocale={dateLocale}
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
function getPendingItems(memberId, tasks, activities, activityCompletions, weekKey, t) {
  const fixed = tasks
    .filter((task) => task.assignedUserId === memberId && !task.completed)
    .map((task) => ({ targetType: 'task', targetId: task.id, title: t(`taskTypes.${task.type}`), completion: task, activity: null }))

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
function PendingItemRow({ item, members, currentUserId, completeTask, setActivityProgress, requestSwap, hasOutgoingSwap, t }) {
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
    showToast(t('convives.swapRequestedToast'), 'success')
    setPickerOpen(false)
    setSelected('')
  }

  return (
    <div className="flex flex-col gap-1.5 px-3 py-2 rounded-xl bg-cream-100 dark:bg-ink-700">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium min-w-0 truncate">{item.title}</span>
        <div className="flex items-center gap-2 shrink-0">
          <button type="button" onClick={handleDone} className="text-xs font-semibold text-sage-500 hover:underline">
            {isStepped
              ? t('convives.markDoneStepped', { done: item.completion.timesDone || 0, target: item.activity.timesPerWeek })
              : t('convives.markDone')}
          </button>
          {!hasOutgoingSwap && otherMembers.length > 0 && (
            <button
              type="button"
              onClick={() => setPickerOpen((s) => !s)}
              className="text-xs font-semibold text-violet-500 hover:underline"
            >
              {t('convives.swap')}
            </button>
          )}
        </div>
      </div>
      {hasOutgoingSwap && <p className="text-xs text-ink-900/40 dark:text-cream-100/40">{t('convives.swapWaiting')}</p>}
      {pickerOpen && (
        <div className="flex gap-2">
          <select className="input text-sm" value={selected} onChange={(e) => setSelected(e.target.value)}>
            <option value="">{t('convives.swapWithWho')}</option>
            {otherMembers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <button type="button" className="btn-primary text-xs px-3" onClick={handleSwap} disabled={!selected}>
            {t('convives.swapPropose')}
          </button>
        </div>
      )}
    </div>
  )
}

function SwapRequestsBanner({ incoming, outgoing, acceptSwap, declineSwap, cancelSwap, t }) {
  const { showToast } = useToast()

  async function handleAccept(req) {
    const result = await acceptSwap(req.id)
    if (result?.ok === false) {
      showToast(result.message, 'default')
    } else {
      showToast(t('convives.swapAcceptedToast', { title: req.title, name: req.fromMember?.name || t('convives.swapYourRoommate') }), 'success')
    }
  }

  return (
    <div className="card p-4 mb-5 flex flex-col gap-2">
      <h3 className="font-display font-semibold text-sm">{t('convives.swapRequestsTitle')}</h3>
      {incoming.map((r) => (
        <div key={r.id} className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-gold-100 dark:bg-gold-400/15">
          <span className="text-sm min-w-0">
            {t('convives.swapIncoming', { name: r.fromMember?.name || t('convives.swapSomeone'), title: r.title })}
          </span>
          <div className="flex gap-2 shrink-0">
            <button onClick={() => declineSwap(r.id)} className="btn-danger text-xs px-3 py-1.5">
              {t('convives.swapReject')}
            </button>
            <button onClick={() => handleAccept(r)} className="btn-primary text-xs px-3 py-1.5">
              {t('convives.swapAccept')}
            </button>
          </div>
        </div>
      ))}
      {outgoing.map((r) => (
        <div key={r.id} className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-cream-100 dark:bg-ink-700">
          <span className="text-sm min-w-0">
            {t('convives.swapOutgoing', { name: r.toMember?.name || t('convives.swapYourRoommate'), title: r.title })}
          </span>
          <button onClick={() => cancelSwap(r.id)} className="text-xs font-semibold text-violet-500 hover:underline shrink-0">
            {t('convives.swapCancel')}
          </button>
        </div>
      ))}
    </div>
  )
}

function timeInFloor(joinedAt, dateLocale) {
  if (!joinedAt) return null
  return formatDistanceToNowStrict(new Date(joinedAt), { locale: dateLocale })
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
  outgoingSwapRequests,
  t,
  dateLocale
}) {
  const { setMemberPotActive, setMemberActiveStatus } = useData()
  const [adjusting, setAdjusting] = useState(false)

  const isSelf = member.id === currentUserId
  const pendingItems = getPendingItems(member.id, tasks, activities, activityCompletions, weekKey, t)
  const canManage = isSelf || isAdmin
  const onVacation = member.potActive === false
  const isActive = member.activeStatus !== false
  const showAge = member.age && (isSelf || member.agePublic !== false)
  const showPhone = member.phone && (isSelf || member.phonePublic !== false)
  const showOccupation = member.occupation && (isSelf || member.occupationPublic !== false)
  const color = getMemberColor(member)

  // Deslizar la tarjeta hacia la izquierda revela un botón para
  // expandir/colapsar "Esta semana" — mismo mecanismo de swipe-reveal
  // que ya usan las ThemeCard de Inicio (Pointer Events + un ref para
  // el estado del arrastre, para no perder clics reales en los
  // botones de adentro cuando no hubo arrastre de verdad).
  const [expanded, setExpanded] = useState(isSelf)
  const [dragX, setDragX] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const drag = useRef({ startX: 0, active: false, moved: false })

  function handlePointerDown(e) {
    drag.current = { startX: e.clientX, active: true, moved: false }
    setIsDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  function handlePointerMove(e) {
    if (!drag.current.active) return
    const delta = drag.current.startX - e.clientX
    if (Math.abs(delta) > 4) drag.current.moved = true
    setDragX(Math.min(Math.max(delta, 0), SWIPE_REVEAL))
  }
  function handlePointerUp() {
    if (!drag.current.active) return
    drag.current.active = false
    setIsDragging(false)
    setDragX((x) => (x > SWIPE_REVEAL / 2 ? SWIPE_REVEAL : 0))
  }

  function toggleVacation() {
    setMemberPotActive(member.membershipId, onVacation)
  }

  function toggleActive() {
    setMemberActiveStatus(member.membershipId, !isActive)
  }

  return (
    <div className="relative rounded-xl2 overflow-hidden border-[2.5px] border-ink-900 dark:border-cream-100/40">
      <div className="absolute inset-0 flex items-center justify-end pr-5 bg-ink-900">
        <button
          type="button"
          onClick={() => {
            setExpanded((x) => !x)
            setDragX(0)
          }}
          aria-label={t('convives.expandAria')}
          className="w-10 h-10 rounded-full border-2 border-cream-100 bg-cream-100 text-ink-900 flex items-center justify-center shrink-0"
        >
          <ChevronDownIcon className={`w-5 h-5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      </div>
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{ transform: `translateX(${-dragX}px)`, touchAction: 'pan-y' }}
        className={`relative bg-white dark:bg-ink-800 p-4 flex flex-col gap-3 ${isDragging ? '' : 'transition-transform duration-200 ease-out'}`}
      >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <span className="rounded-full p-0.5 border-2 shrink-0" style={{ borderColor: color }}>
            <Avatar url={member.avatarUrl} name={member.name} size="w-10 h-10" />
          </span>
          <div className="min-w-0">
            <p className="font-display font-bold truncate">
              {member.name}
              {isSelf && <span className="text-xs font-normal text-ink-900/40 dark:text-cream-100/40"> ({t('convives.you')})</span>}
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
              {t('convives.admin')}
            </span>
          )}
          {isSelf && (
            <Link to="/perfil" className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-cream-200 dark:hover:bg-ink-700" title={t('convives.editMyProfile')}>
              <EditIcon className="w-4 h-4" />
            </Link>
          )}
        </div>
      </div>

      <p className="text-sm text-ink-900/70 dark:text-cream-100/70 min-h-[2.5em]">
        {member.presentationMessage || <span className="text-ink-900/35 dark:text-cream-100/35 italic">{t('convives.noBio')}</span>}
      </p>

      {member.interests && (
        <p className="text-xs text-ink-900/50 dark:text-cream-100/50 -mt-2">
          <span className="font-semibold">{t('convives.likes')}</span> {member.interests}
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
          {isActive ? t('convives.active') : t('convives.inactive')}
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
          {onVacation ? t('convives.onVacation') : t('convives.inFloor')}
        </button>
      </div>

      <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          <div className="flex flex-col gap-2 pt-1 border-t border-ink-900/10 dark:border-cream-100/15 pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-900/50 dark:text-cream-100/50">{t('convives.thisWeek')}</p>
            {pendingItems.length === 0 ? (
              <p className="text-xs text-ink-900/40 dark:text-cream-100/40">{t('convives.noPendingThisWeek')}</p>
            ) : isSelf ? (
              pendingItems.map((item) => (
                <PendingItemRow
                  key={`${item.targetType}-${item.targetId}`}
                  item={item}
                  members={members}
                  currentUserId={currentUserId}
                  completeTask={completeTask}
                  setActivityProgress={setActivityProgress}
                  requestSwap={requestSwap}
                  hasOutgoingSwap={outgoingSwapRequests.some((r) => r.targetId === item.targetId)}
                  t={t}
                />
              ))
            ) : (
              <ul className="flex flex-col gap-1 text-sm text-ink-900/70 dark:text-cream-100/70">
                {pendingItems.map((item) => (
                  <li key={`${item.targetType}-${item.targetId}`} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    {item.title}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-ink-900/50 dark:text-cream-100/50 border-t border-ink-900/10 dark:border-cream-100/15 pt-3">
        <div className="flex flex-col gap-1">
          {showAge && <span>{t('convives.age', { age: member.age })}</span>}
          {timeInFloor(member.joinedAt, dateLocale) && (
            <span>{t('convives.livesHereSince', { time: timeInFloor(member.joinedAt, dateLocale) })}</span>
          )}
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
              {t('convives.adjustPoints')}
            </button>
          )}
        </div>
      </div>

      {adjusting && (
        <PointsAdjustForm
          member={member}
          onDone={() => setAdjusting(false)}
          t={t}
        />
      )}
      </div>
    </div>
  )
}

const SWIPE_REVEAL = 64

function PointsAdjustForm({ member, onDone, t }) {
  const { adjustMemberPoints } = useData()
  const { showToast } = useToast()
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')

  async function submit(sign) {
    const n = Number(amount)
    if (!n || n <= 0) return
    await adjustMemberPoints(member.id, sign * n, reason.trim() || null)
    showToast(t(sign > 0 ? 'convives.grantedToast' : 'convives.deductedToast', { amount: n, name: member.name }), 'success')
    onDone()
  }

  return (
    <div className="flex flex-col gap-2 pt-1 border-t border-ink-900/10 dark:border-cream-100/15">
      <input
        type="number"
        min="1"
        className="input text-sm"
        placeholder={t('convives.amountPlaceholder')}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <input
        type="text"
        className="input text-sm"
        placeholder={t('convives.reasonPlaceholder')}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <div className="flex gap-2">
        <button type="button" onClick={() => submit(1)} className="btn-secondary text-xs flex-1 flex items-center justify-center gap-1">
          <PlusIcon className="w-3.5 h-3.5" />{t('convives.grant')}
        </button>
        <button type="button" onClick={() => submit(-1)} className="btn-secondary text-xs flex-1 flex items-center justify-center gap-1">
          <MinusIcon className="w-3.5 h-3.5" />{t('convives.deduct')}
        </button>
      </div>
    </div>
  )
}
