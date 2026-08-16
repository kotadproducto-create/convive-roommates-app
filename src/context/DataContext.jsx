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

  // Genera (una sola vez, de forma idempotente) las tareas de la semana
  // actual y las notificaciones de recordatorio de turno / pote bajo.
  useEffect(() => {
    if (!currentFloor) return
    let cancelled = false

    async function run() {
      await ensureWeekTasks(currentFloor.id, weekKey, currentFloor.rotationOrder || [])
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
          await create('notifications', {
            floorId: currentFloor.id,
            userId: t.assignedUserId,
            type: 'turno',
            weekKey,
            read: false,
            message: `Esta semana te toca: ${typeInfo?.label || t.type}`
          })
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
  }, [currentFloor?.id, currentFloor?.rotationOrder?.length, currentFloor?.potAmount, weekKey])

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

  // --- Acciones ---

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
      const newOrder = (currentFloor.rotationOrder || []).filter((id) => id !== profileId)
      await reassignPendingTasks(currentFloor.id, profileId, newOrder)
      await update('floors', currentFloor.id, { rotationOrder: newOrder })
      // Cerrar la membresía, no borrar el perfil: el usuario queda en
      // historial y podrá reactivarla más adelante con aprobación de un
      // admin de ese piso.
      await update('floor_memberships', membershipId, { status: 'left', leftAt: new Date().toISOString() })
    },
    [currentFloor]
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

  const updateProfile = useCallback((profileId, patch) => update('profiles', profileId, patch), [])

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
    completeTask,
    uncompleteTask,
    reorderRotation,
    removeMember,
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
    redeemReward
  }

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData debe usarse dentro de <DataProvider>')
  return ctx
}
