import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { useTheme } from '../context/ThemeContext'
import { MoonIcon, SunIcon, BellIcon } from './icons'
import Avatar from './Avatar'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

export default function Topbar({ title }) {
  const { user, floor, membership, logout } = useAuth()
  const { notifications, unreadCount, markAllNotificationsRead } = useData()
  const { theme, toggleTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const [showAll, setShowAll] = useState(false)

  const unread = notifications.filter((n) => !n.read)
  const hasRead = notifications.length > unread.length
  const visibleNotifications = showAll ? notifications : unread

  return (
    <header className="flex items-center justify-between px-5 py-4 border-b border-ink-900/10 dark:border-cream-100/15 sticky top-0 bg-cream-100/90 dark:bg-ink-900/90 backdrop-blur z-20">
      <div>
        <h1 className="font-display text-xl font-bold tracking-tight">{title}</h1>
        {floor && <p className="text-xs text-ink-900/50 dark:text-cream-100/50">{floor.name} · código {floor.inviteCode}</p>}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={toggleTheme}
          aria-label="Cambiar tema"
          className="w-10 h-10 rounded-xl flex items-center justify-center text-ink-900 dark:text-cream-100 hover:bg-cream-200 dark:hover:bg-ink-700"
        >
          {theme === 'light' ? <MoonIcon className="w-5 h-5" /> : <SunIcon className="w-5 h-5" />}
        </button>

        <div className="relative">
          <button
            onClick={() => setOpen((o) => !o)}
            aria-label="Notificaciones"
            className="relative w-10 h-10 rounded-xl flex items-center justify-center text-ink-900 dark:text-cream-100 hover:bg-cream-200 dark:hover:bg-ink-700"
          >
            <BellIcon className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 bg-coral-500 border border-cream-100 dark:border-ink-900 text-white text-[10px] leading-none rounded-full w-4 h-4 flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>

          {open && (
            <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto card p-2 z-30">
              <div className="flex items-center justify-between px-2 py-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-900/50 dark:text-cream-100/50">
                  {showAll ? 'Todas' : 'Recientes'}
                </p>
                {unread.length > 0 && (
                  <button
                    onClick={markAllNotificationsRead}
                    className="text-xs font-semibold text-violet-500 hover:underline"
                  >
                    Marcar leídas
                  </button>
                )}
              </div>

              {visibleNotifications.length === 0 && (
                <p className="text-sm text-center py-6 text-ink-900/50 dark:text-cream-100/50">
                  {showAll ? 'Sin notificaciones todavía.' : 'Sin notificaciones nuevas.'}
                </p>
              )}
              {visibleNotifications.map((n) => (
                <div key={n.id} className="px-3 py-2 rounded-lg hover:bg-cream-100 dark:hover:bg-ink-700 text-sm">
                  <p className={n.read ? '' : 'font-semibold'}>{n.message}</p>
                  <p className="text-xs text-ink-900/40 dark:text-cream-100/40 mt-0.5">
                    {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: es })}
                  </p>
                </div>
              ))}

              {hasRead && (
                <button
                  type="button"
                  onClick={() => setShowAll((s) => !s)}
                  className="w-full text-center text-xs font-semibold text-violet-500 hover:underline pt-2 mt-1 border-t border-ink-900/10 dark:border-cream-100/15"
                >
                  {showAll ? 'Ocultar anteriores' : 'Ver notificaciones anteriores'}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="hidden sm:flex items-center gap-2 pl-2 ml-1 border-l border-ink-900/10 dark:border-cream-100/15">
          <Link to="/perfil" className="flex items-center gap-2 hover:opacity-80" title="Ir a Perfil">
            <Avatar url={user?.avatarUrl} name={user?.name} size="w-8 h-8" />
            <div className="leading-tight">
              <p className="text-sm font-semibold">{user?.name}</p>
              <p className="text-xs text-ink-900/50 dark:text-cream-100/50">{membership?.role === 'admin' ? 'Admin' : 'Miembro'}</p>
            </div>
          </Link>
          <button onClick={logout} className="ml-2 text-xs font-semibold text-violet-500 hover:underline">
            Salir
          </button>
        </div>
      </div>
    </header>
  )
}
