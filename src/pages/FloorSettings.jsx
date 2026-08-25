import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import Reveal from '../components/Reveal'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { update, getRotationHistory } from '../lib/db'
import { TASK_TYPES, getWeekKey, getMondayOfWeek, whoIsAssigned } from '../lib/rotation'
import { ShareIcon, ChevronUpIcon, ChevronDownIcon, CoinIcon, SunIcon, ChatIcon, TASK_ICONS } from '../components/icons'
import { format, addDays } from 'date-fns'
import { es } from 'date-fns/locale'

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
      alert('Para salir tú mismo del piso, usa "Dejar el piso" en tu Perfil.')
      return
    }
    if (
      confirm(
        `Se iniciará el proceso de salida de ${member.name}: deberá confirmarlo desde su propia cuenta antes de perder el acceso. ¿Continuar?`
      )
    ) {
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
      setWhatsappError('El enlace debe ser una URL válida (empezando por http:// o https://).')
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
    const text = `Únete a ${floor?.name} en Convive con el código: ${code}`
    setCopyError(false)

    if (navigator.share) {
      try {
        await navigator.share({ title: 'Invitación a Convive', text })
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
    <AppLayout title="Tu piso">
      <div className="grid md:grid-cols-2 gap-5">
        <Reveal as="section" delay={0} className="card p-5">
          <h2 className="font-display font-semibold mb-1">Invitar roommates</h2>
          <p className="text-sm text-ink-900/60 dark:text-cream-100/60 mb-3">
            Comparte este código para que se unan a <strong>{floor?.name}</strong>.
          </p>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-cream-100 dark:bg-ink-700 border-2 border-ink-900/10 dark:border-cream-100/15 rounded-xl px-4 py-3 text-center text-2xl font-display tracking-widest font-bold">
              {floor?.inviteCode}
            </div>
            <button
              onClick={handleShareInvite}
              title="Copiar o compartir código"
              className="btn-secondary text-sm shrink-0 px-3"
            >
              {copied ? '✓' : <ShareIcon className="w-4 h-4" />}
            </button>
          </div>
          {copied && <p className="text-xs font-semibold text-sage-500 mt-2 text-center">Código copiado</p>}
          {copyError && (
            <p className="text-xs font-semibold text-clay-500 mt-2 text-center">No se pudo copiar, selecciónalo manualmente.</p>
          )}
        </Reveal>

        <Reveal as="section" delay={40} className="card p-5">
          <h2 className="font-display font-semibold mb-1">Grupo de WhatsApp</h2>
          <p className="text-sm text-ink-900/60 dark:text-cream-100/60 mb-3">
            Enlace de invitación al grupo del piso (WhatsApp → Info del grupo → Invitar por enlace).
          </p>

          {floor?.whatsappGroupUrl && (
            <a
              href={floor.whatsappGroupUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="btn-primary text-sm w-full mb-3"
            >
              <ChatIcon className="w-4 h-4" />
              Abrir grupo de WhatsApp
            </a>
          )}

          {isAdmin ? (
            <form onSubmit={saveWhatsappUrl} className="flex flex-col gap-2">
              <input
                className="input"
                type="url"
                placeholder="https://chat.whatsapp.com/..."
                value={whatsappUrl}
                onChange={(e) => setWhatsappUrl(e.target.value)}
              />
              {whatsappError && <span className="text-xs font-medium text-clay-500">{whatsappError}</span>}
              <button type="submit" className="btn-secondary text-sm self-start">
                {whatsappSaved ? 'Guardado ✓' : 'Guardar enlace'}
              </button>
            </form>
          ) : (
            !floor?.whatsappGroupUrl && (
              <p className="text-sm text-ink-900/50 dark:text-cream-100/50">
                Todavía no hay enlace configurado. Pide a un admin que lo agregue.
              </p>
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
            myAbsenceRequests={myAbsenceRequests}
            pendingAbsenceRequests={pendingAbsenceRequests}
            requestAbsence={requestAbsence}
            decideAbsenceRequest={decideAbsenceRequest}
            cancelAbsenceRequest={cancelAbsenceRequest}
          />
        </Reveal>

        {pendingJoinRequests.length > 0 && (
          <Reveal as="section" delay={120} className="card p-5 md:col-span-2">
            <h2 className="font-display font-semibold mb-1">Solicitudes pendientes</h2>
            <p className="text-sm text-ink-900/60 dark:text-cream-100/60 mb-3">
              Cualquier miembro del piso puede aceptar o rechazar. Si nadie responde el pop-up al entrar, siempre puedes decidirlas aquí.
            </p>
            <ul className="flex flex-col gap-2">
              {pendingJoinRequests.map((r) => (
                <li key={r.membershipId} className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-cream-100 dark:bg-ink-700">
                  <span className="text-sm font-medium">{r.requesterName}</span>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => rejectJoinRequest(r.membershipId)}
                      className="btn-danger text-xs px-3 py-1.5"
                    >
                      Rechazar
                    </button>
                    <button
                      onClick={() => approveJoinRequest(r.membershipId, r.requesterId, r.requesterName)}
                      className="btn-primary text-xs px-3 py-1.5"
                    >
                      Aceptar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </Reveal>
        )}

        <Reveal as="section" delay={160} className="card p-5">
          <h2 className="font-display font-semibold mb-3">Roommates</h2>
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
                          Hacer admin
                        </button>
                      )}
                      <button onClick={() => handleRemove(m)} className="text-xs font-semibold text-clay-500 hover:underline">
                        Quitar
                      </button>
                    </div>
                  )}
                </div>
                {m.removalRequestedBy && (
                  <div className="flex items-center justify-between bg-clay-500/10 text-clay-500 text-xs font-medium px-2 py-1.5 rounded-lg">
                    <span>Salida pendiente de que {m.id === user.id ? 'la confirmes' : 'la confirme'}</span>
                    {isAdmin && (
                      <button
                        onClick={() => cancelRemoval(m.membershipId, m.id, m.name)}
                        className="font-semibold hover:underline shrink-0 ml-2"
                      >
                        Cancelar
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
            <h2 className="font-display font-semibold mb-3">Ajustes del pote</h2>
            <label className="text-sm block mb-1">Aviso cuando el pote baje de</label>
            <input className="input mb-3" type="number" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
            <label className="text-sm block mb-1">Aportación sugerida por persona</label>
            <input className="input mb-4" type="number" value={perPerson} onChange={(e) => setPerPerson(e.target.value)} />
            <button className="btn-primary text-sm" onClick={saveSettings}>Guardar ajustes</button>
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
  myAbsenceRequests,
  pendingAbsenceRequests,
  requestAbsence,
  decideAbsenceRequest,
  cancelAbsenceRequest
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
      <h2 className="font-display font-semibold mb-1">Orden de rotación</h2>
      <p className="text-sm text-ink-900/60 dark:text-cream-100/60 mb-3">
        Rotación semanal fija (lunes a domingo). Este es el orden en el que van pasando las 3 tareas.
        {!isAdmin && ' Solo un admin puede reordenarlo.'}
      </p>

      <div className="grid sm:grid-cols-2 gap-3 mb-4 text-sm">
        <div className="bg-cream-100 dark:bg-ink-700 rounded-xl px-3 py-2.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-900/40 dark:text-cream-100/40">Rotación actual</p>
          <p className="font-medium">{format(monday, "d MMM", { locale: es })} – {format(sunday, "d MMM", { locale: es })}</p>
        </div>
        <div className="bg-cream-100 dark:bg-ink-700 rounded-xl px-3 py-2.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-900/40 dark:text-cream-100/40">Próximo cambio</p>
          <p className="font-medium">{format(nextMonday, "d 'de' MMMM", { locale: es })}</p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5 mb-4">
        {TASK_TYPES.map((type) => {
          const Icon = TASK_ICONS[type.icon]
          const currentId = whoIsAssigned(order, weekKey, type.offset)
          const nextId = whoIsAssigned(order, nextWeekKey, type.offset)
          return (
            <div key={type.key} className="flex items-center justify-between text-sm bg-cream-100 dark:bg-ink-700 rounded-xl px-3 py-2">
              {type.key === 'compras' ? (
                <Link to="/compras" className="flex items-center gap-2 hover:opacity-80" title="Ir a la lista de compras">
                  {Icon && <Icon className="w-4 h-4 text-violet-500" />}
                  <span className="underline decoration-dotted underline-offset-2">{type.label}</span>
                </Link>
              ) : (
                <span className="flex items-center gap-2">
                  {Icon && <Icon className="w-4 h-4 text-violet-500" />}
                  {type.label}
                </span>
              )}
              <span className="text-xs text-ink-900/50 dark:text-cream-100/50">
                <strong className="text-ink-900 dark:text-cream-100">{memberById[currentId]?.name || 'Sin asignar'}</strong>
                {' → siguiente: '}
                {memberById[nextId]?.name || 'Sin asignar'}
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
                {m.name} {m.role === 'admin' && <span className="text-[10px] uppercase font-bold text-violet-500">admin</span>}
                {away && (
                  <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-gold-500 bg-gold-400/15 px-1.5 py-0.5 rounded-md">
                    <SunIcon className="w-3 h-3" />Fuera
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
          {showAbsenceForm ? 'Cancelar' : 'Solicitar estar fuera del piso'}
        </button>
        {showAbsenceForm && (
          <AbsenceRequestForm
            onCancel={() => setShowAbsenceForm(false)}
            onSubmit={async (payload) => {
              await requestAbsence(payload)
              setShowAbsenceForm(false)
            }}
          />
        )}

        {myAbsenceRequests.length > 0 && (
          <ul className="flex flex-col gap-1.5 mt-3">
            {myAbsenceRequests
              .filter((r) => r.status === 'pending' || r.status === 'approved')
              .map((r) => (
                <li key={r.id} className="flex items-center justify-between text-xs px-2.5 py-2 rounded-lg bg-cream-100 dark:bg-ink-700">
                  <span>
                    Del {r.startDate} al {r.endDate}
                    {r.reason ? ` · ${r.reason}` : ''}
                    {' — '}
                    <span className={r.status === 'approved' ? 'text-sage-500 font-semibold' : 'text-gold-500 font-semibold'}>
                      {r.status === 'approved' ? 'Aprobada' : 'Pendiente'}
                    </span>
                  </span>
                  {r.status === 'pending' && (
                    <button onClick={() => cancelAbsenceRequest(r.id)} className="font-semibold text-violet-500 hover:underline shrink-0 ml-2">
                      Anular
                    </button>
                  )}
                </li>
              ))}
          </ul>
        )}
      </div>

      {isAdmin && pendingAbsenceRequests.length > 0 && (
        <div className="border-t border-ink-900/10 dark:border-cream-100/15 pt-4 mb-4">
          <p className="text-sm font-medium mb-2">Solicitudes de ausencia pendientes</p>
          <ul className="flex flex-col gap-2">
            {pendingAbsenceRequests.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-cream-100 dark:bg-ink-700">
                <span className="text-sm">
                  <strong>{memberById[r.userId]?.name || 'Alguien'}</strong> · {r.startDate} a {r.endDate}
                  {r.reason && <span className="text-ink-900/50 dark:text-cream-100/50"> · {r.reason}</span>}
                </span>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => decideAbsenceRequest(r.id, false)} className="btn-danger text-xs px-3 py-1.5">Rechazar</button>
                  <button onClick={() => decideAbsenceRequest(r.id, true)} className="btn-primary text-xs px-3 py-1.5">Aceptar</button>
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
          <p className="text-sm font-medium">Historial de rotaciones</p>
          <span className="text-xs font-semibold text-violet-500">{showHistory ? 'Ocultar' : 'Ver'}</span>
        </button>
        {showHistory && <RotationHistory history={history} memberById={memberById} />}
      </div>
    </div>
  )
}

function RotationHistory({ history, memberById }) {
  const grouped = useMemo(() => {
    if (!history) return []
    const byWeek = new Map()
    for (const t of history) {
      if (!byWeek.has(t.weekKey)) byWeek.set(t.weekKey, [])
      byWeek.get(t.weekKey).push(t)
    }
    return [...byWeek.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1))
  }, [history])

  if (history === null) return <p className="text-sm text-ink-900/50 dark:text-cream-100/50 mt-3">Cargando…</p>
  if (grouped.length === 0) return <p className="text-sm text-ink-900/50 dark:text-cream-100/50 mt-3">Sin historial todavía.</p>

  return (
    <ul className="flex flex-col gap-3 mt-3 max-h-80 overflow-y-auto">
      {grouped.map(([week, weekTasks]) => (
        <li key={week}>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-900/40 dark:text-cream-100/40 mb-1">
            Semana de {format(getMondayOfWeek(week), "d 'de' MMMM", { locale: es })}
          </p>
          <ul className="flex flex-col gap-1">
            {weekTasks.map((t) => {
              const type = TASK_TYPES.find((tt) => tt.key === t.type)
              return (
                <li key={t.id} className="flex items-center justify-between text-sm px-2.5 py-1.5 rounded-lg bg-cream-100 dark:bg-ink-700">
                  <span>{type?.label || t.type} · {memberById[t.assignedUserId]?.name || 'Sin asignar'}</span>
                  <span className={t.completed ? 'text-sage-500 text-xs font-semibold' : 'text-ink-900/40 dark:text-cream-100/40 text-xs'}>
                    {t.completed ? 'Hecha' : 'Sin completar'}
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

function AbsenceRequestForm({ onCancel, onSubmit }) {
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
          Desde
          <input type="date" className="input mt-1" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
        </label>
        <label className="text-sm">
          Hasta
          <input type="date" className="input mt-1" value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} required />
        </label>
      </div>
      <input className="input text-sm" placeholder="Motivo (opcional)" value={reason} onChange={(e) => setReason(e.target.value)} />
      <div className="flex gap-2">
        <button type="button" className="btn-secondary text-xs self-start" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className="btn-primary text-xs self-start" disabled={submitting}>
          {submitting ? 'Enviando…' : 'Enviar solicitud'}
        </button>
      </div>
    </form>
  )
}
