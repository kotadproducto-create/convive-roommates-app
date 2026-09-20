import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import Reveal from '../components/Reveal'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { useLanguage } from '../context/LanguageContext'
import { update, getRotationHistory } from '../lib/db'
import { TASK_LABEL, getMondayOfWeek } from '../lib/rotation'
import { ShareIcon, ChevronUpIcon, ChevronDownIcon, CoinIcon, SunIcon, ChatIcon, EditIcon, CloseIcon } from '../components/icons'
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
    activities,
    activityCompletions,
    myAbsenceRequests,
    pendingAbsenceRequests,
    awayUserIds,
    proposeRotationChange,
    pendingRotationOrderPoll,
    initiateRemoval,
    cancelRemoval,
    setMemberRole,
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

  return (
    <AppLayout title={t('floorSettings.title')}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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
            floor={floor}
            memberById={memberById}
            proposeRotationChange={proposeRotationChange}
            pendingRotationOrderPoll={pendingRotationOrderPoll}
            weekKey={weekKey}
            awayUserIds={awayUserIds}
            floorId={floor?.id}
            activities={activities}
            activityCompletions={activityCompletions}
            myAbsenceRequests={myAbsenceRequests}
            pendingAbsenceRequests={pendingAbsenceRequests}
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
                <li key={r.membershipId} className="flex flex-wrap items-center justify-between gap-x-2 gap-y-2 px-3 py-2.5 rounded-xl bg-cream-100 dark:bg-ink-700">
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
  floor,
  memberById,
  proposeRotationChange,
  pendingRotationOrderPoll,
  weekKey,
  awayUserIds,
  floorId,
  activities,
  activityCompletions,
  myAbsenceRequests,
  pendingAbsenceRequests,
  decideAbsenceRequest,
  cancelAbsenceRequest,
  t,
  dateLocale
}) {
  const currentAbsenceRequests = myAbsenceRequests.filter((r) => r.status === 'pending' || r.status === 'approved')
  const [showHistory, setShowHistory] = useState(false)
  const [history, setHistory] = useState(null)
  const [showEditConfirm, setShowEditConfirm] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(order)
  // Modo y frecuencia también son parte del borrador: nada se guarda hasta
  // que se propone y el piso lo aprueba.
  const currentMode = floor?.rotationMode || 'random'
  const currentUnit = floor?.rotationPeriodUnit || 'week'
  const currentInterval = floor?.rotationPeriodInterval || 1
  const [draftMode, setDraftMode] = useState(currentMode)
  const [draftUnit, setDraftUnit] = useState(currentUnit)
  const [draftInterval, setDraftInterval] = useState(String(currentInterval))

  const monday = getMondayOfWeek(weekKey)
  const sunday = addDays(monday, 6)
  const nextMonday = addDays(monday, 7)

  // Esta sección es solo para configurar el ORDEN/PERÍODO de rotación —
  // el turno de cada actividad se ve en Actividades/Calendario. Acá solo
  // se necesitan las 3 fijas para el historial de más abajo.
  const fixedActivities = useMemo(() => activities.filter((a) => a.fixedKey), [activities])

  function startEditing() {
    setDraft(order)
    setDraftMode(currentMode)
    setDraftUnit(currentUnit)
    setDraftInterval(String(currentInterval))
    setEditing(true)
    setShowEditConfirm(false)
  }

  function moveDraft(idx, dir) {
    const next = [...draft]
    const target = idx + dir
    if (target < 0 || target >= next.length) return
    ;[next[idx], next[target]] = [next[target], next[idx]]
    setDraft(next)
  }

  function shuffleDraft() {
    const next = [...draft]
    for (let i = next.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[next[i], next[j]] = [next[j], next[i]]
    }
    setDraft(next)
  }

  // La frecuencia solo cuenta en modo Determinado, y tiene que ser un
  // entero de 1 a 52 para que el cambio sea válido.
  const intervalNumber = Number(draftInterval)
  const periodValid = draftMode !== 'period' || (draftInterval.trim() !== '' && Number.isInteger(intervalNumber) && intervalNumber >= 1 && intervalNumber <= 52)
  const orderChanged = JSON.stringify(draft) !== JSON.stringify(order)
  const modeChanged = draftMode !== currentMode
  const periodChanged = draftMode === 'period' && (draftUnit !== currentUnit || intervalNumber !== currentInterval)
  // Cualquier modificación válida (orden, modo o frecuencia) se puede proponer.
  const canPropose = periodValid && (orderChanged || modeChanged || periodChanged)

  async function handlePropose() {
    if (!canPropose) return
    const changes = {}
    if (orderChanged) changes.newOrder = draft
    if (modeChanged) changes.mode = draftMode
    if (draftMode === 'period' && (modeChanged || periodChanged)) {
      changes.periodUnit = draftUnit
      changes.periodInterval = intervalNumber
    }
    await proposeRotationChange(changes)
    setEditing(false)
  }

  async function loadHistory() {
    if (history !== null || !floorId) return
    const rows = await getRotationHistory(floorId)
    setHistory(rows)
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-2 mb-1">
        <h2 className="font-display font-semibold">{t('floorSettings.rotationOrderTitle')}</h2>
        {isAdmin && !editing && (
          <button
            type="button"
            onClick={() => setShowEditConfirm(true)}
            disabled={!!pendingRotationOrderPoll}
            title={t('floorSettings.editRotation')}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-cream-200 dark:hover:bg-ink-700 disabled:opacity-30 disabled:hover:bg-transparent shrink-0"
          >
            <EditIcon className="w-4 h-4" />
          </button>
        )}
      </div>
      <p className="text-sm text-ink-900/60 dark:text-cream-100/60 mb-3">
        {t('floorSettings.rotationDesc')}
        {!isAdmin && t('floorSettings.adminOnlyReorder')}
      </p>

      {pendingRotationOrderPoll && (
        <div className="flex items-center justify-between gap-2 text-sm bg-gold-100 dark:bg-gold-400/15 rounded-xl px-3 py-2.5 mb-4">
          <span className="min-w-0">{t('floorSettings.pendingProposalBanner')}</span>
          <Link to="/votaciones" className="font-semibold text-violet-500 hover:underline shrink-0">
            {t('floorSettings.voteNow')}
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 text-sm">
        <div className="bg-cream-100 dark:bg-ink-700 rounded-xl px-3 py-2.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-900/40 dark:text-cream-100/40">{t('floorSettings.currentRotation')}</p>
          <p className="font-medium">{format(monday, 'd MMM', { locale: dateLocale })} – {format(sunday, 'd MMM', { locale: dateLocale })}</p>
        </div>
        <div className="bg-cream-100 dark:bg-ink-700 rounded-xl px-3 py-2.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-900/40 dark:text-cream-100/40">{t('floorSettings.nextChange')}</p>
          <p className="font-medium">{format(nextMonday, t('calendar.dayMonthFormat'), { locale: dateLocale })}</p>
        </div>
      </div>

      {editing ? (
        <div className="flex flex-col gap-3 mb-4 border-2 border-dashed border-violet-300 dark:border-violet-700 rounded-xl p-3">
          <RotationModePicker
            mode={draftMode}
            unit={draftUnit}
            interval={draftInterval}
            onModeChange={setDraftMode}
            onUnitChange={setDraftUnit}
            onIntervalChange={setDraftInterval}
            intervalInvalid={!periodValid}
            t={t}
          />

          {draftMode === 'random' && (
            <button type="button" onClick={shuffleDraft} className="btn-secondary text-sm self-start">
              {t('floorSettings.shuffleButton')}
            </button>
          )}

          <ol className="flex flex-col gap-2">
            {draft.map((id, idx) => {
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
                  <div className="flex gap-1">
                    <button onClick={() => moveDraft(idx, -1)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-cream-200 dark:hover:bg-ink-800"><ChevronUpIcon className="w-4 h-4" /></button>
                    <button onClick={() => moveDraft(idx, 1)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-cream-200 dark:hover:bg-ink-800"><ChevronDownIcon className="w-4 h-4" /></button>
                  </div>
                </li>
              )
            })}
          </ol>

          <div className="flex gap-2">
            <button type="button" className="btn-secondary text-sm flex-1" onClick={() => setEditing(false)}>
              {t('floorSettings.cancel')}
            </button>
            <button type="button" className="btn-primary text-sm flex-1" onClick={handlePropose} disabled={!canPropose}>
              {t('floorSettings.proposeChangeButton')}
            </button>
          </div>
        </div>
      ) : (
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
              </li>
            )
          })}
        </ol>
      )}

      {showEditConfirm && (
        <RotationEditConfirmPopup onCancel={() => setShowEditConfirm(false)} onConfirm={startEditing} t={t} />
      )}

      {/* Ya no se pide estar fuera desde aquí: eso se hace con "Estoy fuera" en
          Convives. Esto solo muestra solicitudes que ya existían. */}
      {currentAbsenceRequests.length > 0 && (
        <div className="border-t border-ink-900/10 dark:border-cream-100/15 pt-4 mb-4">
          <ul className="flex flex-col gap-1.5">
            {currentAbsenceRequests.map((r) => (
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
        </div>
      )}

      {isAdmin && pendingAbsenceRequests.length > 0 && (
        <div className="border-t border-ink-900/10 dark:border-cream-100/15 pt-4 mb-4">
          <p className="text-sm font-medium mb-2">{t('floorSettings.pendingAbsenceTitle')}</p>
          <ul className="flex flex-col gap-2">
            {pendingAbsenceRequests.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-x-2 gap-y-2 px-3 py-2.5 rounded-xl bg-cream-100 dark:bg-ink-700">
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
        {showHistory && (
          <RotationHistory
            history={history}
            memberById={memberById}
            activities={fixedActivities}
            activityCompletions={activityCompletions}
            t={t}
            dateLocale={dateLocale}
          />
        )}
      </div>
    </div>
  )
}

/** Pop-up antes de entrar en modo edición del orden de rotación — deja
 * claro de entrada que reordenar a las personas no aplica al instante,
 * necesita que el piso lo apruebe (mismo patrón fixed-modal que
 * AwayPopup/ConfirmPotDialog en otras pantallas). */
function RotationEditConfirmPopup({ onCancel, onConfirm, t }) {
  return (
    <div className="fixed inset-0 z-40 bg-ink-900/40 backdrop-blur-sm flex items-end sm:items-center sm:justify-center" onClick={onCancel}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-sm sm:rounded-2xl bg-cream-100 dark:bg-ink-800 border-t-[2.5px] sm:border-2 border-ink-900 dark:border-cream-100/40 rounded-t-2xl p-5 pb-8 sm:pb-5 relative max-h-[90vh] overflow-y-auto"
      >
        <div className="w-9 h-1.5 rounded-full bg-ink-900/15 dark:bg-cream-100/15 mx-auto mb-4 sm:hidden" />
        <button
          type="button"
          onClick={onCancel}
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center hover:bg-cream-200 dark:hover:bg-ink-700"
        >
          <CloseIcon className="w-4 h-4" />
        </button>
        <h3 className="font-display text-lg font-bold mb-2 pr-8">{t('floorSettings.editRotationConfirmTitle')}</h3>
        <p className="text-sm text-ink-900/70 dark:text-cream-100/70 mb-5">{t('floorSettings.editRotationConfirmBody')}</p>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary text-sm flex-1" onClick={onCancel}>
            {t('floorSettings.cancel')}
          </button>
          <button type="button" className="btn-primary text-sm flex-1" onClick={onConfirm}>
            {t('floorSettings.continueButton')}
          </button>
        </div>
      </div>
    </div>
  )
}

const PERIOD_UNITS = ['day', 'week', 'month', 'year']

/** Selector de modo (Aleatorio/Determinado) +, en Determinado, el
 * picker "Repetir cada N día/semana/mes/año" (mismo patrón visual que
 * activities.repeatEvery en Activities.jsx). Es controlado: solo edita el
 * borrador de RotationSection — el cambio no se aplica hasta que se pulsa
 * "Proponer cambio" y el piso lo aprueba. */
function RotationModePicker({ mode, unit, interval, onModeChange, onUnitChange, onIntervalChange, intervalInvalid, t }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        {['random', 'period'].map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onModeChange(m)}
            className={`flex-1 text-left text-xs font-semibold px-3 py-2 rounded-xl border-2 ${
              mode === m
                ? 'bg-gold-100 dark:bg-gold-400/25 border-ink-900 dark:border-cream-100/50 text-ink-900 dark:text-cream-100'
                : 'border-ink-900/15 dark:border-cream-100/20 text-ink-900/70 dark:text-cream-100/70'
            }`}
          >
            <span className="block">{m === 'random' ? t('floorSettings.modeRandom') : t('floorSettings.modePeriod')}</span>
            <span className="block font-normal text-[11px] opacity-70 mt-0.5">
              {m === 'random' ? t('floorSettings.modeRandomDesc') : t('floorSettings.modePeriodDesc')}
            </span>
          </button>
        ))}
      </div>

      {mode === 'period' && (
        <div className="flex items-center gap-2">
          <span className="text-sm shrink-0">{t('floorSettings.repeatEvery')}</span>
          <input
            type="number"
            min="1"
            max="52"
            className={`input !w-16 shrink-0 text-center ${intervalInvalid ? 'border-clay-500' : ''}`}
            value={interval}
            onChange={(e) => onIntervalChange(e.target.value)}
          />
          <select className="input flex-1 min-w-0" value={unit} onChange={(e) => onUnitChange(e.target.value)}>
            {PERIOD_UNITS.map((u) => (
              <option key={u} value={u}>
                {t(`floorSettings.unit${u.charAt(0).toUpperCase()}${u.slice(1)}Option`)}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}

// La clave de período de las 3 fijas hoy es semanal ("2026-W37"), pero
// si alguien les cambia la cadencia a mensual/diaria desde Actividades
// la clave cambia de forma — se detecta el formato para etiquetar bien
// cada grupo en vez de asumir siempre semana.
function formatPeriodLabel(period, t, dateLocale) {
  if (/^\d{4}-W\d{2}$/.test(period)) {
    return t('floorSettings.weekOfLabel', { date: format(getMondayOfWeek(period), t('calendar.dayMonthFormat'), { locale: dateLocale }) })
  }
  if (/^\d{4}-\d{2}$/.test(period)) {
    const [y, m] = period.split('-').map(Number)
    return format(new Date(y, m - 1, 1), t('calendar.monthYearFormat'), { locale: dateLocale })
  }
  return format(new Date(`${period}T00:00:00`), t('calendar.dayMonthFormat'), { locale: dateLocale })
}

function RotationHistory({ history, memberById, activities, activityCompletions, t, dateLocale }) {
  const grouped = useMemo(() => {
    if (!history) return []
    const byPeriod = new Map()
    // Filas viejas de la tabla `tasks` (anteriores a esta migración).
    for (const row of history) {
      if (!byPeriod.has(row.weekKey)) byPeriod.set(row.weekKey, [])
      byPeriod.get(row.weekKey).push({
        id: `task-${row.id}`,
        label: TASK_LABEL[row.type] || row.type,
        assignedUserId: row.assignedUserId,
        completed: row.completed
      })
    }
    // Finalizaciones reales de las 3 fijas (posteriores a la migración).
    for (const completion of activityCompletions) {
      const activity = activities.find((a) => a.id === completion.activityId)
      if (!activity) continue
      if (!byPeriod.has(completion.periodKey)) byPeriod.set(completion.periodKey, [])
      byPeriod.get(completion.periodKey).push({
        id: `activity-${completion.id}`,
        label: activity.title,
        assignedUserId: completion.assignedUserId,
        completed: completion.completed
      })
    }
    return [...byPeriod.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1))
  }, [history, activities, activityCompletions])

  if (history === null) return <p className="text-sm text-ink-900/50 dark:text-cream-100/50 mt-3">{t('floorSettings.loading')}</p>
  if (grouped.length === 0) return <p className="text-sm text-ink-900/50 dark:text-cream-100/50 mt-3">{t('floorSettings.noHistoryYet')}</p>

  return (
    <ul className="flex flex-col gap-3 mt-3 max-h-80 overflow-y-auto">
      {grouped.map(([period, rows]) => (
        <li key={period}>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-900/40 dark:text-cream-100/40 mb-1">
            {formatPeriodLabel(period, t, dateLocale)}
          </p>
          <ul className="flex flex-col gap-1">
            {rows.map((row) => (
              <li key={row.id} className="flex items-center justify-between text-sm px-2.5 py-1.5 rounded-lg bg-cream-100 dark:bg-ink-700">
                <span>{row.label} · {memberById[row.assignedUserId]?.name || t('floorSettings.unassigned')}</span>
                <span className={row.completed ? 'text-sage-500 text-xs font-semibold' : 'text-ink-900/40 dark:text-cream-100/40 text-xs'}>
                  {row.completed ? t('floorSettings.done') : t('floorSettings.notCompleted')}
                </span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  )
}
