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
  deterministicUuid
} from '../lib/db'
import { TASK_TYPES, getWeekKey, ensureWeekTasks, reassignPendingTasks, placeAdjacentInRotation, fixedTaskOverride } from '../lib/rotation'
import { ensureActivityPeriods, currentPeriodKey } from '../lib/activities'
import { resolvePoll } from '../lib/polls'
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
  const [pendingJoinRequests, setPendingJoinRequests] = useState([])
  const [shoppingItems, setShoppingItems] = useState([])
  const [shoppingPurchases, setShoppingPurchases] = useState([])
  const [purchaseSessions, setPurchaseSessions] = useState([])
  const [absenceRequests, setAbsenceRequests] = useState([])
  const [roomPartners, setRoomPartners] = useState([])
  const [activities, setActivities] = useState([])
  const [activityCompletions, setActivityCompletions] = useState([])
  const [swapRequests, setSwapRequests] = useState([])
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

  // IDs de quienes tienen una ausencia aprobada que cubre hoy — se
  // excluyen de la generación de tareas de la semana (whoIsAssigned salta
  // a la siguiente persona en rotationOrder). Solo afecta a la semana que
  // se está generando ahora, no reescribe semanas ya creadas.
  const todayISO = new Date().toISOString().slice(0, 10)
  const awayUserIds = useMemo(
    () =>
      new Set(
        absenceRequests
          .filter((r) => r.status === 'approved' && r.startDate <= todayISO && r.endDate >= todayISO)
          .map((r) => r.userId)
      ),
    [absenceRequests, todayISO]
  )

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

  // Resolución oportunista de consultas (Votaciones): igual que las dos
  // expiraciones de arriba, no hay cron — se revisa cada vez que alguien
  // del piso tiene la app abierta. resolvePoll es pura (ver lib/polls.js);
  // acá solo se traduce su resultado a un update() + una notificación
  // floor-wide idempotente (mismo patrón deterministic-id que "pote bajo"),
  // para que un efecto que se dispare más de una vez no duplique el aviso.
  useEffect(() => {
    if (!currentFloor) return
    const activeMemberIds = members.map((m) => m.id)
    const pending = polls.filter((p) => p.status === 'pending')
    if (!pending.length) return

    async function run() {
      for (const poll of pending) {
        const votesForPoll = pollVotes.filter((v) => v.pollId === poll.id)
        const outcome = resolvePoll(poll, votesForPoll, activeMemberIds, todayISO, Date.now())
        if (!outcome) continue

        // Las consultas de tipo 'rotation_order' (propuesta de nuevo
        // orden de rotación, ver proposeRotationOrder) solo aplican el
        // cambio de verdad si se resolvió con la opción "Aprobar" — un
        // "Rechazar", un cierre sin mayoría o un vencimiento del plazo
        // dejan floors.rotation_order intacto.
        const isRotationOrder = poll.kind === 'rotation_order'
        if (isRotationOrder && outcome.status === 'resolved' && outcome.resolvedOption === 'Aprobar' && poll.payload?.newOrder) {
          await update('floors', currentFloor.id, { rotationOrder: poll.payload.newOrder, rotationEpoch: todayISO })
        }

        await update('polls', poll.id, {
          status: outcome.status,
          resolvedOption: outcome.resolvedOption,
          resolvedAt: new Date().toISOString()
        })
        const id = await deterministicUuid(`notif:poll-resolved:${poll.id}:${outcome.status}`)
        const message = isRotationOrder
          ? outcome.status === 'resolved' && outcome.resolvedOption === 'Aprobar'
            ? 'El piso aprobó el nuevo orden de rotación — ya está activo.'
            : outcome.status === 'resolved'
              ? 'El piso rechazó la propuesta de nuevo orden de rotación. Sigue el orden anterior.'
              : outcome.status === 'closed'
                ? 'La propuesta de nuevo orden de rotación se cerró sin mayoría clara. Sigue el orden anterior.'
                : 'La propuesta de nuevo orden de rotación venció sin que todos votaran. Sigue el orden anterior.'
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
              type: 'poll_resolved',
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
  }, [polls, pollVotes, members, todayISO, currentFloor?.id])

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
  const notifyUser = useCallback(
    async (targetFloorId, userId, type, message, weekKeyArg = null, dedupeKey = null) => {
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
    [roomPartners]
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

  const markAllNotificationsRead = useCallback(async () => {
    for (const n of myNotifications) {
      if (!n.read) await update('notifications', n.id, { read: true })
    }
  }, [myNotifications])

  const requestWasher = useCallback(async () => {
    if (!currentFloor || !user) return
    await create('notifications', {
      floorId: currentFloor.id,
      userId: null,
      type: 'lavadora',
      weekKey,
      read: false,
      message: `${user.name} necesita usar la lavadora en breve. Avisad si tenéis ropa dentro.`
    })
  }, [currentFloor, user, weekKey])

  const addPotContribution = useCallback(
    async (amount) => {
      if (!currentFloor || !user) return
      await create('pot_contributions', { floorId: currentFloor.id, userId: user.id, amount: Number(amount) })
      await update('floors', currentFloor.id, { potAmount: (currentFloor.potAmount || 0) + Number(amount) })
    },
    [currentFloor, user]
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
  const declareAway = useCallback(
    async (membershipId, targetUserId, untilDate) => {
      await update('floor_memberships', membershipId, { potActive: false, awayUntil: untilDate })
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
  const returnFromAway = useCallback(
    (membershipId) => update('floor_memberships', membershipId, { potActive: true, awayUntil: null }),
    []
  )

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
    async (amount, { note, receiptFile } = {}) => {
      if (!currentFloor || !user) return
      let receiptUrl = null
      if (receiptFile) {
        receiptUrl = await uploadPotReceipt(receiptFile, currentFloor.id)
      }
      const created = await create('pot_contributions', {
        floorId: currentFloor.id,
        userId: user.id,
        amount: -Math.abs(Number(amount)),
        note: note || null,
        receiptUrl
      })
      await update('floors', currentFloor.id, { potAmount: Math.max(0, (currentFloor.potAmount || 0) - Number(amount)) })
      return created
    },
    [currentFloor, user]
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
        stockLevel: item.stockLevel || 'ok',
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
      if (!item || !currentFloor) return
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
  // veces por semana, delta suma/resta contra el objetivo. Si la
  // actividad otorga puntos (las 3 fijas, ver `activity.points`), se
  // acreditan al responsable de ESTE período justo al llegar al
  // objetivo — mismo patrón que ya usa completeTask para las tareas
  // viejas. No hay reversa al deshacer (tampoco la había antes).
  const setActivityProgress = useCallback(
    async (completion, delta) => {
      const activity = activities.find((a) => a.id === completion.activityId)
      const target = activity?.timesPerWeek || 1
      const wasCompleted = completion.completed
      const timesDone = Math.min(target, Math.max(0, (completion.timesDone || 0) + delta))
      const nowCompleted = timesDone >= target
      await update('activity_completions', completion.id, {
        timesDone,
        completed: nowCompleted,
        completedAt: nowCompleted ? new Date().toISOString() : null
      })
      if (nowCompleted && !wasCompleted && activity?.points && completion.assignedUserId) {
        const assignee = members.find((m) => m.id === completion.assignedUserId)
        if (assignee) {
          await update('profiles', assignee.id, { points: (assignee.points || 0) + activity.points })
        }
      }
    },
    [activities, members]
  )

  // "Hacer la compra": registra de una vez varios productos comprados
  // en un mismo viaje — el monto es del viaje completo, se registra una
  // sola vez en el pote (reutilizando addPotExpense, con foto de
  // ticket si se adjunta) y purchase_sessions agrupa qué productos
  // fueron parte de esa compra. Si el período actual de la actividad
  // "Compras del piso" existe y sigue pendiente, se marca completado de
  // una vez (cuenta para la racha y las recompensas, sin tener que ir
  // aparte al Calendario a marcarlo).
  const recordPurchaseSession = useCallback(
    async ({ itemIds, totalAmount, receiptFile }) => {
      if (!currentFloor || !user) return

      let potContributionId = null
      const amount = Number(totalAmount) || 0
      if (amount > 0) {
        const contribution = await addPotExpense(amount, { note: 'Compra del piso', receiptFile })
        potContributionId = contribution?.id || null
      }

      const session = await create('purchase_sessions', {
        floorId: currentFloor.id,
        userId: user.id,
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
          userId: user.id,
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
          await setActivityProgress(completion, comprasActivity.timesPerWeek || 1)
        }
      }
    },
    [currentFloor, user, shoppingItems, activities, activityCompletions, weekKey, addPotExpense, setActivityProgress]
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

  // Propone un nuevo orden de rotación: no toca floors.rotation_order
  // todavía — crea una consulta de aprobación (kind:'rotation_order') con
  // un plazo de menos de 24h. Solo si el piso la aprueba por mayoría se
  // aplica de verdad (ver el efecto de arriba que invoca resolvePoll).
  // Mientras haya una de estas pendiente, pendingRotationOrderPoll (más
  // abajo) evita que se proponga una segunda.
  const proposeRotationOrder = useCallback(
    (newOrder) =>
      createPoll({
        question: `¿Apruebas el nuevo orden de rotación propuesto por ${user?.name || 'un admin'}?`,
        options: ['Aprobar', 'Rechazar'],
        resolutionMode: 'majority',
        kind: 'rotation_order',
        payload: { newOrder },
        deadlineAt: new Date(Date.now() + 23 * 60 * 60 * 1000).toISOString()
      }),
    [createPoll, user]
  )

  // Modo/período de rotación: configuración de piso, se guarda al
  // instante (no requiere consulta — no mueve a nadie por sí solo). Se
  // resetea rotationEpoch para que el reloj de turnos en modo 'period'
  // arranque limpio desde el cambio, sin arrastrar índices calculados
  // con la cadencia anterior.
  const setRotationMode = useCallback(
    (mode) => {
      if (!currentFloor) return
      update('floors', currentFloor.id, { rotationMode: mode, rotationEpoch: todayISO })
    },
    [currentFloor, todayISO]
  )
  const setRotationPeriod = useCallback(
    (unit, interval) => {
      if (!currentFloor) return
      update('floors', currentFloor.id, {
        rotationPeriodUnit: unit,
        rotationPeriodInterval: Math.max(1, Number(interval) || 1),
        rotationEpoch: todayISO
      })
    },
    [currentFloor, todayISO]
  )

  // Consulta pendiente de aprobar un cambio de orden — usado para
  // deshabilitar el lápiz de edición mientras haya una en curso, y para
  // mostrar el banner con su plazo en FloorSettings.
  const pendingRotationOrderPoll = useMemo(
    () => polls.find((p) => p.kind === 'rotation_order' && p.status === 'pending') || null,
    [polls]
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
      if (existing) {
        await update('poll_votes', existing.id, { option })
      } else {
        await create('poll_votes', { pollId, floorId: currentFloor.id, userId: user.id, option })
      }
    },
    [currentFloor, user, polls, pollVotes]
  )

  const closePoll = useCallback((pollId) => update('polls', pollId, { status: 'closed', resolvedAt: new Date().toISOString() }), [])

  const leaderboard = useMemo(() => [...members].sort((a, b) => (b.points || 0) - (a.points || 0)), [members])

  const value = {
    floor: currentFloor,
    members,
    weekKey,
    tasks: floorTasks,
    incidents: floorIncidents,
    notifications: myNotifications,
    unreadCount,
    leaderboard,
    redemptions,
    potContributions,
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
    polls,
    pollVotes,
    createPoll,
    castVote,
    closePoll,
    proposeRotationOrder,
    setRotationMode,
    setRotationPeriod,
    pendingRotationOrderPoll,
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
    markAllNotificationsRead,
    requestWasher,
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
