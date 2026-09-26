import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'
import {
  getAll,
  create,
  update,
  remove,
  subscribeTable,
  subscribeFloorMembers,
  uploadPotReceipt,
  uploadShoppingItemImage,
  uploadAvatar,
  claimPendingJoinRequests,
  subscribePendingRequests,
  upsertIgnoreDuplicates,
  deterministicUuid,
  getFloorMembers,
  callRpc
} from '../lib/db'
import { TASK_TYPES, getWeekKey, ensureWeekTasks, reassignPendingTasks, placeAdjacentInRotation, fixedTaskOverride } from '../lib/rotation'
import { SHARED_SPACE_BY_KEY, currentSpaceUse } from '../lib/sharedSpaces'
import { ensureActivityPeriods, assigneeFor, currentPeriodKey, occurrenceSlots, occurrencePoints, activeRoutineMarks, canUserMark, floorKeeperIndex } from '../lib/activities'
import { resolvePoll, pollDeadlineAt, ROTATION_POLL_HOURS } from '../lib/polls'
import { realMembers, virtualIdSet } from '../lib/virtualMembers'
import { useAuth } from './AuthContext'
import { useLanguage } from './LanguageContext'

const DataContext = createContext(null)

// El texto de cada recompensa vive en el diccionario de idioma
// (rewardCatalog.<key>, ver i18n/es.js y en.js) — acá solo el catálogo
// con lo que no cambia por idioma (costo, ícono).
export const REWARD_CATALOG = [
  { key: 'movie', cost: 40, icon: '🎬' },
  { key: 'skip_minor', cost: 60, icon: '🙅' },
  { key: 'lie_in', cost: 90, icon: '🛌' }
]

export function DataProvider({ children }) {
  const { user, floor, refresh: refreshAuth } = useAuth()
  const { t } = useLanguage()
  const floorId = floor?.id

  const [currentFloor, setCurrentFloor] = useState(floor)
  const [members, setMembers] = useState([])
  const [tasks, setTasks] = useState([])
  const [incidents, setIncidents] = useState([])
  const [notifications, setNotifications] = useState([])
  const [redemptions, setRedemptions] = useState([])
  const [potContributions, setPotContributions] = useState([])
  const [walletResets, setWalletResets] = useState([])
  const [sharedSpaceUses, setSharedSpaceUses] = useState([])
  const [pendingJoinRequests, setPendingJoinRequests] = useState([])
  const [shoppingItems, setShoppingItems] = useState([])
  const [shoppingPurchases, setShoppingPurchases] = useState([])
  const [purchaseSessions, setPurchaseSessions] = useState([])
  const [absenceRequests, setAbsenceRequests] = useState([])
  const [roomPartners, setRoomPartners] = useState([])
  const [activities, setActivities] = useState([])
  const [activityCompletions, setActivityCompletions] = useState([])
  const [swapRequests, setSwapRequests] = useState([])
  const [activityMarks, setActivityMarks] = useState([])
  const [polls, setPolls] = useState([])
  const [pollVotes, setPollVotes] = useState([])

  const weekKey = getWeekKey()

  // Se mantiene sincronizado con AuthContext, pero además se refresca solo
  // cuando cambian sus propios campos (pote, rotationOrder...) vía realtime.
  useEffect(() => {
    if (!floorId) {
      setCurrentFloor(null)
      return
    }
    return subscribeTable('floors', {}, (rows) => {
      const f = rows.find((r) => r.id === floorId)
      if (f) setCurrentFloor(f)
    })
  }, [floorId])

  useEffect(() => {
    if (!floorId) {
      setMembers([])
      return
    }
    return subscribeFloorMembers(floorId, setMembers)
  }, [floorId])

  useEffect(() => {
    if (!floorId) {
      setTasks([])
      return
    }
    return subscribeTable('tasks', { floorId }, setTasks)
  }, [floorId])

  useEffect(() => {
    if (!floorId) {
      setIncidents([])
      return
    }
    return subscribeTable('incidents', { floorId }, setIncidents)
  }, [floorId])

  useEffect(() => {
    if (!floorId) {
      setNotifications([])
      return
    }
    return subscribeTable('notifications', { floorId }, setNotifications)
  }, [floorId])

  useEffect(() => {
    if (!floorId) {
      setRedemptions([])
      return
    }
    return subscribeTable('redemptions', { floorId }, setRedemptions)
  }, [floorId])

  useEffect(() => {
    if (!floorId) {
      setPotContributions([])
      return
    }
    return subscribeTable('pot_contributions', { floorId }, setPotContributions)
  }, [floorId])

  useEffect(() => {
    if (!floorId) {
      setWalletResets([])
      return
    }
    return subscribeTable('wallet_resets', { floorId }, setWalletResets)
  }, [floorId])

  useEffect(() => {
    if (!floorId) {
      setSharedSpaceUses([])
      return
    }
    return subscribeTable('shared_space_uses', { floorId }, setSharedSpaceUses)
  }, [floorId])

  useEffect(() => {
    if (!floorId) {
      setPendingJoinRequests([])
      return
    }
    return subscribePendingRequests(floorId, setPendingJoinRequests)
  }, [floorId])

  useEffect(() => {
    if (!floorId) {
      setShoppingItems([])
      return
    }
    return subscribeTable('shopping_items', { floorId }, setShoppingItems)
  }, [floorId])

  useEffect(() => {
    if (!floorId) {
      setShoppingPurchases([])
      return
    }
    return subscribeTable('shopping_purchases', { floorId }, setShoppingPurchases)
  }, [floorId])

  useEffect(() => {
    if (!floorId) {
      setPurchaseSessions([])
      return
    }
    return subscribeTable('purchase_sessions', { floorId }, setPurchaseSessions)
  }, [floorId])

  useEffect(() => {
    if (!floorId) {
      setAbsenceRequests([])
      return
    }
    return subscribeTable('absence_requests', { floorId }, setAbsenceRequests)
  }, [floorId])

  useEffect(() => {
    if (!floorId) {
      setRoomPartners([])
      return
    }
    return subscribeTable('room_partners', { floorId }, setRoomPartners)
  }, [floorId])

  useEffect(() => {
    if (!floorId) {
      setActivities([])
      return
    }
    return subscribeTable('activities', { floorId }, setActivities)
  }, [floorId])

  useEffect(() => {
    if (!floorId) {
      setActivityCompletions([])
      return
    }
    return subscribeTable('activity_completions', { floorId }, setActivityCompletions)
  }, [floorId])

  useEffect(() => {
    if (!floorId) {
      setSwapRequests([])
      return
    }
    return subscribeTable('swap_requests', { floorId }, setSwapRequests)
  }, [floorId])

  useEffect(() => {
    if (!floorId) {
      setActivityMarks([])
      return
    }
    return subscribeTable('activity_marks', { floorId }, setActivityMarks)
  }, [floorId])

  useEffect(() => {
    if (!floorId) {
      setPolls([])
      return
    }
    return subscribeTable('polls', { floorId }, setPolls)
  }, [floorId])

  useEffect(() => {
    if (!floorId) {
      setPollVotes([])
      return
    }
    return subscribeTable('poll_votes', { floorId }, setPollVotes)
  }, [floorId])

  // IDs de quienes están "Fuera del piso" ahora mismo (pot_active en
  // false: "Estoy fuera" de Convives, o una ausencia aprobada que apagó ese
  // mismo indicador) — se excluyen de la rotación de actividades
  // (whoIsAssigned salta a la siguiente persona en rotationOrder) y del
  // reparto del pote. Es una sola fuente de verdad: al pulsar "Vuelta al
  // piso" (o al pasar la fecha de regreso) la persona vuelve a todo a la
  // vez. Solo afecta a los períodos que se generan desde ahora, no reescribe
  // los ya creados. La clave ordenada mantiene estable la identidad del Set
  // mientras no cambie quién está fuera (así los efectos que dependen de él
  // no se re-disparan con cada refresco de miembros).
  const todayISO = new Date().toISOString().slice(0, 10)
  const awayKey = members
    .filter((m) => m.potActive === false)
    .map((m) => m.id)
    .sort()
    .join(',')
  const awayUserIds = useMemo(() => new Set(awayKey ? awayKey.split(',') : []), [awayKey])

  // Cuando una ausencia aprobada ya terminó (end_date pasó), la cierra
  // ('completed') y reactiva a la persona en el pote. Como no hay cron en
  // esta arquitectura, esto corre de forma oportunista cada vez que
  // alguien del piso tiene la app abierta — no es instantáneo a
  // medianoche, pero se autocorrige en cuanto alguien entra.
  useEffect(() => {
    if (!currentFloor) return
    const expired = absenceRequests.filter((r) => r.status === 'approved' && r.endDate < todayISO)
    if (!expired.length) return
    for (const r of expired) {
      update('absence_requests', r.id, { status: 'completed' })
      const member = members.find((m) => m.id === r.userId)
      if (member) update('floor_memberships', member.membershipId, { potActive: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [absenceRequests, members, todayISO, currentFloor?.id])

  // Mismo mecanismo que arriba, pero para el toggle rápido "Estoy fuera"
  // de Convives (away_until en floor_memberships) — independiente de
  // absence_requests, sin aprobación de nadie. Al pasar la fecha, vuelve
  // sola a "En el piso" sin que nadie tenga que tocar nada.
  useEffect(() => {
    if (!currentFloor) return
    const backToday = members.filter((m) => m.awayUntil && m.awayUntil < todayISO)
    for (const m of backToday) {
      update('floor_memberships', m.membershipId, { potActive: true, awayUntil: null })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members, todayISO, currentFloor?.id])

  // Las consultas con plazo en horas (deadlineAt) vencen a una hora exacta: se
  // agenda un aviso para el primer vencimiento pendiente y se vuelve a evaluar
  // entonces, sin esperar a que cambie otro dato ni a recargar la app.
  const [pollClock, setPollClock] = useState(0)
  useEffect(() => {
    const now = Date.now()
    const upcoming = polls
      .filter((p) => p.status === 'pending' && p.deadlineAt)
      .map((p) => new Date(p.deadlineAt).getTime())
      .filter((ms) => ms > now)
    if (!upcoming.length) return undefined
    const wait = Math.min(Math.min(...upcoming) - now + 1000, 2147483647)
    const id = setTimeout(() => setPollClock((c) => c + 1), wait)
    return () => clearTimeout(id)
  }, [polls, pollClock])

  // Resolución oportunista de consultas (Votaciones): igual que las dos
  // expiraciones de arriba, no hay cron — se revisa cada vez que alguien
  // del piso tiene la app abierta. resolvePoll es pura (ver lib/polls.js);
  // acá solo se traduce su resultado a un update() + una notificación
  // floor-wide idempotente (mismo patrón deterministic-id que "pote bajo"),
  // para que un efecto que se dispare más de una vez no duplique el aviso.
  useEffect(() => {
    if (!currentFloor) return
    const activeMemberIds = realMembers(members).map((m) => m.id)
    const pending = polls.filter((p) => p.status === 'pending')
    if (!pending.length) return

    async function run() {
      for (const poll of pending) {
        const votesForPoll = pollVotes.filter((v) => v.pollId === poll.id)
        const outcome = resolvePoll(poll, votesForPoll, activeMemberIds, todayISO, Date.now())
        if (!outcome) continue

        // Las consultas de tipo 'rotation_order' (propuesta de cambio de
        // rotación: orden de personas, modo y/o período, ver
        // proposeRotationChange) solo aplican el cambio de verdad si se
        // resolvió con la opción "Aprobar" — un "Rechazar", un cierre sin
        // mayoría o un vencimiento del plazo dejan la rotación intacta.
        const isRotationOrder = poll.kind === 'rotation_order'
        const isPotAdjustment = poll.kind === 'pot_adjustment'
        const isBalanceReset = poll.kind === 'balance_reset'
        const approved = outcome.status === 'resolved' && outcome.resolvedOption === 'Aprobar'
        if (isRotationOrder && approved && poll.payload) {
          const { newOrder, mode, periodUnit, periodInterval } = poll.payload
          // rotationOffset (asignar el turno actual a mano, ver setCurrentTurn) queda
          // sin sentido en cuanto cambia el orden/modo/período de verdad: se reinicia.
          const patch = { rotationEpoch: todayISO, rotationOffset: 0 }
          if (newOrder) patch.rotationOrder = newOrder
          if (mode) patch.rotationMode = mode
          if (periodUnit) {
            patch.rotationPeriodUnit = periodUnit
            patch.rotationPeriodInterval = Math.max(1, Number(periodInterval) || 1)
          }
          await update('floors', currentFloor.id, patch)
        }

        // 'pot_adjustment' (ajuste manual del Pote, ver requestPotAdjustment):
        // solo con la aprobación de TODOS (unanimidad) se aplica el nuevo
        // importe. Cualquier otro desenlace (rechazo, plazo vencido, cierre
        // manual) deja el Pote intacto. El movimiento del historial usa un
        // id determinístico + upsert-ignorando-duplicados: como este efecto
        // corre en el dispositivo de cada conviviente a la vez, así solo se
        // registra una vez aunque varios lo apliquen en paralelo (fijar
        // potAmount al mismo valor es idempotente por sí solo).
        if (isPotAdjustment && approved && Number.isFinite(Number(poll.payload?.newAmount))) {
          const newAmount = Number(poll.payload.newAmount)
          const delta = newAmount - Number(currentFloor.potAmount || 0)
          await update('floors', currentFloor.id, { potAmount: newAmount })
          if (delta !== 0) {
            const requester = members.find((m) => m.id === poll.createdBy)?.name || 'un conviviente'
            const rowId = await deterministicUuid(`pot-adjustment:${poll.id}`)
            await upsertIgnoreDuplicates(
              'pot_contributions',
              [
                {
                  id: rowId,
                  floorId: currentFloor.id,
                  userId: user.id,
                  amount: delta,
                  kind: 'adjustment',
                  note: `Pote establecido en ${newAmount.toFixed(2)}€ · solicitado por ${requester}`
                }
              ],
              ['id']
            )
          }
        }

        await update('polls', poll.id, {
          status: outcome.status,
          resolvedOption: outcome.resolvedOption,
          resolvedAt: new Date().toISOString()
        })
        const id = await deterministicUuid(`notif:poll-resolved:${poll.id}:${outcome.status}`)
        const message = isRotationOrder
          ? approved
            ? 'El piso aprobó el cambio de rotación — ya está activo.'
            : outcome.status === 'resolved'
              ? 'El piso rechazó la propuesta de cambio de rotación. Sigue la rotación anterior.'
              : outcome.status === 'closed'
                ? 'La propuesta de cambio de rotación se cerró sin mayoría clara. Sigue la rotación anterior.'
                : 'La propuesta de cambio de rotación venció sin que todos votaran. Sigue la rotación anterior.'
          : isBalanceReset
            ? 'La consulta de reinicio de saldo terminó. Solo cambió el saldo de quienes la aprobaron.'
          : isPotAdjustment
            ? approved
              ? `Todos aprobaron la modificación del Pote: ahora es de ${Number(poll.payload?.newAmount).toFixed(2)}€.`
              : outcome.status === 'resolved'
                ? 'Se rechazó la solicitud de modificación del Pote. El importe no cambió.'
                : outcome.status === 'closed'
                  ? 'Se canceló la solicitud de modificación del Pote. El importe no cambió.'
                  : 'La solicitud de modificación del Pote venció sin que todos la aprobaran. El importe no cambió.'
            : outcome.status === 'resolved'
              ? `Se resolvió la consulta "${poll.question}": ganó "${outcome.resolvedOption}"`
              : outcome.status === 'closed'
                ? `La consulta "${poll.question}" se cerró sin mayoría clara.`
                : `La consulta "${poll.question}" expiró: no todos votaron a tiempo.`
        await upsertIgnoreDuplicates(
          'notifications',
          [
            {
              id,
              floorId: currentFloor.id,
              userId: null,
              // El tipo dice a qué pantalla lleva la notificación (ver lib/notifications.js).
              type: isPotAdjustment || isBalanceReset ? 'poll_resolved_pote' : isRotationOrder ? 'poll_resolved_rotation' : 'poll_resolved',
              read: false,
              message
            }
          ],
          ['id']
        )
      }
    }

    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [polls, pollVotes, members, todayISO, currentFloor?.id, pollClock])

  // Genera (una sola vez, de forma idempotente) las finalizaciones de
  // la semana actual de las 3 fijas y las notificaciones de
  // recordatorio de turno / pote bajo. Las 3 fijas (Compras/Basura/
  // Lavadora) ya no viven en "tasks" (motor viejo de rotation.js, solo
  // histórico) — son actividades reales con `fixedKey`, así que este
  // efecto se apoya en ensureActivityPeriods/currentPeriodKey de
  // lib/activities.js igual que cualquier otra actividad recurrente.
  //
  // Las notificaciones de turno/pote usan `dedupeKey` (ver notifyUser)
  // en vez de "leer lo que existe y crear lo que falta": ese patrón
  // tenía una ventana de carrera real — si este efecto se disparaba
  // más de una vez seguida (StrictMode en desarrollo, dos pestañas
  // abiertas, una reconexión), cada disparo llegaba a ver "todavía no
  // se avisó" antes de que el anterior terminara de escribir, y el
  // resultado era una ráfaga de notificaciones duplicadas.
  useEffect(() => {
    if (!currentFloor) return
    let cancelled = false

    async function run() {
      const effectiveRotationOrder = (currentFloor.rotationOrder || []).filter((id) => !awayUserIds.has(id))
      await ensureActivityPeriods(activities, effectiveRotationOrder, weekKey, currentFloor)
      if (cancelled) return

      const fixedActivities = activities.filter((a) => a.fixedKey)
      const periodCompletions = await getAll('activity_completions', { floorId: currentFloor.id })
      for (const activity of fixedActivities) {
        const period = currentPeriodKey(activity, weekKey)
        if (!period) continue
        const completion = periodCompletions.find((c) => c.activityId === activity.id && c.periodKey === period)
        if (!completion?.assignedUserId) continue
        await notifyUser(
          currentFloor.id,
          completion.assignedUserId,
          'turno',
          `Esta semana te toca: ${activity.title}`,
          weekKey,
          `turno:${currentFloor.id}:${weekKey}:${activity.id}`
        )
      }

      if (currentFloor.potAmount < currentFloor.potThreshold) {
        const id = await deterministicUuid(`notif:pote:${currentFloor.id}:${weekKey}`)
        await upsertIgnoreDuplicates(
          'notifications',
          [
            {
              id,
              floorId: currentFloor.id,
              userId: null,
              type: 'pote',
              weekKey,
              read: false,
              message: `El pote de compras está bajo (${currentFloor.potAmount}€). Sugerido: ${currentFloor.potPerPerson}€ por persona.`
            }
          ],
          ['id']
        )
      }
    }

    run()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentFloor?.id,
    currentFloor?.rotationOrder?.length,
    currentFloor?.rotationMode,
    currentFloor?.rotationPeriodUnit,
    currentFloor?.rotationPeriodInterval,
    currentFloor?.potAmount,
    weekKey,
    awayUserIds,
    activities
  ])

  // Igual que arriba pero para el gestor de actividades propias: arma
  // (idempotente) la fila de activity_completions del período actual de
  // cada actividad recurrente. Las 'once' no pasan por acá — su única
  // fila se crea al crear la actividad (ver addActivity).
  useEffect(() => {
    if (!currentFloor) return
    const effectiveRotationOrder = (currentFloor.rotationOrder || []).filter((id) => !awayUserIds.has(id))
    ensureActivityPeriods(activities, effectiveRotationOrder, weekKey, currentFloor)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFloor?.id, currentFloor?.rotationOrder?.length, currentFloor?.rotationMode, currentFloor?.rotationPeriodUnit, currentFloor?.rotationPeriodInterval, weekKey, activities.length, awayUserIds])

  const floorTasks = useMemo(() => tasks.filter((t) => t.weekKey === weekKey), [tasks, weekKey])

  const floorIncidents = useMemo(() => {
    const now = Date.now()
    return incidents
      .filter((i) => !i.expiresAt || new Date(i.expiresAt).getTime() > now)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  }, [incidents])

  const myNotifications = useMemo(
    () =>
      notifications
        .filter((n) => n.userId === user?.id || n.userId === null)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [notifications, user]
  )

  const unreadCount = myNotifications.filter((n) => !n.read).length

  // Pareja de habitación aceptada del usuario actual, resuelta al otro
  // miembro (no solo el id) para poder mostrar nombre/avatar directo.
  const myRoomPartner = useMemo(() => {
    if (!user) return null
    const accepted = roomPartners.find(
      (p) => p.status === 'accepted' && (p.requesterId === user.id || p.partnerId === user.id)
    )
    if (!accepted) return null
    const otherId = accepted.requesterId === user.id ? accepted.partnerId : accepted.requesterId
    return { requestId: accepted.id, member: members.find((m) => m.id === otherId) || null }
  }, [roomPartners, user, members])

  // Invitaciones de pareja que me llegaron a mí (para Aceptar/Rechazar) y
  // la mía propia si estoy esperando que la otra persona confirme.
  const incomingPartnerRequests = useMemo(
    () => roomPartners.filter((p) => p.status === 'pending' && p.partnerId === user?.id),
    [roomPartners, user]
  )
  const outgoingPartnerRequest = useMemo(
    () => roomPartners.find((p) => p.status === 'pending' && p.requesterId === user?.id) || null,
    [roomPartners, user]
  )

  // Título legible del turno al que apunta una solicitud de intercambio
  // (una tarea fija o una actividad propia), para mostrarlo en la
  // solicitud sin que quien la ve tenga que ir a buscarlo.
  const describeSwapTarget = useCallback(
    (req) => {
      if (req.targetType === 'task') {
        const task = tasks.find((ts) => ts.id === req.targetId)
        return task ? fixedTaskOverride(currentFloor, task.type)?.title || t(`taskTypes.${task.type}`) : t('convives.swapTargetTask')
      }
      const completion = activityCompletions.find((c) => c.id === req.targetId)
      const activity = completion ? activities.find((a) => a.id === completion.activityId) : null
      return activity?.title || t('convives.swapTargetActivity')
    },
    [tasks, activities, activityCompletions, t, currentFloor]
  )

  // Solicitudes de intercambio de turno que me llegaron a mí (para
  // Aceptar/Rechazar) y las mías propias esperando que la otra persona
  // decida (para poder Anular) — resueltas con nombre de la otra
  // persona y el título del turno.
  const incomingSwapRequests = useMemo(
    () =>
      swapRequests
        .filter((r) => r.status === 'pending' && r.toUserId === user?.id)
        .map((r) => ({ ...r, fromMember: members.find((m) => m.id === r.fromUserId), title: describeSwapTarget(r) })),
    [swapRequests, user, members, describeSwapTarget]
  )
  const outgoingSwapRequests = useMemo(
    () =>
      swapRequests
        .filter((r) => r.status === 'pending' && r.fromUserId === user?.id)
        .map((r) => ({ ...r, toMember: members.find((m) => m.id === r.toUserId), title: describeSwapTarget(r) })),
    [swapRequests, user, members, describeSwapTarget]
  )

  // Selectores reutilizados por Votaciones (bandeja unificada) además de
  // por sus pantallas originales — antes se recalculaban solo con un
  // filter local en cada pantalla, ahora viven acá para no duplicar la
  // lógica.
  const myAbsenceRequests = useMemo(() => absenceRequests.filter((r) => r.userId === user?.id), [absenceRequests, user])
  const pendingAbsenceRequests = useMemo(() => absenceRequests.filter((r) => r.status === 'pending'), [absenceRequests])
  const removalPending = useMemo(() => members.filter((m) => m.removalRequestedBy), [members])

  // --- Acciones ---

  // Crea una notificación para userId y, si tiene una pareja de
  // habitación aceptada en este piso, una copia idéntica para ella —
  // así ninguna de las dos se queda sin enterarse de lo que le toca al
  // otro. Usar esto en vez de create('notifications', ...) directo
  // para cualquier notificación dirigida a UNA sola persona (las de
  // todo el piso ya le llegan a la pareja igual, por ser miembro activo).
  //
  // `dedupeKey` (opcional) es para notificaciones AUTOMÁTICAS que un
  // efecto podría llegar a generar más de una vez seguida (dos
  // pestañas abiertas, StrictMode en desarrollo, una reconexión): en
  // vez de un create() plano, arma un id determinístico a partir de
  // esa clave y hace upsert-ignorando-duplicados sobre `id` — así, si
  // el efecto se dispara dos veces, la segunda no crea una fila
  // repetida. No usar para notificaciones que sí pueden repetirse
  // legítimamente (ej. varias propuestas de intercambio).
  // Perfiles virtuales (personas del piso sin cuenta): ver lib/virtualMembers.js.
  const virtualMemberIds = useMemo(() => virtualIdSet(members), [members])

  const notifyUser = useCallback(
    async (targetFloorId, userId, type, message, weekKeyArg = null, dedupeKey = null) => {
      // Un perfil virtual no usa la app: nunca se le crea una notificación.
      if (userId && virtualMemberIds.has(userId)) return
      async function insertOne(forUserId) {
        const row = { floorId: targetFloorId, userId: forUserId, type, weekKey: weekKeyArg, read: false, message }
        if (dedupeKey) {
          const id = await deterministicUuid(`notif:${dedupeKey}:${forUserId ?? 'floor'}`)
          await upsertIgnoreDuplicates('notifications', [{ id, ...row }], ['id'])
        } else {
          await create('notifications', row)
        }
      }

      await insertOne(userId)
      const partnership = roomPartners.find(
        (p) =>
          p.status === 'accepted' &&
          p.floorId === targetFloorId &&
          (p.requesterId === userId || p.partnerId === userId)
      )
      if (partnership) {
        const partnerUserId = partnership.requesterId === userId ? partnership.partnerId : partnership.requesterId
        await insertOne(partnerUserId)
      }
    },
    [roomPartners, virtualMemberIds]
  )

  const requestRoomPartner = useCallback(
    async (partnerUserId) => {
      if (!currentFloor || !user) return
      await create('room_partners', { floorId: currentFloor.id, requesterId: user.id, partnerId: partnerUserId })
    },
    [currentFloor, user]
  )

  const acceptRoomPartner = useCallback(
    async (requestId) => {
      await update('room_partners', requestId, { status: 'accepted', decidedAt: new Date().toISOString() })
      // Al confirmarse la pareja de habitación, se dejan contiguas en el
      // orden de rotación semanal: así, a quien comparte habitación le
      // toca la semana siguiente a la de su compañero (ver
      // placeAdjacentInRotation).
      const request = roomPartners.find((r) => r.id === requestId)
      if (request && currentFloor) {
        const newOrder = placeAdjacentInRotation(currentFloor.rotationOrder, request.requesterId, request.partnerId)
        await update('floors', currentFloor.id, { rotationOrder: newOrder })
      }
    },
    [roomPartners, currentFloor]
  )

  const rejectRoomPartner = useCallback(
    (requestId) => update('room_partners', requestId, { status: 'rejected', decidedAt: new Date().toISOString() }),
    []
  )

  const cancelRoomPartner = useCallback((requestId) => update('room_partners', requestId, { status: 'cancelled' }), [])

  // Intercambiar turno (Convives): no es instantáneo, se propone y la
  // otra persona acepta/rechaza — mismo espíritu que room_partners.
  // target puede ser una tarea fija ('task') o el período actual de
  // una actividad propia ('activity_completion'); target_id/type son
  // polimórficos, se resuelven contra la tabla correcta a mano.
  const requestSwap = useCallback(
    async ({ targetType, targetId, toUserId, title }) => {
      if (!currentFloor || !user) return
      await create('swap_requests', {
        floorId: currentFloor.id,
        targetType,
        targetId,
        fromUserId: user.id,
        toUserId
      })
      await notifyUser(currentFloor.id, toUserId, 'swap', `${user.name} te propone intercambiar "${title}" contigo`)
    },
    [currentFloor, user, notifyUser]
  )

  const acceptSwap = useCallback(
    async (requestId) => {
      const request = swapRequests.find((r) => r.id === requestId)
      if (!request || !currentFloor) return
      // Revalida que el turno siga siendo de quien propuso — pudo haber
      // cambiado de manos mientras la solicitud esperaba respuesta (otra
      // rotación, otro intercambio ya aceptado, etc.).
      const table = request.targetType === 'task' ? 'tasks' : 'activity_completions'
      const current =
        request.targetType === 'task'
          ? tasks.find((t) => t.id === request.targetId)
          : activityCompletions.find((c) => c.id === request.targetId)
      if (!current || current.assignedUserId !== request.fromUserId) {
        await update('swap_requests', requestId, { status: 'declined', decidedAt: new Date().toISOString() })
        return { ok: false, message: 'Ese turno ya no le corresponde a quien lo propuso.' }
      }
      await update(table, request.targetId, { assignedUserId: request.toUserId })
      await update('swap_requests', requestId, { status: 'accepted', decidedAt: new Date().toISOString() })
      const toName = members.find((m) => m.id === request.toUserId)?.name || 'Alguien'
      await notifyUser(currentFloor.id, request.fromUserId, 'swap', `${toName} aceptó tu intercambio de turno`)
      return { ok: true }
    },
    [swapRequests, currentFloor, tasks, activityCompletions, members, notifyUser]
  )

  const declineSwap = useCallback(
    async (requestId) => {
      const request = swapRequests.find((r) => r.id === requestId)
      await update('swap_requests', requestId, { status: 'declined', decidedAt: new Date().toISOString() })
      if (request && currentFloor) {
        const fromName = members.find((m) => m.id === request.toUserId)?.name || 'Alguien'
        await notifyUser(currentFloor.id, request.fromUserId, 'swap', `${fromName} no pudo aceptar tu intercambio de turno`)
      }
    },
    [swapRequests, currentFloor, members, notifyUser]
  )

  const cancelSwap = useCallback((requestId) => update('swap_requests', requestId, { status: 'cancelled' }), [])

  const completeTask = useCallback(
    async (taskId) => {
      const task = tasks.find((t) => t.id === taskId)
      await update('tasks', taskId, { completed: true, completedAt: new Date().toISOString() })
      if (task) {
        const typeInfo = TASK_TYPES.find((tt) => tt.key === task.type)
        const assignee = members.find((m) => m.id === task.assignedUserId)
        if (assignee) {
          await update('profiles', assignee.id, { points: (assignee.points || 0) + (typeInfo?.points || 0) })
        }
      }
    },
    [tasks, members]
  )

  const uncompleteTask = useCallback((taskId) => update('tasks', taskId, { completed: false, completedAt: null }), [])

  const reorderRotation = useCallback(
    (newOrder) => {
      if (!currentFloor) return
      update('floors', currentFloor.id, { rotationOrder: newOrder })
    },
    [currentFloor]
  )

  const removeMember = useCallback(
    async (membershipId, profileId) => {
      if (!currentFloor) return
      const leavingName = members.find((m) => m.id === profileId)?.name || 'Alguien'
      const newOrder = (currentFloor.rotationOrder || []).filter((id) => id !== profileId)
      await reassignPendingTasks(currentFloor.id, profileId, newOrder)
      await update('floors', currentFloor.id, { rotationOrder: newOrder })
      // El aviso se crea ANTES de cerrar la propia membresía: la política
      // RLS de "notifications" exige is_active_member(floor_id), que mira
      // la membresía de quien llama (auth.uid()) — si se cerrara primero,
      // este insert quedaría bloqueado justo para quien se está yendo.
      await create('notifications', {
        floorId: currentFloor.id,
        userId: null,
        type: 'member_left',
        message: `${leavingName} ha dejado el piso`
      })
      // Cerrar la membresía, no borrar el perfil: el usuario queda en
      // historial y podrá reactivarla más adelante con aprobación de un
      // admin de ese piso.
      await update('floor_memberships', membershipId, {
        status: 'left',
        leftAt: new Date().toISOString(),
        removalRequestedBy: null,
        removalRequestedAt: null
      })
    },
    [currentFloor, members]
  )

  // Quitar un perfil virtual (solo admins): igual que una salida normal —su
  // historial se conserva— pero además sus turnos pendientes de ESTE período
  // pasan a quien corresponde ahora en la rotación. Sin eso quedarían asignados
  // a alguien que ya no está en el piso y nadie podría marcarlos.
  const removeVirtualMember = useCallback(
    async (member) => {
      if (!currentFloor || !member?.isVirtual) return
      const newOrder = (currentFloor.rotationOrder || []).filter((id) => id !== member.id)
      const effectiveOrder = newOrder.filter((id) => !awayUserIds.has(id))
      for (const c of activityCompletions) {
        if (c.assignedUserId !== member.id || c.completed) continue
        const activity = activities.find((a) => a.id === c.activityId)
        if (!activity) continue
        const isCurrent = activity.frequencyType === 'once' || c.periodKey === currentPeriodKey(activity, weekKey)
        if (!isCurrent) continue
        const next = assigneeFor(activity, effectiveOrder, weekKey, currentFloor)
        await update('activity_completions', c.id, { assignedUserId: next && next !== member.id ? next : null })
      }
      // Actividades fijas a su nombre: pasan a "Todos".
      for (const a of activities) {
        if (a.assignedUserId === member.id) await update('activities', a.id, { assignedUserId: null })
      }
      await removeMember(member.membershipId, member.id)
    },
    [currentFloor, activities, activityCompletions, weekKey, awayUserIds, removeMember]
  )

  // Un admin inicia la salida de OTRO miembro: no lo elimina al instante,
  // solo lo marca "pendiente de confirmación" y le avisa. El propio
  // afectado tiene que confirmar (confirmMyRemoval / removeMember) para
  // que la salida se haga efectiva de verdad.
  const initiateRemoval = useCallback(
    async (membershipId, targetUserId, targetName) => {
      if (!currentFloor || !user) return
      await update('floor_memberships', membershipId, {
        removalRequestedBy: user.id,
        removalRequestedAt: new Date().toISOString()
      })
      await notifyUser(
        currentFloor.id,
        targetUserId,
        'removal_requested',
        `Un administrador ha iniciado tu salida de ${currentFloor.name}. Debes confirmarla en tu Perfil.`
      )
    },
    [currentFloor, user, notifyUser]
  )

  const cancelRemoval = useCallback(
    async (membershipId, targetUserId, targetName) => {
      if (!currentFloor) return
      await update('floor_memberships', membershipId, { removalRequestedBy: null, removalRequestedAt: null })
      await notifyUser(
        currentFloor.id,
        targetUserId,
        'removal_cancelled',
        `Se canceló el proceso de salida de ${targetName || 'tu cuenta'} del piso.`
      )
    },
    [currentFloor, notifyUser]
  )

  // El propio afectado rechaza la solicitud de salida que un admin
  // inició sobre él: sigue en el piso sin ningún cambio. Distinta de
  // cancelRemoval (que es el admin cancelándola él mismo) porque el
  // aviso tiene que ir al lado correcto: acá se le avisa a quien la
  // inició, no al afectado (que ya sabe que la rechazó él mismo).
  const rejectMyRemoval = useCallback(
    async (membershipId) => {
      if (!currentFloor || !user) return
      const membership = members.find((m) => m.membershipId === membershipId)
      const requestedBy = membership?.removalRequestedBy
      await update('floor_memberships', membershipId, { removalRequestedBy: null, removalRequestedAt: null })
      if (requestedBy) {
        await notifyUser(
          currentFloor.id,
          requestedBy,
          'removal_rejected',
          `${user.name} rechazó la solicitud de salida del piso. Sigue en ${currentFloor.name} sin cambios.`
        )
      }
    },
    [currentFloor, user, members, notifyUser]
  )

  const setMemberRole = useCallback((membershipId, role) => update('floor_memberships', membershipId, { role }), [])

  const addIncident = useCallback(
    async (incident) => {
      if (!currentFloor || !user) return
      await create('incidents', {
        floorId: currentFloor.id,
        userId: user.id,
        authorName: user.name,
        title: incident.title,
        description: incident.description,
        photoUrl: incident.photoUrl || null,
        expiresAt: incident.expiresAt || null
      })
    },
    [currentFloor, user]
  )

  const removeIncident = useCallback((incidentId) => remove('incidents', incidentId), [])

  const markNotificationRead = useCallback((notificationId) => update('notifications', notificationId, { read: true }), [])

  const markAllNotificationsRead = useCallback(async () => {
    for (const n of myNotifications) {
      if (!n.read) await update('notifications', n.id, { read: true })
    }
  }, [myNotifications])

  // Espacios compartidos (Actividades → "Espacios compartidos", ver
  // lib/sharedSpaces.js): "Voy a usarla" registra un uso con hora de fin y le
  // manda un aviso a TODO el piso diciendo quién lo va a usar. Mientras ese
  // uso siga vigente el espacio figura "en uso" para todos (no es un turno
  // ni una actividad: no hay rotación ni puntos). Si ya hay un uso vigente
  // no se crea otro ({ ok:false, reason:'busy' }).
  const startSharedSpaceUse = useCallback(
    async (spaceKey, minutes) => {
      const space = SHARED_SPACE_BY_KEY[spaceKey]
      if (!currentFloor || !user || !space) return { ok: false, reason: 'invalid' }
      const busy = currentSpaceUse(sharedSpaceUses, spaceKey)
      if (busy) return { ok: false, reason: 'busy', use: busy }
      const duration = Math.min(360, Math.max(15, Number(minutes) || space.defaultMinutes))
      const startsAt = new Date()
      const endsAt = new Date(startsAt.getTime() + duration * 60000)
      const created = await create('shared_space_uses', {
        floorId: currentFloor.id,
        spaceKey,
        userId: user.id,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString()
      })
      setSharedSpaceUses((list) => [...list.filter((u) => u.id !== created.id), created])
      const until = endsAt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
      await create('notifications', {
        floorId: currentFloor.id,
        userId: null,
        type: 'shared_space',
        message: `${user.name} va a usar ${space.notifyName} hasta las ${until}. Espera a que termine antes de usarla.`
      })
      return { ok: true, use: created }
    },
    [currentFloor, user, sharedSpaceUses]
  )

  // "Ya terminé": libera el espacio antes de que venza el tiempo.
  const releaseSharedSpaceUse = useCallback(async (useId) => {
    const releasedAt = new Date().toISOString()
    await update('shared_space_uses', useId, { releasedAt })
    setSharedSpaceUses((list) => list.map((u) => (u.id === useId ? { ...u, releasedAt } : u)))
  }, [])

  const addPotContribution = useCallback(
    async (amount, onBehalfOfId = null) => {
      if (!currentFloor || !user) return
      // En nombre de un perfil virtual: el aporte es suyo, queda anotado quién lo registró.
      const onBehalf = onBehalfOfId && virtualMemberIds.has(onBehalfOfId) ? onBehalfOfId : null
      await create('pot_contributions', {
        floorId: currentFloor.id,
        userId: onBehalf || user.id,
        amount: Number(amount),
        recordedBy: onBehalf ? user.id : null
      })
      await update('floors', currentFloor.id, { potAmount: (currentFloor.potAmount || 0) + Number(amount) })
    },
    [currentFloor, user, virtualMemberIds]
  )

  const setMemberPotActive = useCallback(
    (membershipId, active) => update('floor_memberships', membershipId, { potActive: active }),
    []
  )

  const setMemberActiveStatus = useCallback(
    (membershipId, active) => update('floor_memberships', membershipId, { activeStatus: active }),
    []
  )

  // "Estoy fuera" de Convives: instantáneo, nadie tiene que aprobarlo —
  // ni siquiera cuando lo marca OTRO compañero sobre un tercero (dato de
  // bajo riesgo, autocorregible: si está mal, cualquiera lo revierte en
  // un toque). declareAway también apaga pot_active (misma exclusión del
  // reparto del pote que ya usaba el toggle viejo de "vacaciones"), para
  // no duplicar ese mecanismo. Si quien lo marca no es la propia persona,
  // se le avisa — nunca debe enterarse por su cuenta de que otro cambió
  // su estado.
  // Refleja al instante en la lista local un cambio ya guardado en
  // floor_memberships (Realtime lo confirma después con su propio refresco).
  const patchMember = (membershipId, patch) =>
    setMembers((list) => list.map((m) => (m.membershipId === membershipId ? { ...m, ...patch } : m)))

  const declareAway = useCallback(
    async (membershipId, targetUserId, untilDate) => {
      await update('floor_memberships', membershipId, { potActive: false, awayUntil: untilDate })
      patchMember(membershipId, { potActive: false, awayUntil: untilDate })
      if (currentFloor && user && targetUserId && targetUserId !== user.id) {
        await notifyUser(
          currentFloor.id,
          targetUserId,
          'marked_away',
          `${user.name} te marcó como "Fuera del piso" hasta el ${untilDate}. Si ya estás de vuelta, corrígelo tocando tu estado en Convives.`
        )
      }
    },
    [currentFloor, user, notifyUser]
  )
  const returnFromAway = useCallback(async (membershipId) => {
    await update('floor_memberships', membershipId, { potActive: true, awayUntil: null })
    patchMember(membershipId, { potActive: true, awayUntil: null })
  }, [])

  // Solicitud formal de "estar fuera del piso" (con fechas y motivo,
  // pendiente de aprobación de un admin) — distinta del toggle instantáneo
  // de vacaciones en Convives, que sigue existiendo tal cual.
  const requestAbsence = useCallback(
    async ({ startDate, endDate, reason }) => {
      if (!currentFloor || !user) return
      await create('absence_requests', {
        floorId: currentFloor.id,
        userId: user.id,
        startDate,
        endDate,
        reason: reason || null
      })
      const admins = members.filter((m) => m.role === 'admin')
      for (const admin of admins) {
        await notifyUser(
          currentFloor.id,
          admin.id,
          'absence_requested',
          `${user.name} solicitó estar fuera del piso del ${startDate} al ${endDate}.`
        )
      }
    },
    [currentFloor, user, members, notifyUser]
  )

  // Al aprobar, reutiliza pot_active (misma exclusión que ya usa
  // "vacaciones" en Convives) para no duplicar el mecanismo; la exclusión
  // de la rotación de tareas la calcula awayUserIds más arriba.
  const decideAbsenceRequest = useCallback(
    async (requestId, approve) => {
      if (!currentFloor || !user) return
      const request = absenceRequests.find((r) => r.id === requestId)
      if (!request) return
      await update('absence_requests', requestId, {
        status: approve ? 'approved' : 'rejected',
        decidedBy: user.id,
        decidedAt: new Date().toISOString()
      })
      if (approve) {
        const member = members.find((m) => m.id === request.userId)
        if (member) await update('floor_memberships', member.membershipId, { potActive: false })
      }
      await notifyUser(
        currentFloor.id,
        request.userId,
        'absence_decided',
        approve
          ? `Tu solicitud para estar fuera del piso fue aprobada.`
          : `Tu solicitud para estar fuera del piso fue rechazada. Sigues en la rotación.`
      )
    },
    [currentFloor, user, absenceRequests, members, notifyUser]
  )

  const cancelAbsenceRequest = useCallback((requestId) => update('absence_requests', requestId, { status: 'cancelled' }), [])

  // "patch" puede traer un File en avatarFile (foto nueva a subir); el
  // resto de campos se guarda tal cual, como un patch parcial normal.
  const updateProfile = useCallback(async (profileId, patch) => {
    const { avatarFile, ...rest } = patch
    if (avatarFile) {
      rest.avatarUrl = await uploadAvatar(avatarFile, profileId)
    }
    return update('profiles', profileId, rest)
  }, [])

  const adjustMemberPoints = useCallback(
    async (profileId, delta, reason) => {
      if (!currentFloor) return
      const member = members.find((m) => m.id === profileId)
      if (!member) return
      await update('profiles', profileId, { points: Math.max(0, (member.points || 0) + Number(delta)) })
      await create('coin_transactions', {
        floorId: currentFloor.id,
        userId: profileId,
        amount: Number(delta),
        reason: reason || null
      })
    },
    [currentFloor, members]
  )

  const addPotExpense = useCallback(
    async (amount, { note, receiptFile, onBehalfOfId = null } = {}) => {
      if (!currentFloor || !user) return
      const onBehalf = onBehalfOfId && virtualMemberIds.has(onBehalfOfId) ? onBehalfOfId : null
      let receiptUrl = null
      if (receiptFile) {
        receiptUrl = await uploadPotReceipt(receiptFile, currentFloor.id)
      }
      const created = await create('pot_contributions', {
        floorId: currentFloor.id,
        userId: onBehalf || user.id,
        recordedBy: onBehalf ? user.id : null,
        amount: -Math.abs(Number(amount)),
        note: note || null,
        receiptUrl,
        // Quiénes se reparten este gasto: los que NO están "fuera" ahora
        // mismo. Se guarda en el propio gasto (no se recalcula después),
        // así volver o irse más tarde no cambia gastos ya hechos. Si todos
        // están fuera, se reparte entre todos (ver computeWallets).
        splitAmong: members.filter((m) => m.potActive !== false).map((m) => m.id)
      })
      await update('floors', currentFloor.id, { potAmount: Math.max(0, (currentFloor.potAmount || 0) - Number(amount)) })
      return created
    },
    [currentFloor, user, members, virtualMemberIds]
  )

  // Solo el autor de un gasto puede editarlo/borrarlo, y solo durante las
  // 24h siguientes a haberlo publicado (lo hace cumplir la política RLS;
  // esto además ajusta floors.pot_amount por la diferencia para que el
  // total del pote quede correcto tras el cambio).
  const updatePotExpense = useCallback(
    async (contributionId, { amount, note }) => {
      if (!currentFloor) return
      const existing = potContributions.find((c) => c.id === contributionId)
      if (!existing) return
      const newAmount = -Math.abs(Number(amount))
      const delta = newAmount - Number(existing.amount)
      await update('pot_contributions', contributionId, { amount: newAmount, note: note || null })
      await update('floors', currentFloor.id, { potAmount: Math.max(0, (currentFloor.potAmount || 0) + delta) })
    },
    [currentFloor, potContributions]
  )

  const deletePotExpense = useCallback(
    async (contributionId) => {
      if (!currentFloor) return
      const existing = potContributions.find((c) => c.id === contributionId)
      if (!existing) return
      await remove('pot_contributions', contributionId)
      await update('floors', currentFloor.id, { potAmount: Math.max(0, (currentFloor.potAmount || 0) - Number(existing.amount)) })
    },
    [currentFloor, potContributions]
  )

  const claimJoinRequests = useCallback(async () => {
    if (!currentFloor || !user) return []
    return claimPendingJoinRequests(currentFloor.id, user.id)
  }, [currentFloor, user])

  const approveJoinRequest = useCallback(
    async (membershipId, requesterId, requesterName) => {
      if (!currentFloor) return
      await update('floor_memberships', membershipId, { status: 'active' })
      await update('floors', currentFloor.id, {
        rotationOrder: [...(currentFloor.rotationOrder || []), requesterId]
      })
      await create('notifications', {
        floorId: currentFloor.id,
        userId: null,
        type: 'member_joined',
        message: `${requesterName} se ha unido al piso`
      })
    },
    [currentFloor]
  )

  const rejectJoinRequest = useCallback(
    (membershipId) => update('floor_memberships', membershipId, { status: 'rejected' }),
    []
  )

  const addShoppingItem = useCallback(
    async (item) => {
      if (!currentFloor || !user) return
      let imageUrl = null
      if (item.imageFile) {
        imageUrl = await uploadShoppingItemImage(item.imageFile, currentFloor.id)
      }
      return create('shopping_items', {
        floorId: currentFloor.id,
        name: item.name,
        store: item.store || null,
        storeLocation: item.storeLocation || null,
        usualQuantity: item.usualQuantity || null,
        // Una compra puntual nunca lleva Status: siempre 'ok' (neutro).
        stockLevel: item.recurring === false ? 'ok' : item.stockLevel || 'ok',
        recurring: item.recurring !== false,
        estimatedPrice: item.estimatedPrice ? Number(item.estimatedPrice) : null,
        imageUrl,
        note: item.note || null,
        linkUrl: item.linkUrl || null,
        createdBy: user.id
      })
    },
    [currentFloor, user]
  )

  // "patch" puede traer un File en imageFile (foto nueva a subir); el
  // resto de campos se guarda tal cual, como un patch parcial normal.
  const updateShoppingItem = useCallback(
    async (itemId, patch) => {
      const { imageFile, ...rest } = patch
      if (imageFile && currentFloor) {
        rest.imageUrl = await uploadShoppingItemImage(imageFile, currentFloor.id)
      }
      // Si un producto pasa a ser puntual, se limpia el Status que
      // tuviera (p. ej. "agotado") — una puntual no lo maneja.
      if (rest.recurring === false) rest.stockLevel = 'ok'
      return update('shopping_items', itemId, rest)
    },
    [currentFloor]
  )

  const removeShoppingItem = useCallback((itemId) => remove('shopping_items', itemId), [])

  // Solo notifica a todo el piso cuando el stock RECIÉN llega a 0 (no en
  // cada guardado): compara contra el nivel anterior para no repetir la
  // alerta si alguien vuelve a marcar "agotado" un producto que ya lo estaba.
  const setItemStock = useCallback(
    async (itemId, level) => {
      const item = shoppingItems.find((i) => i.id === itemId)
      if (!item || !currentFloor || !item.recurring) return
      await update('shopping_items', itemId, { stockLevel: level })
      if (level === 'out' && item.stockLevel !== 'out') {
        await create('notifications', {
          floorId: currentFloor.id,
          userId: null,
          type: 'stock_out',
          message: `¡Alerta! ${item.name} se ha agotado. Es necesario reponerlo.`
        })
      }
    },
    [shoppingItems, currentFloor]
  )

  const redeemReward = useCallback(
    async (rewardKey) => {
      const reward = REWARD_CATALOG.find((r) => r.key === rewardKey)
      if (!reward || !user) return { ok: false, message: t('rewards.notFoundToast') }
      if ((user.points || 0) < reward.cost) {
        return { ok: false, message: t('rewards.notEnoughPointsToast') }
      }
      const rewardLabel = t(`rewardCatalog.${reward.key}`)
      await update('profiles', user.id, { points: user.points - reward.cost })
      await create('redemptions', {
        floorId: currentFloor.id,
        userId: user.id,
        userName: user.name,
        rewardKey: reward.key,
        rewardLabel,
        cost: reward.cost
      })
      refreshAuth()
      return { ok: true, message: t('rewards.redeemedToast', { label: rewardLabel }) }
    },
    [user, currentFloor, refreshAuth, t]
  )

  // Actividad nueva del gestor propio (ver src/lib/activities.js). Si es
  // un evento único ('once'), de una vez crea también su única fila de
  // activity_completions — no pasa por el efecto de arriba porque ese
  // solo cubre recurrentes.
  const addActivity = useCallback(
    async (input) => {
      if (!currentFloor || !user) return
      const isWeekRecurrence = input.frequencyType === 'recurring' && input.recurrenceUnit === 'week'
      const activity = await create('activities', {
        floorId: currentFloor.id,
        title: input.title,
        fixedKey: input.fixedKey || null,
        points: input.points ?? null,
        frequencyType: input.frequencyType,
        recurrenceUnit: input.frequencyType === 'recurring' ? input.recurrenceUnit : null,
        recurrenceInterval: input.frequencyType === 'recurring' ? Number(input.recurrenceInterval) || 1 : 1,
        weekdays: isWeekRecurrence ? input.weekdays || [] : null,
        startDate: input.startDate || new Date().toISOString().slice(0, 10),
        untilDate: input.frequencyType === 'recurring' ? input.untilDate || null : null,
        timesPerWeek: isWeekRecurrence ? Math.max(1, (input.weekdays || []).length) : null,
        specificDate: input.frequencyType === 'once' ? input.specificDate : null,
        assignmentMode: input.frequencyType === 'once' ? 'manual' : input.assignmentMode,
        // null = "Todos" (nadie en particular) — ya no se exige elegir a alguien.
        assignedUserId: (input.assignmentMode === 'manual' || input.frequencyType === 'once') ? input.assignedUserId || null : null,
        createdBy: user.id
      })
      if (activity.frequencyType === 'once') {
        await create('activity_completions', {
          activityId: activity.id,
          floorId: currentFloor.id,
          periodKey: currentPeriodKey(activity, weekKey),
          assignedUserId: activity.assignedUserId,
          timesDone: 0,
          completed: false
        })
      }
      return activity
    },
    [currentFloor, user, weekKey]
  )

  // Mismo cálculo de timesPerWeek que addActivity (a partir de weekdays)
  // — ActivityForm siempre manda el objeto completo al editar, así que
  // es seguro recalcularlo entero en vez de solo mezclar el patch.
  const updateActivity = useCallback((activityId, patch) => {
    const isWeekRecurrence = patch.frequencyType === 'recurring' && patch.recurrenceUnit === 'week'
    return update('activities', activityId, {
      ...patch,
      timesPerWeek: isWeekRecurrence ? Math.max(1, (patch.weekdays || []).length) : null
    })
  }, [])
  const removeActivity = useCallback((activityId) => remove('activities', activityId), [])

  // Progreso del período actual de una actividad: para timesPerWeek=1 (o
  // mensual/evento único) es un simple hecho/deshecho; si tiene varias
  // veces por semana, delta suma/resta contra el objetivo.
  // Cada ocasión marcada queda en activity_marks (kind 'routine') con
  // quién la hizo, cuándo y los puntos que dio: los puntos de la
  // actividad se reparten entre sus ocasiones (occurrencePoints) y son de
  // QUIEN EJECUTA, sea o no el responsable del turno. Deshacer no borra
  // nada: añade una marca 'undo' (queda en el historial), anula la marca
  // vigente más reciente y le quita esos puntos a quien la hizo — solo lo
  // puede deshacer esa misma persona o un admin del piso
  // ({ ok:false, reason:'not_yours' }). Los turnos anteriores a este
  // registro (sin marcas) se deshacen sin reversa de puntos.
  // "Marcar hecho" es el cumplimiento de lo ASIGNADO: si el turno es de
  // otra persona devuelve { ok:false, reason:'not_your_turn' } (quien no es
  // el responsable usa "+ Extra", ver addActivityExtra). `force` (compra
  // completa) también salta esta regla.
  // Devuelve { ok:false, reason:'not_yet', dateKey } si es una actividad
  // "N veces por semana" y todavía no llega el día de la siguiente
  // ocasión (ver occurrenceSlots) — quien llama avisa al usuario. `force`
  // salta esa regla (la compra completa de "Hacer la compra" cumple todo).
  const setActivityProgress = useCallback(
    async (completion, delta, { force = false } = {}) => {
      const activity = activities.find((a) => a.id === completion.activityId)
      const target = activity?.timesPerWeek || 1
      if (delta > 0 && !force && activity && !canUserMark(activity, completion, user?.id, virtualMemberIds)) {
        return { ok: false, reason: 'not_your_turn' }
      }
      if (delta > 0 && !force && activity) {
        const occ = occurrenceSlots(activity, completion)
        if (occ.gated && !occ.canMark) return { ok: false, reason: 'not_yet', dateKey: occ.nextDateKey }
      }
      const before = completion.timesDone || 0
      const timesDone = Math.min(target, Math.max(0, before + delta))
      const nowCompleted = timesDone >= target

      // Deshacer: qué marcas vigentes se anulan, y con permiso.
      const toUndo = []
      if (timesDone < before) {
        const stack = activeRoutineMarks(activityMarks, completion.id)
        const isAdmin = members.find((m) => m.id === user?.id)?.role === 'admin'
        for (let i = 0; i < before - timesDone; i++) {
          const mark = stack[stack.length - 1 - i]
          if (!mark) break
          if (mark.markedBy !== user?.id && !isAdmin) return { ok: false, reason: 'not_yours' }
          toUndo.push(mark)
        }
      }

      await update('activity_completions', completion.id, {
        timesDone,
        completed: nowCompleted,
        completedAt: nowCompleted ? new Date().toISOString() : null
      })

      if (currentFloor && user) {
        const points = {} // profileId → variación de puntos
        for (let i = before; i < timesDone; i++) {
          // Marcar en nombre de un perfil virtual no da puntos a nadie.
          const onBehalf = virtualMemberIds.has(completion.assignedUserId || activity?.assignedUserId)
          const earned = onBehalf ? 0 : occurrencePoints(activity?.points, i, target)
          await create('activity_marks', {
            floorId: currentFloor.id,
            activityId: completion.activityId,
            completionId: completion.id,
            markedBy: user.id,
            kind: 'routine',
            points: earned
          })
          if (earned) points[user.id] = (points[user.id] || 0) + earned
        }
        for (const mark of toUndo) {
          await create('activity_marks', {
            floorId: currentFloor.id,
            activityId: completion.activityId,
            completionId: completion.id,
            markedBy: user.id,
            kind: 'undo',
            points: -(mark.points || 0)
          })
          if (mark.points && mark.markedBy) points[mark.markedBy] = (points[mark.markedBy] || 0) - mark.points
        }
        for (const [profileId, change] of Object.entries(points)) {
          const person = members.find((m) => m.id === profileId)
          if (person && change) await update('profiles', profileId, { points: Math.max(0, (person.points || 0) + change) })
        }
        if (points[user.id]) refreshAuth()
      }
      return { ok: true }
    },
    [activities, members, currentFloor, user, activityMarks, refreshAuth]
  )

  // Marca EXTRA: realización voluntaria/adicional de la actividad por
  // CUALQUIER persona, sea o no su turno (p. ej. la basura se llenó otra
  // vez el mismo día, o alguien no quiso esperar al responsable). Va aparte
  // de la rutina — no cuenta para el objetivo, no da puntos, solo queda
  // como reconocimiento.
  const addActivityExtra = useCallback(
    async (completion) => {
      if (!currentFloor || !user || !completion) return
      await create('activity_marks', {
        floorId: currentFloor.id,
        activityId: completion.activityId,
        completionId: completion.id,
        markedBy: user.id,
        kind: 'extra'
      })
    },
    [currentFloor, user]
  )

  const removeActivityExtra = useCallback(
    async (completionId) => {
      const latest = activityMarks
        .filter((m) => m.completionId === completionId && m.kind === 'extra')
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0]
      if (latest) await remove('activity_marks', latest.id)
    },
    [activityMarks]
  )

  // completionId → cuántas marcas extra lleva ese turno.
  const extraCounts = useMemo(() => {
    const counts = {}
    for (const m of activityMarks) if (m.kind === 'extra') counts[m.completionId] = (counts[m.completionId] || 0) + 1
    return counts
  }, [activityMarks])

  // "Hacer la compra": registra de una vez varios productos comprados
  // en un mismo viaje — el monto es del viaje completo, se registra una
  // sola vez en el pote (reutilizando addPotExpense, con foto de
  // ticket si se adjunta) y purchase_sessions agrupa qué productos
  // fueron parte de esa compra. Si el período actual de la actividad
  // "Compras del piso" existe y sigue pendiente, se marca completado de
  // una vez (cuenta para la racha y las recompensas, sin tener que ir
  // aparte al Calendario a marcarlo).
  const recordPurchaseSession = useCallback(
    async ({ itemIds, totalAmount, receiptFile, paidById = null }) => {
      if (!currentFloor || !user) return
      const buyerId = paidById && virtualMemberIds.has(paidById) ? paidById : user.id

      let potContributionId = null
      const amount = Number(totalAmount) || 0
      if (amount > 0) {
        const contribution = await addPotExpense(amount, { note: 'Compra del piso', receiptFile, onBehalfOfId: buyerId === user.id ? null : buyerId })
        potContributionId = contribution?.id || null
      }

      const session = await create('purchase_sessions', {
        floorId: currentFloor.id,
        userId: buyerId,
        potContributionId
      })

      for (const itemId of itemIds) {
        const item = shoppingItems.find((i) => i.id === itemId)
        if (!item) continue
        // El registro del historial se crea ANTES de tocar shopping_items:
        // item_id todavía tiene que existir en ese momento (FK), aunque se
        // borre la fila justo después para lo puntual.
        await create('shopping_purchases', {
          floorId: currentFloor.id,
          itemId,
          itemName: item.name,
          userId: buyerId,
          price: null,
          potContributionId,
          sessionId: session.id
        })
        // Recurrente: vuelve a "con stock", sigue en la lista para el
        // próximo ciclo. Puntual: ya cumplió su propósito — se borra de
        // la lista activa (item_id queda null en shopping_purchases,
        // pero item_name conserva el nombre, así que el historial no
        // pierde nada).
        if (item.recurring) {
          await update('shopping_items', itemId, { stockLevel: 'ok' })
        } else {
          await remove('shopping_items', itemId)
        }
      }

      const comprasActivity = activities.find((a) => a.fixedKey === 'compras')
      if (comprasActivity) {
        const periodKey = currentPeriodKey(comprasActivity, weekKey)
        const completion = periodKey
          ? activityCompletions.find((c) => c.activityId === comprasActivity.id && c.periodKey === periodKey)
          : null
        if (completion && !completion.completed) {
          await setActivityProgress(completion, comprasActivity.timesPerWeek || 1, { force: true })
        }
      }
    },
    [currentFloor, user, shoppingItems, activities, activityCompletions, weekKey, addPotExpense, setActivityProgress, virtualMemberIds]
  )

  // Consulta nueva (Votaciones): notificación floor-wide de una, no hace
  // falta el fan-out de notifyUser porque ya le llega a todo el piso
  // (userId: null) igual que "pote bajo" o "se unió un nuevo miembro".
  const createPoll = useCallback(
    async ({ question, options, resolutionMode, deadline, kind, payload, deadlineAt }) => {
      if (!currentFloor || !user) return
      const poll = await create('polls', {
        floorId: currentFloor.id,
        createdBy: user.id,
        question,
        options,
        resolutionMode: resolutionMode || 'majority',
        deadline: deadline || null,
        kind: kind || 'custom',
        payload: payload || null,
        deadlineAt: deadlineAt || null
      })
      await create('notifications', {
        floorId: currentFloor.id,
        userId: null,
        type: 'poll_created',
        message: `${user.name} propuso una consulta: "${question}"`
      })
      return poll
    },
    [currentFloor, user]
  )

  // Propone un cambio de rotación — el orden de las personas (newOrder),
  // el modo (mode: 'random' | 'period') y/o la frecuencia (periodUnit +
  // periodInterval), lo que venga en `changes`. No toca floors todavía:
  // crea una consulta de aprobación (kind:'rotation_order') con un plazo de
  // 72 h. Solo si el piso la aprueba por mayoría se aplica de
  // verdad (ver el efecto de arriba que invoca resolvePoll). Mientras haya
  // una de estas pendiente, pendingRotationOrderPoll (más abajo) evita que
  // se proponga una segunda.
  const proposeRotationChange = useCallback(
    (changes) => {
      const { newOrder, mode, periodUnit, periodInterval } = changes
      const unitLabels = {
        day: ['día', 'días'],
        week: ['semana', 'semanas'],
        month: ['mes', 'meses'],
        year: ['año', 'años']
      }
      const parts = []
      if (newOrder) parts.push('nuevo orden de personas')
      if (mode) parts.push(`modo ${mode === 'random' ? 'Aleatorio' : 'Determinado'}`)
      if (periodUnit) {
        const n = Math.max(1, Number(periodInterval) || 1)
        parts.push(`cambio de turno cada ${n} ${unitLabels[periodUnit]?.[n === 1 ? 0 : 1] || periodUnit}`)
      }
      return createPoll({
        question: `¿Apruebas el cambio de rotación propuesto por ${user?.name || 'un admin'}? (${parts.join(', ')})`,
        options: ['Aprobar', 'Rechazar'],
        resolutionMode: 'majority',
        kind: 'rotation_order',
        payload: changes,
        deadlineAt: pollDeadlineAt(ROTATION_POLL_HOURS)
      })
    },
    [createPoll, user]
  )

  // Un admin reordena a las PERSONAS directamente, sin votación previa (ver
  // supabase/rotation_direct.sql): se aplica al instante y el piso recibe una
  // notificación con una previsualización y "Estoy de acuerdo" como acción
  // principal — quien prefiera otro orden puede sugerir uno alternativo, y esa
  // alternativa sí pasa por la votación de siempre (proposeRotationChange). El
  // modo de rotación y su frecuencia NO entran acá: eso sigue yendo a votación.
  // `set_rotation_order_direct` comprueba ella misma que quien llama es admin
  // (la política RLS de "floors" es permisiva a propósito, ver el comentario
  // en ese archivo) y valida que newOrder sea de verdad una reordenación de
  // los miembros activos del piso.
  const updateRotationOrderDirect = useCallback(
    async (newOrder) => {
      if (!currentFloor) return
      await callRpc('set_rotation_order_direct', { p_floor_id: currentFloor.id, p_new_order: newOrder })
    },
    [currentFloor]
  )

  // Un admin corrige A QUIÉN LE TOCA AHORA sin reordenar a nadie ni tocar el
  // orden configurado (ver supabase/rotation_turn.sql): se guarda como un
  // desfase de fase (floors.rotation_offset) que rotationPick suma al índice
  // de período de siempre — los turnos siguientes vuelven a seguir el orden
  // de toda la vida, solo desplazados. `personId` tiene que estar en el orden
  // EFECTIVO (sin quienes están "fuera"), igual que floorKeeperFor/
  // assigneeFor lo calculan en el resto de la app.
  //
  // El offset por sí solo NO alcanza para que Actividades/Calendario
  // coincidan al instante: el turno de ESTE período de cada actividad por
  // rotación ya quedó guardado en activity_completions (lo crea
  // ensureActivityPeriods al abrir la app) con el offset ANTERIOR, y ese
  // valor guardado no se recalcula solo. Se reescribe a mano acá — mismo
  // patrón que usa removeVirtualMember al reasignar turnos pendientes — para
  // que no quede la inconsistencia de "Tu piso dice una persona y Actividades
  // dice otra" para el turno que ya estaba en curso.
  const setCurrentTurn = useCallback(
    async (personId) => {
      if (!currentFloor) return
      const effectiveOrder = (currentFloor.rotationOrder || []).filter((id) => !awayUserIds.has(id))
      const targetPos = effectiveOrder.indexOf(personId)
      if (targetPos < 0) return
      const len = effectiveOrder.length
      const rawIndex = floorKeeperIndex(currentFloor, weekKey)
      const newOffset = (((targetPos - rawIndex) % len) + len) % len
      await callRpc('set_rotation_turn_direct', { p_floor_id: currentFloor.id, p_offset: newOffset })

      const updatedFloor = { ...currentFloor, rotationOffset: newOffset }
      for (const activity of activities) {
        if (activity.frequencyType !== 'recurring' || activity.assignmentMode !== 'rotation') continue
        const period = currentPeriodKey(activity, weekKey)
        if (!period) continue
        const completion = activityCompletions.find((c) => c.activityId === activity.id && c.periodKey === period)
        if (!completion) continue
        const newAssignee = assigneeFor(activity, effectiveOrder, weekKey, updatedFloor)
        if (newAssignee && newAssignee !== completion.assignedUserId) {
          await update('activity_completions', completion.id, { assignedUserId: newAssignee })
        }
      }
    },
    [currentFloor, awayUserIds, weekKey, activities, activityCompletions]
  )

  // Consulta pendiente de modificar manualmente el importe del Pote —
  // usada para mostrar su estado en la pantalla del Pote y para no
  // permitir una segunda solicitud mientras haya una en curso.
  const pendingPotAdjustmentPoll = useMemo(
    () => polls.find((p) => p.kind === 'pot_adjustment' && p.status === 'pending') || null,
    [polls]
  )

  // Pide fijar el importe del Pote en `newAmount` (0 para ponerlo a cero).
  // NUNCA lo aplica directo: crea una consulta de unanimidad (kind
  // 'pot_adjustment') que le llega a todo el piso; solo se ejecuta si
  // TODOS los convivientes aprueban (un solo "Rechazar" la tumba, ver
  // resolvePoll) — el efecto de resolución de arriba hace el cambio real
  // y deja el movimiento en el historial. Quien la pide queda aprobándola
  // de entrada (es su propia solicitud). Plazo de 72h: si alguien nunca
  // responde, vence sola en vez de bloquear el Pote para siempre.
  const requestPotAdjustment = useCallback(
    async (newAmount) => {
      if (!currentFloor || !user || pendingPotAdjustmentPoll) return null
      const amount = Math.round(Number(newAmount) * 100) / 100
      if (!Number.isFinite(amount) || amount < 0) return null
      const poll = await createPoll({
        question: `¿Apruebas establecer el Pote en ${amount.toFixed(2)}€?`,
        options: ['Aprobar', 'Rechazar'],
        resolutionMode: 'unanimity',
        kind: 'pot_adjustment',
        payload: { newAmount: amount },
        deadlineAt: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()
      })
      await create('poll_votes', { pollId: poll.id, floorId: currentFloor.id, userId: user.id, option: 'Aprobar' })
      return poll
    },
    [currentFloor, user, createPoll, pendingPotAdjustmentPoll]
  )

  // Consulta pendiente de aprobar un cambio de rotación — usado para
  // deshabilitar el lápiz de edición mientras haya una en curso, y para
  // mostrar el banner con su plazo en FloorSettings.
  const pendingRotationOrderPoll = useMemo(
    () => polls.find((p) => p.kind === 'rotation_order' && p.status === 'pending') || null,
    [polls]
  )

  // "Reiniciar saldo" (Pote → Saldo por persona). Nunca toca el total del
  // Pote ni el saldo de otra persona: solo agrega una fila propia a
  // wallet_resets, y computeWallets (lib/wallets.js) fija el saldo de quien
  // la hizo en ese importe.
  // — Solo para mí: se aplica al instante (scope 'self').
  const resetMyWallet = useCallback(
    async (newBalance) => {
      if (!currentFloor || !user) return
      const amount = Math.round(Number(newBalance) * 100) / 100
      if (!Number.isFinite(amount)) return
      await create('wallet_resets', { floorId: currentFloor.id, userId: user.id, newBalance: amount, scope: 'self' })
    },
    [currentFloor, user]
  )

  // — Para todos: cada persona que aprueba la consulta (poll 'balance_reset')
  // se reinicia SU saldo, con id determinístico + upsert-ignorando-duplicados
  // para que aprobar dos veces (o reintentar) no duplique el registro.
  const applyPollWalletReset = useCallback(
    async (poll) => {
      if (!currentFloor || !user) return
      const newBalance = Number(poll.payload?.newBalance)
      if (!Number.isFinite(newBalance)) return
      const rowId = await deterministicUuid(`wallet-reset:${poll.id}:${user.id}`)
      await upsertIgnoreDuplicates(
        'wallet_resets',
        [{ id: rowId, floorId: currentFloor.id, userId: user.id, newBalance, scope: 'poll', pollId: poll.id }],
        ['id']
      )
    },
    [currentFloor, user]
  )

  // Consulta pendiente de reiniciar el saldo de todos — para no abrir una
  // segunda mientras haya una en curso.
  const pendingBalanceResetPoll = useMemo(
    () => polls.find((p) => p.kind === 'balance_reset' && p.status === 'pending') || null,
    [polls]
  )

  // Propone reiniciar el saldo de TODOS a `newBalance`: no cambia ningún
  // saldo todavía — crea una consulta en Votaciones (kind 'balance_reset',
  // 72h de plazo). Cada persona la aprueba o rechaza por sí misma y solo se
  // le reinicia el saldo a quien apruebe. Quien propone queda aprobándola
  // (es su propia propuesta), así que su saldo sí se reinicia.
  const proposeWalletResetForAll = useCallback(
    async (newBalance) => {
      if (!currentFloor || !user || pendingBalanceResetPoll) return null
      const amount = Math.round(Number(newBalance) * 100) / 100
      if (!Number.isFinite(amount)) return null
      const poll = await createPoll({
        question: `¿Apruebas reiniciar tu saldo del Pote a ${amount.toFixed(2)}€? Lo propone ${user.name}. Solo cambia el saldo de quien apruebe.`,
        options: ['Aprobar', 'Rechazar'],
        resolutionMode: 'majority',
        kind: 'balance_reset',
        payload: { newBalance: amount },
        deadlineAt: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()
      })
      await create('poll_votes', { pollId: poll.id, floorId: currentFloor.id, userId: user.id, option: 'Aprobar' })
      await applyPollWalletReset(poll)
      return poll
    },
    [currentFloor, user, createPoll, pendingBalanceResetPoll, applyPollWalletReset]
  )

  // Un voto por persona por consulta: si ya votó, cambia de opción
  // (update); si no, crea el suyo. Corta en seco si la consulta ya no
  // está pendiente (RLS también lo bloquea, esto solo evita el viaje).
  const castVote = useCallback(
    async (pollId, option) => {
      if (!currentFloor || !user) return
      const poll = polls.find((p) => p.id === pollId)
      if (!poll || poll.status !== 'pending') return
      const existing = pollVotes.find((v) => v.pollId === pollId && v.userId === user.id)
      // Reinicio de saldo "para todos": aprobar reinicia MI saldo al instante,
      // así que un voto ya aprobado no se puede cambiar (no habría reversa).
      if (poll.kind === 'balance_reset' && existing?.option === 'Aprobar') return { ok: false, reason: 'locked' }
      if (existing) {
        await update('poll_votes', existing.id, { option })
      } else {
        await create('poll_votes', { pollId, floorId: currentFloor.id, userId: user.id, option })
      }
      if (poll.kind === 'balance_reset' && option === 'Aprobar') await applyPollWalletReset(poll)
      return { ok: true }
    },
    [currentFloor, user, polls, pollVotes, applyPollWalletReset]
  )

  const closePoll = useCallback((pollId) => update('polls', pollId, { status: 'closed', resolvedAt: new Date().toISOString() }), [])

  // Perfiles virtuales (solo admins; ver supabase/virtual_members.sql). Al
  // terminar se relee la lista de miembros para que se vea al instante.
  const refreshMembers = useCallback(async () => {
    if (currentFloor) setMembers(await getFloorMembers(currentFloor.id))
  }, [currentFloor])

  const createVirtualMember = useCallback(
    async (name, color) => {
      if (!currentFloor) return null
      const id = await callRpc('create_virtual_member', { p_floor_id: currentFloor.id, p_name: name, p_color: color || null })
      await refreshMembers()
      return id
    },
    [currentFloor, refreshMembers]
  )

  const updateVirtualMember = useCallback(
    async (id, name, color) => {
      await callRpc('update_virtual_member', { p_id: id, p_name: name, p_color: color || null })
      await refreshMembers()
    },
    [refreshMembers]
  )

  // Vincula el perfil virtual con la cuenta real de la misma persona: turnos,
  // historial, Pote y posición en la rotación pasan a la cuenta real.
  const linkVirtualMember = useCallback(
    async (virtualId, realId) => {
      await callRpc('link_virtual_member', { p_virtual_id: virtualId, p_real_id: realId })
      await refreshMembers()
      // El orden de rotación cambió en la base: se relee el piso.
      refreshAuth()
    },
    [refreshMembers, refreshAuth]
  )

  const leaderboard = useMemo(() => realMembers(members).sort((a, b) => (b.points || 0) - (a.points || 0)), [members])

  const value = {
    floor: currentFloor,
    members,
    weekKey,
    tasks: floorTasks,
    incidents: floorIncidents,
    notifications: myNotifications,
    unreadCount,
    leaderboard,
    virtualMemberIds,
    createVirtualMember,
    removeVirtualMember,
    updateVirtualMember,
    linkVirtualMember,
    redemptions,
    potContributions,
    walletResets,
    resetMyWallet,
    proposeWalletResetForAll,
    pendingBalanceResetPoll,
    pendingJoinRequests,
    claimJoinRequests,
    approveJoinRequest,
    rejectJoinRequest,
    shoppingItems,
    shoppingPurchases,
    purchaseSessions,
    recordPurchaseSession,
    addShoppingItem,
    updateShoppingItem,
    removeShoppingItem,
    setItemStock,
    absenceRequests,
    myAbsenceRequests,
    pendingAbsenceRequests,
    removalPending,
    awayUserIds,
    requestAbsence,
    decideAbsenceRequest,
    cancelAbsenceRequest,
    myRoomPartner,
    incomingPartnerRequests,
    outgoingPartnerRequest,
    requestRoomPartner,
    acceptRoomPartner,
    rejectRoomPartner,
    cancelRoomPartner,
    incomingSwapRequests,
    outgoingSwapRequests,
    requestSwap,
    acceptSwap,
    declineSwap,
    cancelSwap,
    activities,
    activityCompletions,
    addActivity,
    updateActivity,
    removeActivity,
    setActivityProgress,
    activityMarks,
    extraCounts,
    addActivityExtra,
    removeActivityExtra,
    polls,
    pollVotes,
    createPoll,
    castVote,
    closePoll,
    proposeRotationChange,
    updateRotationOrderDirect,
    setCurrentTurn,
    pendingRotationOrderPoll,
    pendingPotAdjustmentPoll,
    requestPotAdjustment,
    completeTask,
    uncompleteTask,
    reorderRotation,
    removeMember,
    initiateRemoval,
    cancelRemoval,
    rejectMyRemoval,
    setMemberRole,
    setMemberPotActive,
    setMemberActiveStatus,
    declareAway,
    returnFromAway,
    updateProfile,
    adjustMemberPoints,
    addIncident,
    removeIncident,
    markNotificationRead,
    markAllNotificationsRead,
    sharedSpaceUses,
    startSharedSpaceUse,
    releaseSharedSpaceUse,
    addPotContribution,
    addPotExpense,
    updatePotExpense,
    deletePotExpense,
    redeemReward
  }

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData debe usarse dentro de <DataProvider>')
  return ctx
}
