import { useNavigate } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { useData } from '../context/DataContext'
import { useLanguage } from '../context/LanguageContext'
import { notificationRoute } from '../lib/notifications'

/**
 * Una notificación (Topbar e Inicio). Si su tipo tiene un apartado propio
 * (ver lib/notifications.js), tocarla la marca como leída y lleva a esa
 * pantalla; si no, es solo texto. `onNavigate` deja cerrar el desplegable
 * de donde se tocó.
 */
export default function NotificationItem({ notification: n, className = '', onNavigate }) {
  const navigate = useNavigate()
  const { markNotificationRead } = useData()
  const { dateLocale } = useLanguage()
  const route = notificationRoute(n.type)

  const content = (
    <>
      <p className={n.read ? '' : 'font-semibold'}>{n.message}</p>
      <p className="text-xs text-ink-900/40 dark:text-cream-100/40 mt-0.5">
        {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: dateLocale })}
      </p>
    </>
  )

  if (!route) return <div className={className}>{content}</div>

  function open() {
    if (!n.read) markNotificationRead(n.id)
    onNavigate?.()
    navigate(route)
  }

  return (
    <button type="button" onClick={open} className={`${className} w-full text-left flex items-center gap-2 cursor-pointer`}>
      <span className="min-w-0 flex-1">{content}</span>
      <span aria-hidden="true" className="shrink-0 text-lg leading-none text-ink-900/30 dark:text-cream-100/30">›</span>
    </button>
  )
}
