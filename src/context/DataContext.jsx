import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'
import { getAll, create, update, remove, subscribeTable, subscribeFloorMembers } from '../lib/db'
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

  const spendFromPot = useCallback(
    (amount) => {
      if (!currentFloor) return
      update('floors', currentFloor.id, { potAmount: Math.max(0, (currentFloor.potAmount || 0) - Number(amount)) })
    },
    [currentFloor]
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
    completeTask,
    uncompleteTask,
    reorderRotation,
    removeMember,
    setMemberRole,
    setMemberPotActive,
    addIncident,
    removeIncident,
    markAllNotificationsRead,
    requestWasher,
    addPotContribution,
    spendFromPot,
    redeemReward
  }

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData debe usarse dentro de <DataProvider>')
  return ctx
}
