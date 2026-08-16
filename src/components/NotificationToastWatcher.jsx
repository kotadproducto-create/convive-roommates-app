import { useEffect, useRef } from 'react'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'

/**
 * Muestra un pop-up cuando llega una notificación NUEVA en vivo (realtime).
 * No avisa de las que ya existían al cargar la página — solo de las que
 * aparecen después, para no bombardear al entrar.
 */
export default function NotificationToastWatcher() {
  const { notifications } = useData()
  const { showToast } = useToast()
  const seenIds = useRef(null)

  useEffect(() => {
    if (seenIds.current === null) {
      seenIds.current = new Set(notifications.map((n) => n.id))
      return
    }
    for (const n of notifications) {
      if (!seenIds.current.has(n.id)) {
        showToast(n.message, 'info')
        seenIds.current.add(n.id)
      }
    }
  }, [notifications, showToast])

  return null
}
