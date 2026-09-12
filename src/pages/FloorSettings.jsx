import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import Reveal from '../components/Reveal'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { useLanguage } from '../context/LanguageContext'
import { update, getRotationHistory } from '../lib/db'
import { TASK_TYPES, getWeekKey, getMondayOfWeek, whoIsAssigned, fixedTaskOverride } from '../lib/rotation'
import { ShareIcon, ChevronUpIcon, ChevronDownIcon, CoinIcon, SunIcon, ChatIcon, TASK_ICONS } from '../components/icons'
import { format, addDays } from 'date-fns'

/** Valida que sea una URL http(s) bien formada, igual que en la lista de
 * compras — bloquea javascript:/data: antes de guardarla como enlace. */
function isValidHttpUrl(value) {
  try {
    const u = new URL(value)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

export default function FloorSettings() {
  const { user, membership } = useAuth()
  const {
    floor,
    members,
    weekKey,
    absenceRequests,
    awayUserIds,
    reorderRotation,
    initiateRemoval,
    cancelRemoval,
    setMemberRole,
    requestAbsence,
    decideAbsenceRequest,
    cancelAbsenceRequest,
    pendingJoinRequests,
    approveJoinRequest,
    rejectJoinRequest
  } = useData()
  const { t, dateLocale } = useLanguage()
  const isAdmin = membership?.role === 'admin'
  const [threshold, setThreshold] = useState(floor?.potThreshold ?? 30)
  const [perPerson, setPerPerson] = useState(floor?.potPerPerson ?? 10)
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState(false)
  const [whatsappUrl, setWhatsappUrl] = useState(floor?.whatsappGroupUrl || '')
  const [whatsappError, setWhatsappError] = useState('')
  const [whatsappSaved, setWhatsappSaved] = useState(false)

  const order = floor?.rotationOrder || []
  const memberById = Object.fromEntries(members.map((m) => [m.id, m]))

  function move(idx, dir) {
    const newOrder = [...order]
    const target = idx + dir
    if (target < 0 || target >= newOrder.length) return
    ;[newOrder[idx], newOrder[target]] = [newOrder[target], newOrder[idx]]
    reorderRotation(newOrder)
  }

  function handleRemove(member) {
    if (member.id === user.id) {
      alert(t('floorSettings.leaveFloorSelfAlert'))
      return
    }
    if (confirm(t('floorSettings.removeConfirm', { name: member.name }))) {
      initiateRemoval(member.membershipId, member.id, member.name)
    }
  }

  function saveSettings() {
    update('floors', floor.id, { potThreshold: Number(threshold), potPerPerson: Number(perPerson) })
  }

  function saveWhatsappUrl(e) {
    e.preventDefault()
    setWhatsappError('')
    const trimmed = whatsappUrl.trim()
    if (trimmed && !isValidHttpUrl(trimmed)) {
      setWhatsappError(t('floorSettings.whatsappLinkInvalid'))
      return
    }
    update('floors', floor.id, { whatsappGroupUrl: trimmed || null })
    setWhatsappSaved(true)
    setTimeout(() => setWhatsappSaved(false), 2000)
  }

  function makeAdmin(member) {
    setMemberRole(member.membershipId, 'admin')
  }

  function copyWithFallback(text) {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(textarea)
    return ok
  }

  async function handleShareInvite() {
    const code = floor?.inviteCode || ''
    const text = t('floorSettings.shareInviteText', { floor: floor?.name, code })
    setCopyError(false)

    if (navigator.share) {
      try {
        await navigator.share({ title: t('floorSettings.shareInviteTitle'), text })
      } catch {
        // El usuario cerró el diálogo de compartir: no hacer nada.
      }
      return
    }

    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      if (copyWithFallback(code)) {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } else {
        setCopyError(true)
        setTimeout(() => setCopyError(false), 2500)
      }
    }
  }

  const myAbsenceRequests = absenceRequests.filter((r) => r.userId === user.id)
  const pendingAbsenceRequests = absenceRequests.filter((r) => r.status === 'pending')

  return (
    <AppLayout title={t('floorSettings.title')}>
      <div className="grid md:grid-cols-2 gap-5">
        <Reveal as="section" delay={0} className="card p-5">
          <h2 className="font-display font-semibold mb-1">{t('floorSettings.inviteTitle')}</h2>
          <p className="text-sm text-ink-900/60 dark:text-cream-100/60 mb-3">
            {t('floorSettings.inviteSubtitle', { floor: floor?.name })}
          </p>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-cream-100 dark:bg-ink-700 border-2 border-ink-900/10 dark:border-cream-100/15 rounded-xl px-4 py-3 text-center text-2xl font-display tracking-widest font-bold">
              {floor?.inviteCode}
            </div>
            <button
              onClick={handleShareInvite}
              title={t('floorSettings.copyOrShareTitle')}
              className="btn-secondary text-sm shrink-0 px-3"
            >
              {copied ? '✓' : <ShareIcon className="w-4 h-4" />}
            </button>
          </div>
          {copied && <p className="text-xs font-semibold text-sage-500 mt-2 text-center">{t('floorSettings.codeCopied')}</p>}
          {copyError && <p className="text-xs font-semibold text-clay-500 mt-2 text-center">{t('floorSettings.copyError')}</p>}
        </Reveal>

        <Reveal as="section" delay={40} className="card p-5">
          <h2 className="font-display font-semibold mb-1">{t('floorSettings.whatsappTitle')}</h2>
          <p className="text-sm text-ink-900/60 dark:text-cream-100/60 mb-3">{t('floorSettings.whatsappSubtitle')}</p>

          {floor?.whatsappGroupUrl && (
            <a
              href={floor.whatsappGroupUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="btn-primary text-sm w-full mb-3"
            >
              <ChatIcon className="w-4 h-4" />
              {t('floorSettings.openWhatsappGroup')}
            </a>
          )}

          {isAdmin ? (
            <form onSubmit={saveWhatsappUrl} className="flex flex-col gap-2">
              <input
                className="input"
                type="url"
                placeholder={t('floorSettings.whatsappUrlPlaceholder')}
                value={whatsappUrl}
                onChange={(e) => setWhatsappUrl(e.target.value)}
              />
              {whatsappError && <span className="text-xs font-medium text-clay-500">{whatsappError}</span>}
              <button type="submit" className="btn-secondary text-sm self-start">
                {whatsappSaved ? t('floorSettings.whatsappSaved') : t('floorSettings.saveLink')}
              </button>
            </form>
          ) : (
            !floor?.whatsappGroupUrl && (
              <p className="text-sm text-ink-900/50 dark:text-cream-100/50">{t('floorSettings.noWhatsappLink')}</p>
            )
          )}
        </Reveal>

        <Reveal as="section" delay={80} className="card p-5 md:col-span-2">
          <RotationSection
            isAdmin={isAdmin}
            order={order}
            memberById={memberById}
            move={move}
            weekKey={weekKey}
            awayUserIds={awayUserIds}
            floorId={floor?.id}
            floor={floor}
            myAbsenceRequests={myAbsenceRequests}
            pendingAbsenceRequests={pendingAbsenceRequests}
            requestAbsence={requestAbsence}
            decideAbsenceRequest={decideAbsenceRequest}
            cancelAbsenceRequest={cancelAbsenceRequest}
            t={t}
            dateLocale={dateLocale}
          />
        </Reveal>

        {pendingJoinRequests.length > 0 && (
          <Reveal as="section" delay={120} className="card p-5 md:col-span-2">
            <h2 className="font-display font-semibold mb-1">{t('floorSettings.pendingRequestsTitle')}</h2>
            <p className="text-sm text-ink-900/60 dark:text-cream-100/60 mb-3">{t('floorSettings.pendingRequestsSubtitle')}</p>
            <ul className="flex flex-col gap-2">
              {pendingJoinRequests.map((r) => (
                <li key={r.membershipId} className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-cream-100 dark:bg-ink-700">
                  <span className="text-sm font-medium">{r.requesterName}</span>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => rejectJoinRequest(r.membershipId)}
                      className="btn-danger text-xs px-3 py-1.5"
                    >
                      {t('floorSettings.reject')}
                    </button>
                    <button
                      onClick={() => approveJoinRequest(r.membershipId, r.requesterId, r.requesterName)}
                      className="btn-primary text-xs px-3 py-1.5"
                    >
                      {t('floorSettings.accept')}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </Reveal>
        )}

        <Reveal as="section" delay={160} className="card p-5">
          <h2 className="font-display font-semibold mb-3">{t('floorSettings.roommatesTitle')}</h2>
          <ul className="flex flex-col gap-2">
            {members.map((m) => (
              <li key={m.id} className="flex flex-col gap-1 px-1 py-1.5 text-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium">{m.name}</span>
                    <span className="flex items-center gap-1 text-ink-900/40 dark:text-cream-100/40">
                      · <CoinIcon className="w-3.5 h-3.5" />{m.points || 0}
                    </span>
                  </div>
                  {isAdmin && m.id !== user.id && !m.removalRequestedBy && (
                    <div className="flex gap-2">
                      {m.role !== 'admin' && (
                        <button onClick={() => makeAdmin(m)} className="text-xs font-semibold text-violet-500 hover:underline">
                          {t('floorSettings.makeAdmin')}
                        </button>
                      )}
                      <button onClick={() => handleRemove(m)} className="text-xs font-semibold text-clay-500 hover:underline">
                        {t('floorSettings.remove')}
                      </button>
                    </div>
                  )}
                </div>
                {m.removalRequestedBy && (
                  <div className="flex items-center justify-between bg-clay-500/10 text-clay-500 text-xs font-medium px-2 py-1.5 rounded-lg">
                    <span>
                      {t('floorSettings.exitPendingLabel', {
                        who: m.id === user.id ? t('floorSettings.exitPendingSelf') : t('floorSettings.exitPendingOther')
                      })}
                    </span>
                    {isAdmin && (
                      <button
                        onClick={() => cancelRemoval(m.membershipId, m.id, m.name)}
                        className="font-semibold hover:underline shrink-0 ml-2"
                      >
                        {t('floorSettings.cancel')}
                      </button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Reveal>

        {isAdmin && (
          <Reveal as="section" delay={240} className="card p-5">
            <h2 className="font-display font-semibold mb-3">{t('floorSettings.potSettingsTitle')}</h2>
            <label className="text-sm block mb-1">{t('floorSettings.thresholdLabel')}</label>
            <input className="input mb-3" type="number" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
            <label className="text-sm block mb-1">{t('floorSettings.perPersonLabel')}</label>
            <input className="input mb-4" type="number" value={perPerson} onChange={(e) => setPerPerson(e.target.value)} />
            <button className="btn-primary text-sm" onClick={saveSettings}>{t('floorSettings.saveSettingsBtn')}</button>
          </Reveal>
        )}
      </div>
    </AppLayout>
  )
}

function RotationSection({
  isAdmin,
  order,
  memberById,
  move,
  weekKey,
  awayUserIds,
  floorId,
  floor,
  myAbsenceRequests,
  pendingAbsenceRequests,
  requestAbsence,
  decideAbsenceRequest,
  cancelAbsenceRequest,
  t,
  dateLocale
}) {
  const [showAbsenceForm, setShowAbsenceForm] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [history, setHistory] = useState(null)

  const monday = getMondayOfWeek(weekKey)
  const sunday = addDays(monday, 6)
  const nextMonday = addDays(monday, 7)
  const nextWeekKey = getWeekKey(nextMonday)

  async function loadHistory() {
    if (history !== null || !floorId) return
    const rows = await getRotationHistory(floorId)
    setHistory(rows)
  }

  return (
    <div>
      <h2 className="font-display font-semibold mb-1">{t('floorSettings.rotationOrderTitle')}</h2>
      <p className="text-sm text-ink-900/60 dark:text-cream-100/60 mb-3">
        {t('floorSettings.rotationDesc')}
        {!isAdmin && t('floorSettings.adminOnlyReorder')}
      </p>

      <div className="grid sm:grid-cols-2 gap-3 mb-4 text-sm">
        <div className="bg-cream-100 dark:bg-ink-700 rounded-xl px-3 py-2.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-900/40 dark:text-cream-100/40">{t('floorSettings.currentRotation')}</p>
          <p className="font-medium">{format(monday, 'd MMM', { locale: dateLocale })} – {format(sunday, 'd MMM', { locale: dateLocale })}</p>
        </div>
        <div className="bg-cream-100 dark:bg-ink-700 rounded-xl px-3 py-2.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-900/40 dark:text-cream-100/40">{t('floorSettings.nextChange')}</p>
          <p className="font-medium">{format(nextMonday, t('calendar.dayMonthFormat'), { locale: dateLocale })}</p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5 mb-4">
        {TASK_TYPES.map((type) => {
          const Icon = TASK_ICONS[type.icon]
          const currentId = whoIsAssigned(order, weekKey, type.offset)
          const nextId = whoIsAssigned(order, nextWeekKey, type.offset)
          const typeLabel = fixedTaskOverride(floor, type.key)?.title || t(`taskTypes.${type.key}`)
          return (
            <div key={type.key} className="flex items-center justify-between text-sm bg-cream-100 dark:bg-ink-700 rounded-xl px-3 py-2">
              {type.key === 'compras' ? (
                <Link to="/compras" className="flex items-center gap-2 hover:opacity-80" title={t('floorSettings.goToShoppingList')}>
                  {Icon && <Icon className="w-4 h-4 text-violet-500" />}
                  <span className="underline decoration-dotted underline-offset-2">{typeLabel}</span>
                </Link>
              ) : (
                <span className="flex items-center gap-2">
                  {Icon && <Icon className="w-4 h-4 text-violet-500" />}
                  {typeLabel}
                </span>
              )}
              <span className="text-xs text-ink-900/50 dark:text-cream-100/50">
                <strong className="text-ink-900 dark:text-cream-100">{memberById[currentId]?.name || t('floorSettings.unassigned')}</strong>
                {t('floorSettings.nextArrow')}
                {memberById[nextId]?.name || t('floorSettings.unassigned')}
              </span>
            </div>
          )
        })}
      </div>

      <ol className="flex flex-col gap-2 mb-4">
        {order.map((id, idx) => {
          const m = memberById[id]
          if (!m) return null
          const away = awayUserIds.has(id)
          return (
            <li key={id} className="flex items-center justify-between bg-cream-100 dark:bg-ink-700 rounded-xl px-3 py-2">
              <span className="text-sm font-medium flex items-center gap-1.5">
                <span className="text-ink-900/40 dark:text-cream-100/40">{idx + 1}.</span>
                {m.name} {m.role === 'admin' && <span className="text-[10px] uppercase font-bold text-violet-500">{t('floorSettings.admin')}</span>}
                {away && (
                  <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-gold-500 bg-gold-400/15 px-1.5 py-0.5 rounded-md">
                    <SunIcon className="w-3 h-3" />{t('floorSettings.awayTag')}
                  </span>
                )}
              </span>
              {isAdmin && (
                <div className="flex gap-1">
                  <button onClick={() => move(idx, -1)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-cream-200 dark:hover:bg-ink-800"><ChevronUpIcon className="w-4 h-4" /></button>
                  <button onClick={() => move(idx, 1)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-cream-200 dark:hover:bg-ink-800"><ChevronDownIcon className="w-4 h-4" /></button>
                </div>
              )}
            </li>
          )
        })}
      </ol>

      <div className="border-t border-ink-900/10 dark:border-cream-100/15 pt-4 mb-4">
        <button type="button" className="btn-secondary text-sm" onClick={() => setShowAbsenceForm((s) => !s)}>
          {showAbsenceForm ? t('floorSettings.cancel') : t('floorSettings.requestAbsence')}
        </button>
        {showAbsenceForm && (
          <AbsenceRequestForm
            onCancel={() => setShowAbsenceForm(false)}
            onSubmit={async (payload) => {
              await requestAbsence(payload)
              setShowAbsenceForm(false)
            }}
            t={t}
          />
        )}

        {myAbsenceRequests.length > 0 && (
          <ul className="flex flex-col gap-1.5 mt-3">
            {myAbsenceRequests
              .filter((r) => r.status === 'pending' || r.status === 'approved')
              .map((r) => (
                <li key={r.id} className="flex items-center justify-between text-xs px-2.5 py-2 rounded-lg bg-cream-100 dark:bg-ink-700">
                  <span>
                    {t('floorSettings.dateRange', { start: r.startDate, end: r.endDate })}
                    {r.reason ? ` · ${r.reason}` : ''}
                    {' — '}
                    <span className={r.status === 'approved' ? 'text-sage-500 font-semibold' : 'text-gold-500 font-semibold'}>
                      {r.status === 'approved' ? t('floorSettings.approved') : t('floorSettings.pending')}
                    </span>
                  </span>
                  {r.status === 'pending' && (
                    <button onClick={() => cancelAbsenceRequest(r.id)} className="font-semibold text-violet-500 hover:underline shrink-0 ml-2">
                      {t('floorSettings.cancelRequest')}
                    </button>
                  )}
                </li>
              ))}
          </ul>
        )}
      </div>

      {isAdmin && pendingAbsenceRequests.length > 0 && (
        <div className="border-t border-ink-900/10 dark:border-cream-100/15 pt-4 mb-4">
          <p className="text-sm font-medium mb-2">{t('floorSettings.pendingAbsenceTitle')}</p>
          <ul className="flex flex-col gap-2">
            {pendingAbsenceRequests.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-cream-100 dark:bg-ink-700">
                <span className="text-sm">
                  <strong>{memberById[r.userId]?.name || t('floorSettings.someone')}</strong> · {r.startDate} {t('floorSettings.toPreposition')} {r.endDate}
                  {r.reason && <span className="text-ink-900/50 dark:text-cream-100/50"> · {r.reason}</span>}
                </span>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => decideAbsenceRequest(r.id, false)} className="btn-danger text-xs px-3 py-1.5">{t('floorSettings.reject')}</button>
                  <button onClick={() => decideAbsenceRequest(r.id, true)} className="btn-primary text-xs px-3 py-1.5">{t('floorSettings.accept')}</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="border-t border-ink-900/10 dark:border-cream-100/15 pt-4">
        <button
          type="button"
          className="flex items-center justify-between w-full"
          onClick={() => {
            setShowHistory((s) => !s)
            loadHistory()
          }}
        >
          <p className="text-sm font-medium">{t('floorSettings.rotationHistoryTitle')}</p>
          <span className="text-xs font-semibold text-violet-500">{showHistory ? t('floorSettings.hide') : t('floorSettings.show')}</span>
        </button>
        {showHistory && <RotationHistory history={history} memberById={memberById} floor={floor} t={t} dateLocale={dateLocale} />}
      </div>
    </div>
  )
}

function RotationHistory({ history, memberById, floor, t, dateLocale }) {
  const grouped = useMemo(() => {
    if (!history) return []
    const byWeek = new Map()
    for (const row of history) {
      if (!byWeek.has(row.weekKey)) byWeek.set(row.weekKey, [])
      byWeek.get(row.weekKey).push(row)
    }
    return [...byWeek.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1))
  }, [history])

  if (history === null) return <p className="text-sm text-ink-900/50 dark:text-cream-100/50 mt-3">{t('floorSettings.loading')}</p>
  if (grouped.length === 0) return <p className="text-sm text-ink-900/50 dark:text-cream-100/50 mt-3">{t('floorSettings.noHistoryYet')}</p>

  return (
    <ul className="flex flex-col gap-3 mt-3 max-h-80 overflow-y-auto">
      {grouped.map(([week, weekTasks]) => (
        <li key={week}>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-900/40 dark:text-cream-100/40 mb-1">
            {t('floorSettings.weekOfLabel', { date: format(getMondayOfWeek(week), t('calendar.dayMonthFormat'), { locale: dateLocale }) })}
          </p>
          <ul className="flex flex-col gap-1">
            {weekTasks.map((task) => {
              const type = TASK_TYPES.find((tt) => tt.key === task.type)
              return (
                <li key={task.id} className="flex items-center justify-between text-sm px-2.5 py-1.5 rounded-lg bg-cream-100 dark:bg-ink-700">
                  <span>{type ? fixedTaskOverride(floor, type.key)?.title || t(`taskTypes.${type.key}`) : task.type} · {memberById[task.assignedUserId]?.name || t('floorSettings.unassigned')}</span>
                  <span className={task.completed ? 'text-sage-500 text-xs font-semibold' : 'text-ink-900/40 dark:text-cream-100/40 text-xs'}>
                    {task.completed ? t('floorSettings.done') : t('floorSettings.notCompleted')}
                  </span>
                </li>
              )
            })}
          </ul>
        </li>
      ))}
    </ul>
  )
}

function AbsenceRequestForm({ onCancel, onSubmit, t }) {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!startDate || !endDate || endDate < startDate) return
    setSubmitting(true)
    try {
      await onSubmit({ startDate, endDate, reason: reason.trim() || null })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 mt-3 pt-3 border-t border-ink-900/10 dark:border-cream-100/15">
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="text-sm">
          {t('floorSettings.fromLabel')}
          <input type="date" className="input mt-1" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
        </label>
        <label className="text-sm">
          {t('floorSettings.toLabel')}
          <input type="date" className="input mt-1" value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} required />
        </label>
      </div>
      <input className="input text-sm" placeholder={t('floorSettings.reasonPlaceholder')} value={reason} onChange={(e) => setReason(e.target.value)} />
      <div className="flex gap-2">
        <button type="button" className="btn-secondary text-xs self-start" onClick={onCancel}>
          {t('floorSettings.cancel')}
        </button>
        <button type="submit" className="btn-primary text-xs self-start" disabled={submitting}>
          {submitting ? t('floorSettings.sending') : t('floorSettings.sendRequest')}
        </button>
      </div>
    </form>
  )
}
