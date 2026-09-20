import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import AppLayout from '../components/AppLayout'
import Reveal from '../components/Reveal'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import { useLanguage } from '../context/LanguageContext'
import { tallyVotes } from '../lib/polls'
import { CloseIcon, PlusIcon, ChevronUpIcon, ChevronDownIcon } from '../components/icons'

/**
 * Centro de decisiones del piso: una sola bandeja "Pendientes" que junta
 * las consultas nuevas (polls) con los 5 mecanismos que ya existían
 * repartidos en otras pantallas (unión, intercambio, ausencia, pareja de
 * habitación, salida) — cada tipo se renderiza con su propia tarjeta,
 * reusando tal cual las acciones de DataContext que ya usa su pantalla
 * original. Esas pantallas originales siguen intactas; esto es una vista
 * agregada adicional, no un reemplazo.
 */
export default function Votaciones() {
  const { user, membership } = useAuth()
  const {
    members,
    polls,
    pollVotes,
    createPoll,
    castVote,
    closePoll,
    pendingJoinRequests,
    approveJoinRequest,
    rejectJoinRequest,
    incomingSwapRequests,
    acceptSwap,
    declineSwap,
    pendingAbsenceRequests,
    decideAbsenceRequest,
    incomingPartnerRequests,
    acceptRoomPartner,
    rejectRoomPartner,
    removalPending,
    removeMember,
    rejectMyRemoval,
    cancelRemoval
  } = useData()
  const { t, dateLocale } = useLanguage()
  const { showToast } = useToast()
  const isAdmin = membership?.role === 'admin'
  const [showCreate, setShowCreate] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  const activeMemberIds = useMemo(() => members.map((m) => m.id), [members])
  const memberById = useMemo(() => Object.fromEntries(members.map((m) => [m.id, m])), [members])

  const pendingPolls = useMemo(() => polls.filter((p) => p.status === 'pending'), [polls])
  const historyPolls = useMemo(
    () =>
      polls
        .filter((p) => p.status !== 'pending')
        .sort((a, b) => new Date(b.resolvedAt || b.createdAt) - new Date(a.resolvedAt || a.createdAt)),
    [polls]
  )

  const pendingItems = useMemo(() => {
    const items = []
    for (const p of pendingPolls) {
      items.push({
        key: `poll-${p.id}`,
        createdAt: p.createdAt,
        node: (
          <PollCard
            poll={p}
            votes={pollVotes.filter((v) => v.pollId === p.id)}
            members={members}
            activeMemberIds={activeMemberIds}
            user={user}
            isAdmin={isAdmin}
            castVote={castVote}
            closePoll={closePoll}
            t={t}
            dateLocale={dateLocale}
          />
        )
      })
    }
    for (const r of pendingJoinRequests) {
      items.push({
        key: `join-${r.membershipId}`,
        createdAt: r.joinedAt,
        node: <JoinRequestCard request={r} approveJoinRequest={approveJoinRequest} rejectJoinRequest={rejectJoinRequest} t={t} />
      })
    }
    for (const r of incomingSwapRequests) {
      items.push({
        key: `swap-${r.id}`,
        createdAt: r.createdAt,
        node: <SwapRequestCard request={r} acceptSwap={acceptSwap} declineSwap={declineSwap} showToast={showToast} t={t} />
      })
    }
    for (const r of pendingAbsenceRequests) {
      items.push({
        key: `absence-${r.id}`,
        createdAt: r.createdAt,
        node: <AbsenceRequestCard request={r} memberById={memberById} decideAbsenceRequest={decideAbsenceRequest} t={t} />
      })
    }
    for (const r of incomingPartnerRequests) {
      items.push({
        key: `partner-${r.id}`,
        createdAt: r.createdAt,
        node: <PartnerRequestCard request={r} members={members} acceptRoomPartner={acceptRoomPartner} rejectRoomPartner={rejectRoomPartner} t={t} />
      })
    }
    for (const m of removalPending) {
      items.push({
        key: `removal-${m.membershipId}`,
        createdAt: m.removalRequestedAt,
        node: (
          <RemovalCard
            member={m}
            isSelf={m.id === user?.id}
            isAdmin={isAdmin}
            removeMember={removeMember}
            rejectMyRemoval={rejectMyRemoval}
            cancelRemoval={cancelRemoval}
            showToast={showToast}
            t={t}
          />
        )
      })
    }
    return items.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
  }, [
    pendingPolls,
    pollVotes,
    members,
    activeMemberIds,
    user,
    isAdmin,
    castVote,
    closePoll,
    pendingJoinRequests,
    approveJoinRequest,
    rejectJoinRequest,
    incomingSwapRequests,
    acceptSwap,
    declineSwap,
    showToast,
    pendingAbsenceRequests,
    memberById,
    decideAbsenceRequest,
    incomingPartnerRequests,
    acceptRoomPartner,
    rejectRoomPartner,
    removalPending,
    removeMember,
    rejectMyRemoval,
    cancelRemoval,
    t,
    dateLocale
  ])

  return (
    <AppLayout title={t('nav.votaciones')}>
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <h2 className="font-display text-lg font-bold">{t('votaciones.heading')}</h2>
          <p className="text-sm text-ink-900/60 dark:text-cream-100/60">{t('votaciones.subtitle')}</p>
        </div>
        <button type="button" className="btn-primary text-sm shrink-0" onClick={() => setShowCreate(true)}>
          <PlusIcon className="w-4 h-4" />
          {t('votaciones.newPoll')}
        </button>
      </div>

      <Reveal as="section" className="card p-5 mb-5">
        <h3 className="font-display font-semibold mb-3">{t('votaciones.pendingTitle')}</h3>
        {pendingItems.length === 0 ? (
          <p className="text-sm text-ink-900/50 dark:text-cream-100/50 py-4 text-center">{t('votaciones.pendingEmpty')}</p>
        ) : (
          <div className="flex flex-col gap-3">
            {pendingItems.map((item) => (
              <div key={item.key}>{item.node}</div>
            ))}
          </div>
        )}
      </Reveal>

      <Reveal as="section" className="card p-5">
        <button type="button" className="flex items-center justify-between w-full" onClick={() => setShowHistory((s) => !s)}>
          <h3 className="font-display font-semibold">{t('votaciones.historyTitle')}</h3>
          <span className="flex items-center gap-1 text-xs font-semibold text-violet-500 shrink-0">
            {showHistory ? t('votaciones.hideHistory') : t('votaciones.showHistory')}
            {showHistory ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
          </span>
        </button>
        {showHistory &&
          (historyPolls.length === 0 ? (
            <p className="text-sm text-ink-900/50 dark:text-cream-100/50 py-4 text-center">{t('votaciones.historyEmpty')}</p>
          ) : (
            <div className="flex flex-col gap-3 mt-3">
              {historyPolls.map((p) => (
                <PollCard
                  key={p.id}
                  poll={p}
                  votes={pollVotes.filter((v) => v.pollId === p.id)}
                  members={members}
                  activeMemberIds={activeMemberIds}
                  user={user}
                  isAdmin={isAdmin}
                  castVote={castVote}
                  closePoll={closePoll}
                  t={t}
                  dateLocale={dateLocale}
                />
              ))}
            </div>
          ))}
      </Reveal>

      {showCreate && <CreatePollModal onCancel={() => setShowCreate(false)} onCreate={createPoll} showToast={showToast} t={t} />}
    </AppLayout>
  )
}

const STATUS_EMOJI = { pending: '🟠', resolved: '🟢', closed: '⚪', expired: '🔴' }
const STATUS_KEY = { pending: 'statusPending', resolved: 'statusResolved', closed: 'statusClosed', expired: 'statusExpired' }

function PollCard({ poll, votes, members, activeMemberIds, user, isAdmin, castVote, closePoll, t, dateLocale }) {
  const tally = tallyVotes(votes)
  const myVote = votes.find((v) => v.userId === user?.id)?.option
  const votedIds = new Set(votes.map((v) => v.userId))
  const missingMembers = members.filter((m) => activeMemberIds.includes(m.id) && !votedIds.has(m.id))
  const votedCount = activeMemberIds.filter((id) => votedIds.has(id)).length
  const total = activeMemberIds.length
  const isPending = poll.status === 'pending'
  const canClose = isPending && (poll.createdBy === user?.id || isAdmin)
  // Reinicio de saldo para todos: cada persona decide por sí misma; aprobar
  // reinicia SU saldo al instante, así que un voto aprobado ya no se cambia.
  const isBalanceReset = poll.kind === 'balance_reset'
  const approvalLocked = isBalanceReset && myVote === 'Aprobar'

  async function handleClose() {
    if (!confirm(t('votaciones.closeConfirm'))) return
    await closePoll(poll.id)
  }

  return (
    <div className="rounded-xl border-2 border-ink-900/10 dark:border-cream-100/15 p-4">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <p className="font-semibold text-sm flex items-center gap-1.5 flex-wrap">
            <span>{STATUS_EMOJI[poll.status]}</span>
            <span className="min-w-0">{poll.question}</span>
          </p>
          <div className="flex items-center gap-2 text-xs text-ink-900/50 dark:text-cream-100/50 mt-0.5 flex-wrap">
            <span>{t(`votaciones.${STATUS_KEY[poll.status]}`)}</span>
            <span>·</span>
            <span>{isBalanceReset ? t('votaciones.modeIndividual') : poll.resolutionMode === 'unanimity' ? t('votaciones.modeUnanimity') : t('votaciones.modeMajority')}</span>
            {(poll.deadlineAt || poll.deadline) && (
              <>
                <span>·</span>
                <span>
                  {t('votaciones.deadlineLabel', {
                    date: poll.deadlineAt
                      ? format(new Date(poll.deadlineAt), 'd MMM, HH:mm', { locale: dateLocale })
                      : format(new Date(`${poll.deadline}T00:00:00`), t('calendar.dayMonthFormat'), { locale: dateLocale })
                  })}
                </span>
              </>
            )}
          </div>
        </div>
        {canClose && (
          <button type="button" onClick={handleClose} className="text-xs font-semibold text-clay-500 hover:underline shrink-0">
            {t('votaciones.closePoll')}
          </button>
        )}
      </div>

      {isBalanceReset && (
        <p className="text-xs font-semibold text-violet-500 mb-2">
          {t('votaciones.resetNote', { amount: Number(poll.payload?.newBalance ?? 0).toFixed(2) })}
        </p>
      )}

      <div className="flex flex-wrap gap-2 mb-3">
        {poll.options.map((option) => {
          const count = tally[option] || 0
          const isMine = myVote === option
          return (
            <button
              key={option}
              type="button"
              disabled={!isPending || approvalLocked}
              onClick={() => castVote(poll.id, option)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition ${
                isMine
                  ? 'bg-gold-100 dark:bg-gold-400/25 border-ink-900 dark:border-cream-100/50 text-ink-900 dark:text-cream-100'
                  : 'border-ink-900/15 dark:border-cream-100/20 text-ink-900/70 dark:text-cream-100/70 hover:bg-cream-100 dark:hover:bg-ink-700'
              } ${!isPending || approvalLocked ? 'opacity-70 cursor-default' : ''}`}
            >
              {option} · {count}
            </button>
          )
        })}
      </div>

      {isPending && approvalLocked && <p className="text-xs font-semibold text-sage-500 mb-2">{t('votaciones.resetLocked')}</p>}

      <div className="h-1.5 rounded-full bg-cream-200 dark:bg-ink-700 overflow-hidden mb-2">
        <div className="h-full bg-violet-500" style={{ width: total ? `${(votedCount / total) * 100}%` : '0%' }} />
      </div>
      <p className="text-xs text-ink-900/50 dark:text-cream-100/50">{t('votaciones.votedCount', { voted: votedCount, total })}</p>

      {isPending && missingMembers.length > 0 && (
        <p className="text-xs font-medium text-gold-500 mt-1">
          {t('votaciones.missingVoters', { names: missingMembers.map((m) => m.name).join(', ') })}
        </p>
      )}

      {!isPending && (
        <div className="mt-3 pt-3 border-t border-ink-900/10 dark:border-cream-100/15 flex flex-col gap-1">
          {poll.status === 'resolved' && isBalanceReset ? (
            <p className="text-xs font-semibold text-sage-500">{t('votaciones.resetDone')}</p>
          ) : poll.status === 'resolved' ? (
            <p className="text-xs font-semibold text-sage-500">{t('votaciones.winnerLabel', { option: poll.resolvedOption })}</p>
          ) : (
            <p className="text-xs font-semibold text-ink-900/50 dark:text-cream-100/50">{t('votaciones.noWinner')}</p>
          )}
          <p className="text-xs text-ink-900/50 dark:text-cream-100/50">
            {votes.length > 0
              ? votes.map((v) => `${members.find((m) => m.id === v.userId)?.name || '?'}: ${v.option}`).join(' · ')
              : t('votaciones.noVotesYet')}
          </p>
        </div>
      )}
    </div>
  )
}

function JoinRequestCard({ request, approveJoinRequest, rejectJoinRequest, t }) {
  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-cream-100 dark:bg-ink-700">
      <span className="text-sm min-w-0">{t('votaciones.joinRequestLabel', { name: request.requesterName })}</span>
      <div className="flex gap-2 shrink-0">
        <button onClick={() => rejectJoinRequest(request.membershipId)} className="btn-danger text-xs px-3 py-1.5">
          {t('votaciones.reject')}
        </button>
        <button
          onClick={() => approveJoinRequest(request.membershipId, request.requesterId, request.requesterName)}
          className="btn-primary text-xs px-3 py-1.5"
        >
          {t('votaciones.accept')}
        </button>
      </div>
    </div>
  )
}

function SwapRequestCard({ request, acceptSwap, declineSwap, showToast, t }) {
  async function handleAccept() {
    const result = await acceptSwap(request.id)
    if (result?.ok === false) showToast(result.message, 'default')
  }
  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-cream-100 dark:bg-ink-700">
      <span className="text-sm min-w-0">
        {t('votaciones.swapIncomingLabel', { name: request.fromMember?.name || t('votaciones.someone'), title: request.title })}
      </span>
      <div className="flex gap-2 shrink-0">
        <button onClick={() => declineSwap(request.id)} className="btn-danger text-xs px-3 py-1.5">
          {t('votaciones.reject')}
        </button>
        <button onClick={handleAccept} className="btn-primary text-xs px-3 py-1.5">
          {t('votaciones.accept')}
        </button>
      </div>
    </div>
  )
}

function AbsenceRequestCard({ request, memberById, decideAbsenceRequest, t }) {
  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-cream-100 dark:bg-ink-700">
      <span className="text-sm min-w-0">
        {t('votaciones.absenceRequestLabel', {
          name: memberById[request.userId]?.name || t('votaciones.someone'),
          start: request.startDate,
          end: request.endDate
        })}
      </span>
      <div className="flex gap-2 shrink-0">
        <button onClick={() => decideAbsenceRequest(request.id, false)} className="btn-danger text-xs px-3 py-1.5">
          {t('votaciones.reject')}
        </button>
        <button onClick={() => decideAbsenceRequest(request.id, true)} className="btn-primary text-xs px-3 py-1.5">
          {t('votaciones.accept')}
        </button>
      </div>
    </div>
  )
}

function PartnerRequestCard({ request, members, acceptRoomPartner, rejectRoomPartner, t }) {
  const requester = members.find((m) => m.id === request.requesterId)
  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-cream-100 dark:bg-ink-700">
      <span className="text-sm min-w-0">{t('votaciones.partnerRequestLabel', { name: requester?.name || t('votaciones.someone') })}</span>
      <div className="flex gap-2 shrink-0">
        <button onClick={() => rejectRoomPartner(request.id)} className="btn-danger text-xs px-3 py-1.5">
          {t('votaciones.reject')}
        </button>
        <button onClick={() => acceptRoomPartner(request.id)} className="btn-primary text-xs px-3 py-1.5">
          {t('votaciones.accept')}
        </button>
      </div>
    </div>
  )
}

function RemovalCard({ member, isSelf, isAdmin, removeMember, rejectMyRemoval, cancelRemoval, showToast, t }) {
  async function handleConfirmExit() {
    if (!confirm(t('votaciones.confirmExitConfirm'))) return
    await removeMember(member.membershipId, member.id)
    showToast(t('votaciones.exitedToast'), 'default')
  }
  async function handleReject() {
    await rejectMyRemoval(member.membershipId)
    showToast(t('votaciones.removalRejectedToast'), 'default')
  }
  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-clay-100/50 dark:bg-clay-500/10">
      <span className="text-sm min-w-0 text-clay-500 font-medium">
        {isSelf ? t('votaciones.removalSelfLabel') : t('votaciones.removalOtherLabel', { name: member.name })}
      </span>
      <div className="flex items-center gap-3 shrink-0">
        {isSelf && (
          <Link to="/perfil" className="text-xs font-semibold text-violet-500 hover:underline">
            {t('votaciones.viewDetail')}
          </Link>
        )}
        {isSelf ? (
          <>
            <button onClick={handleReject} className="text-xs font-semibold text-clay-500 hover:underline">
              {t('votaciones.reject')}
            </button>
            <button onClick={handleConfirmExit} className="btn-danger text-xs px-3 py-1.5">
              {t('votaciones.confirmExit')}
            </button>
          </>
        ) : (
          isAdmin && (
            <button onClick={() => cancelRemoval(member.membershipId, member.id, member.name)} className="text-xs font-semibold text-violet-500 hover:underline">
              {t('votaciones.cancelExit')}
            </button>
          )
        )}
      </div>
    </div>
  )
}

function CreatePollModal({ onCancel, onCreate, showToast, t }) {
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState(['', ''])
  const [resolutionMode, setResolutionMode] = useState('majority')
  const [deadline, setDeadline] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const todayISO = new Date().toISOString().slice(0, 10)

  function updateOption(i, value) {
    setOptions((prev) => prev.map((o, idx) => (idx === i ? value : o)))
  }
  function addOption() {
    setOptions((prev) => (prev.length >= 4 ? prev : [...prev, '']))
  }
  function removeOption(i) {
    setOptions((prev) => (prev.length <= 2 ? prev : prev.filter((_, idx) => idx !== i)))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const cleanOptions = options.map((o) => o.trim()).filter(Boolean)
    if (!question.trim() || cleanOptions.length < 2) return
    setSubmitting(true)
    try {
      await onCreate({ question: question.trim(), options: cleanOptions, resolutionMode, deadline: deadline || null })
      showToast(t('votaciones.createdToast'), 'success')
      onCancel()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 bg-ink-900/40 backdrop-blur-sm flex items-end sm:items-center sm:justify-center" onClick={onCancel}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md sm:rounded-2xl bg-cream-100 dark:bg-ink-800 border-t-[2.5px] sm:border-2 border-ink-900 dark:border-cream-100/40 rounded-t-2xl p-5 pb-8 sm:pb-5 relative max-h-[90vh] overflow-y-auto"
      >
        <div className="w-9 h-1.5 rounded-full bg-ink-900/15 dark:bg-cream-100/15 mx-auto mb-4 sm:hidden" />
        <button
          type="button"
          onClick={onCancel}
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center hover:bg-cream-200 dark:hover:bg-ink-700"
        >
          <CloseIcon className="w-4 h-4" />
        </button>

        <h3 className="font-display text-lg font-bold mb-1 pr-8">{t('votaciones.createTitle')}</h3>
        <p className="text-sm text-ink-900/60 dark:text-cream-100/60 mb-4">{t('votaciones.createSubtitle')}</p>

        <label className="text-sm block mb-3">
          {t('votaciones.questionLabel')}
          <textarea
            className="input mt-1"
            rows={2}
            maxLength={240}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={t('votaciones.questionPlaceholder')}
            required
          />
        </label>

        <div className="mb-3">
          <p className="text-sm mb-1.5">{t('votaciones.optionsLabel')}</p>
          <div className="flex flex-col gap-2">
            {options.map((option, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  className="input flex-1"
                  value={option}
                  onChange={(e) => updateOption(i, e.target.value)}
                  placeholder={t('votaciones.optionPlaceholder', { n: i + 1 })}
                  required
                  maxLength={60}
                />
                {options.length > 2 && (
                  <button type="button" onClick={() => removeOption(i)} className="text-xs font-semibold text-clay-500 hover:underline shrink-0">
                    {t('votaciones.removeOption')}
                  </button>
                )}
              </div>
            ))}
          </div>
          {options.length < 4 && (
            <button type="button" onClick={addOption} className="text-xs font-semibold text-violet-500 hover:underline mt-2">
              {t('votaciones.addOption')}
            </button>
          )}
        </div>

        <div className="mb-3">
          <p className="text-sm mb-1.5">{t('votaciones.resolutionLabel')}</p>
          <div className="flex gap-2">
            {['majority', 'unanimity'].map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setResolutionMode(mode)}
                className={`flex-1 text-xs font-semibold px-3 py-2 rounded-xl border-2 ${
                  resolutionMode === mode
                    ? 'bg-gold-100 dark:bg-gold-400/25 border-ink-900 dark:border-cream-100/50 text-ink-900 dark:text-cream-100'
                    : 'border-ink-900/15 dark:border-cream-100/20 text-ink-900/70 dark:text-cream-100/70'
                }`}
              >
                {mode === 'majority' ? t('votaciones.modeMajority') : t('votaciones.modeUnanimity')}
              </button>
            ))}
          </div>
        </div>

        <label className="text-sm block mb-5">
          {t('votaciones.deadlineOptionalLabel')}
          <input type="date" className="input mt-1" value={deadline} min={todayISO} onChange={(e) => setDeadline(e.target.value)} />
        </label>

        <div className="flex gap-2">
          <button type="button" className="btn-secondary text-sm flex-1" onClick={onCancel} disabled={submitting}>
            {t('votaciones.cancel')}
          </button>
          <button type="submit" className="btn-primary text-sm flex-1" disabled={submitting}>
            {submitting ? t('votaciones.creating') : t('votaciones.create')}
          </button>
        </div>
      </form>
    </div>
  )
}
