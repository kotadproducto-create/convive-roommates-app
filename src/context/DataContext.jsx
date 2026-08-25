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
  subscribePendingRequests
} from '../lib/db'
import { TASK_TYPES, getWeekKey, ensureWeekTasks, reassignPendingTasks } from '../lib/rotation'
import { useAuth } from './AuthContext'

const DataContext = createContext(null)

export const REWARD_CATALOG = [
  { key: 'movie', label: 'Elegir la próxima película', cost: 40, icon: '🎬' },
  { key: 'skip_minor', label: 'Saltarte una tarea menor (basura o lavadora)', cost: 60, icon: '🙅' },
  { key: 'lie_in', label: 'Turno de compras cubierto por otro roommate', cost: 90, icon: '🛌' }
]

export function DataProvider({ children }) {
  const { user, floor, refresh: refreshAuth } = useAuth()
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
  const [absenceRequests, setAbsenceRequests] = useState([])
  const [roomPartners, setRoomPartners] = useState([])

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

  // Genera (una sola vez, de forma idempotente) las tareas de la semana
  // actual y las notificaciones de recordatorio de turno / pote bajo.
  useEffect(() => {
    if (!currentFloor) return
    let cancelled = false

    async function run() {
      const effectiveRotationOrder = (currentFloor.rotationOrder || []).filter((id) => !awayUserIds.has(id))
      await ensureWeekTasks(currentFloor.id, weekKey, effectiveRotationOrder)
      if (cancelled) return

      const existingNotifs = await getAll('notifications', { floorId: currentFloor.id })
      const alreadyNotifiedTurno = existingNotifs.some((n) => n.weekKey === weekKey && n.type === 'turno')

      if (!alreadyNotifiedTurno) {
        const weekTasks = (await getAll('tasks', { floorId: currentFloor.id })).filter(
          (t) => t.weekKey === weekKey
        )
        for (const t of weekTasks) {
          if (!t.assignedUserId) continue
          const typeInfo = TASK_TYPES.find((tt) => tt.key === t.type)
          await notifyUser(currentFloor.id, t.assignedUserId, 'turno', `Esta semana te toca: ${typeInfo?.label || t.type}`, weekKey)
        }
      }

      const alreadyNotifiedPote = existingNotifs.some((n) => n.weekKey === weekKey && n.type === 'pote')
      if (currentFloor.potAmount < currentFloor.potThreshold && !alreadyNotifiedPote) {
        await create('notifications', {
          floorId: currentFloor.id,
          userId: null,
          type: 'pote',
          weekKey,
          read: false,
          message: `El pote de compras está bajo (${currentFloor.potAmount}€). Sugerido: ${currentFloor.potPerPerson}€ por persona.`
        })
      }
    }

    run()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFloor?.id, currentFloor?.rotationOrder?.length, currentFloor?.potAmount, weekKey, awayUserIds])

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

  // --- Acciones ---

  // Crea una notificación para userId y, si tiene una pareja de
  // habitación aceptada en este piso, una copia idéntica para ella —
  // así ninguna de las dos se queda sin enterarse de lo que le toca al
  // otro. Usar esto en vez de create('notifications', ...) directo
  // para cualquier notificación dirigida a UNA sola persona (las de
  // todo el piso ya le llegan a la pareja igual, por ser miembro activo).
  const notifyUser = useCallback(
    async (targetFloorId, userId, type, message, weekKeyArg = null) => {
      await create('notifications', { floorId: targetFloorId, userId, type, weekKey: weekKeyArg, read: false, message })
      const partnership = roomPartners.find(
        (p) =>
          p.status === 'accepted' &&
          p.floorId === targetFloorId &&
          (p.requesterId === userId || p.partnerId === userId)
      )
      if (partnership) {
        const partnerUserId = partnership.requesterId === userId ? partnership.partnerId : partnership.requesterId
        await create('notifications', { floorId: targetFloorId, userId: partnerUserId, type, weekKey: weekKeyArg, read: false, message })
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
    (requestId) => update('room_partners', requestId, { status: 'accepted', decidedAt: new Date().toISOString() }),
    []
  )

  const rejectRoomPartner = useCallback(
    (requestId) => update('room_partners', requestId, { status: 'rejected', decidedAt: new Date().toISOString() }),
    []
  )

  const cancelRoomPartner = useCallback((requestId) => update('room_partners', requestId, { status: 'cancelled' }), [])

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
      // Cerrar la membresía, no borrar el perfil: el usuario queda en
      // historial y podrá reactivarla más adelante con aprobación de un
      // admin de ese piso.
      await update('floor_memberships', membershipId, {
        status: 'left',
        leftAt: new Date().toISOString(),
        removalRequestedBy: null,
        removalRequestedAt: null
      })
      await create('notifications', {
        floorId: currentFloor.id,
        userId: null,
        type: 'member_left',
        message: `${leavingName} ha dejado el piso`
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
      await create('shopping_items', {
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

  // Marca un producto como comprado: repone el stock a 'ok' (lo que
  // automáticamente resuelve la alerta de "agotado"), deja constancia en
  // el historial de compras y, si se pide, registra el gasto en el pote
  // de dinero reutilizando addPotExpense — el enlace se guarda para que
  // el historial de compras pueda mostrar "ver en el pote".
  const markItemPurchased = useCallback(
    async (itemId, { price, addToPot } = {}) => {
      if (!currentFloor || !user) return
      const item = shoppingItems.find((i) => i.id === itemId)
      if (!item) return

      let potContributionId = null
      if (addToPot && price) {
        const contribution = await addPotExpense(price, { note: `Compra: ${item.name}` })
        potContributionId = contribution?.id || null
      }

      await update('shopping_items', itemId, { stockLevel: 'ok' })
      await create('shopping_purchases', {
        floorId: currentFloor.id,
        itemId,
        itemName: item.name,
        userId: user.id,
        price: price ? Number(price) : null,
        potContributionId
      })
    },
    [currentFloor, user, shoppingItems, addPotExpense]
  )

  const redeemReward = useCallback(
    async (rewardKey) => {
      const reward = REWARD_CATALOG.find((r) => r.key === rewardKey)
      if (!reward || !user) return { ok: false, message: 'Recompensa no encontrada.' }
      if ((user.points || 0) < reward.cost) {
        return { ok: false, message: 'No tienes puntos suficientes todavía.' }
      }
      await update('profiles', user.id, { points: user.points - reward.cost })
      await create('redemptions', {
        floorId: currentFloor.id,
        userId: user.id,
        userName: user.name,
        rewardKey: reward.key,
        rewardLabel: reward.label,
        cost: reward.cost
      })
      refreshAuth()
      return { ok: true, message: `¡Canjeado! ${reward.label}` }
    },
    [user, currentFloor, refreshAuth]
  )

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
    addShoppingItem,
    updateShoppingItem,
    removeShoppingItem,
    setItemStock,
    markItemPurchased,
    absenceRequests,
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
    completeTask,
    uncompleteTask,
    reorderRotation,
    removeMember,
    initiateRemoval,
    cancelRemoval,
    setMemberRole,
    setMemberPotActive,
    setMemberActiveStatus,
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
