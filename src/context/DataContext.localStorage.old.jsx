import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'
import { getAll, create, update, remove, replaceCollection, subscribe } from '../lib/db'
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
  const [users, setUsers] = useState([])
  const [floors, setFloors] = useState([])
  const [tasks, setTasks] = useState([])
  const [incidents, setIncidents] = useState([])
  const [notifications, setNotifications] = useState([])
  const [redemptions, setRedemptions] = useState([])

  useEffect(() => subscribe('users', setUsers), [])
  useEffect(() => subscribe('floors', setFloors), [])
  useEffect(() => subscribe('tasks', setTasks), [])
  useEffect(() => subscribe('incidents', setIncidents), [])
  useEffect(() => subscribe('notifications', setNotifications), [])
  useEffect(() => subscribe('redemptions', setRedemptions), [])

  const currentFloor = useMemo(
    () => floors.find((f) => f.id === floor?.id) || floor,
    [floors, floor]
  )

  const members = useMemo(
    () => users.filter((u) => u.floorId === currentFloor?.id),
    [users, currentFloor]
  )

  const weekKey = getWeekKey()

  // Genera (una sola vez, de forma idempotente) las tareas de la semana actual
  // y la notificación de recordatorio de turno / reposición del pote.
  useEffect(() => {
    if (!currentFloor) return
    ensureWeekTasks(currentFloor.id, weekKey, currentFloor.rotationOrder || [])

    const alreadyNotifiedThisWeek = getAll('notifications').some(
      (n) => n.floorId === currentFloor.id && n.weekKey === weekKey && n.type === 'turno'
    )
    if (!alreadyNotifiedThisWeek) {
      const weekTasks = getAll('tasks').filter(
        (t) => t.floorId === currentFloor.id && t.weekKey === weekKey
      )
      weekTasks.forEach((t) => {
        const typeInfo = TASK_TYPES.find((tt) => tt.key === t.type)
        if (!t.assignedUserId) return
        create('notifications', {
          floorId: currentFloor.id,
          userId: t.assignedUserId,
          type: 'turno',
          weekKey,
          read: false,
          message: `Esta semana te toca: ${typeInfo?.icon || ''} ${typeInfo?.label || t.type}`
        })
      })
    }

    if (
      currentFloor.potAmount < currentFloor.potThreshold &&
      !getAll('notifications').some(
        (n) => n.floorId === currentFloor.id && n.weekKey === weekKey && n.type === 'pote'
      )
    ) {
      create('notifications', {
        floorId: currentFloor.id,
        userId: null, // broadcast a todo el piso
        type: 'pote',
        weekKey,
        read: false,
        message: `El pote de compras está bajo (${currentFloor.potAmount}€). Sugerido: ${currentFloor.potPerPerson}€ por persona.`
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFloor?.id, currentFloor?.rotationOrder?.length, weekKey])

  const floorTasks = useMemo(
    () => tasks.filter((t) => t.floorId === currentFloor?.id && t.weekKey === weekKey),
    [tasks, currentFloor, weekKey]
  )

  const floorIncidents = useMemo(() => {
    const now = Date.now()
    return incidents
      .filter((i) => i.floorId === currentFloor?.id)
      .filter((i) => !i.expiresAt || new Date(i.expiresAt).getTime() > now)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  }, [incidents, currentFloor])

  const myNotifications = useMemo(
    () =>
      notifications
        .filter((n) => n.floorId === currentFloor?.id && (n.userId === user?.id || n.userId === null))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [notifications, currentFloor, user]
  )

  const unreadCount = myNotifications.filter((n) => !n.read).length

  // --- Acciones ---

  const completeTask = useCallback((taskId) => {
    const task = tasks.find((t) => t.id === taskId)
    update('tasks', taskId, { completed: true, completedAt: new Date().toISOString() })
    if (task) {
      const typeInfo = TASK_TYPES.find((tt) => tt.key === task.type)
      const assignee = getAll('users').find((u) => u.id === task.assignedUserId)
      if (assignee) {
        update('users', assignee.id, { points: (assignee.points || 0) + (typeInfo?.points || 0) })
      }
    }
  }, [tasks])

  const uncompleteTask = useCallback((taskId) => {
    update('tasks', taskId, { completed: false, completedAt: null })
  }, [])

  const reorderRotation = useCallback((newOrder) => {
    if (!currentFloor) return
    update('floors', currentFloor.id, { rotationOrder: newOrder })
  }, [currentFloor])

  const removeMember = useCallback((memberId) => {
    if (!currentFloor) return
    const newOrder = currentFloor.rotationOrder.filter((id) => id !== memberId)
    reassignPendingTasks(currentFloor.id, memberId, newOrder)
    update('floors', currentFloor.id, { rotationOrder: newOrder })
    remove('users', memberId)
  }, [currentFloor])

  const addIncident = useCallback((incident) => {
    if (!currentFloor || !user) return
    create('incidents', {
      floorId: currentFloor.id,
      userId: user.id,
      authorName: user.name,
      title: incident.title,
      description: incident.description,
      photo: incident.photo || null,
      expiresAt: incident.expiresAt || null
    })
  }, [currentFloor, user])

  const removeIncident = useCallback((incidentId) => {
    remove('incidents', incidentId)
  }, [])

  const markAllNotificationsRead = useCallback(() => {
    myNotifications.forEach((n) => {
      if (!n.read) update('notifications', n.id, { read: true })
    })
  }, [myNotifications])

  const requestWasher = useCallback(() => {
    if (!currentFloor || !user) return
    create('notifications', {
      floorId: currentFloor.id,
      userId: null,
      type: 'lavadora',
      weekKey,
      read: false,
      message: `${user.name} necesita usar la lavadora en breve. Avisad si tenéis ropa dentro.`
    })
  }, [currentFloor, user, weekKey])

  const addPotContribution = useCallback((amount) => {
    if (!currentFloor) return
    update('floors', currentFloor.id, { potAmount: (currentFloor.potAmount || 0) + Number(amount) })
  }, [currentFloor])

  const spendFromPot = useCallback((amount) => {
    if (!currentFloor) return
    update('floors', currentFloor.id, { potAmount: Math.max(0, (currentFloor.potAmount || 0) - Number(amount)) })
  }, [currentFloor])

  const redeemReward = useCallback((rewardKey) => {
    const reward = REWARD_CATALOG.find((r) => r.key === rewardKey)
    if (!reward || !user) return { ok: false, message: 'Recompensa no encontrada.' }
    if ((user.points || 0) < reward.cost) {
      return { ok: false, message: 'No tienes puntos suficientes todavía.' }
    }
    update('users', user.id, { points: user.points - reward.cost })
    create('redemptions', {
      floorId: currentFloor.id,
      userId: user.id,
      userName: user.name,
      rewardKey: reward.key,
      rewardLabel: reward.label,
      cost: reward.cost
    })
    refreshAuth()
    return { ok: true, message: `¡Canjeado! ${reward.label}` }
  }, [user, currentFloor, refreshAuth])

  const floorRedemptions = useMemo(
    () =>
      redemptions
        .filter((r) => r.floorId === currentFloor?.id)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [redemptions, currentFloor]
  )

  const leaderboard = useMemo(
    () => [...members].sort((a, b) => (b.points || 0) - (a.points || 0)),
    [members]
  )

  const value = {
    floor: currentFloor,
    members,
    weekKey,
    tasks: floorTasks,
    incidents: floorIncidents,
    notifications: myNotifications,
    unreadCount,
    leaderboard,
    redemptions: floorRedemptions,
    completeTask,
    uncompleteTask,
    reorderRotation,
    removeMember,
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
