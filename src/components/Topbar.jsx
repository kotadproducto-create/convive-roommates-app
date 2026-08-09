import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { useTheme } from '../context/ThemeContext'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

export default function Topbar({ title }) {
  const { user, floor, membership, logout } = useAuth()
  const { notifications, unreadCount, markAllNotificationsRead } = useData()
  const { theme, toggleTheme } = useTheme()
  const [open, setOpen] = useState(false)

  return (
    <header className="flex items-center justify-between px-5 py-4 border-b border-linen-200 dark:border-charcoal-700 sticky top-0 bg-linen-100/90 dark:bg-charcoal-900/90 backdrop-blur z-20">
      <div>
        <h1 className="font-display text-xl font-semibold">{title}</h1>
        {floor && <p className="text-xs text-charcoal-900/50 dark:text-linen-100/50">{floor.name} · código {floor.inviteCode}</p>}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={toggleTheme}
          aria-label="Cambiar tema"
          className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-linen-200 dark:hover:bg-charcoal-700"
        >
          {theme === 'light' ? '🌙' : '☀️'}
        </button>

        <div className="relative">
          <button
            onClick={() => {
              setOpen((o) => !o)
              if (!open) markAllNotificationsRead()
            }}
            aria-label="Notificaciones"
            className="relative w-10 h-10 rounded-xl flex items-center justify-center hover:bg-linen-200 dark:hover:bg-charcoal-700"
          >
            🔔
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 bg-clay-500 text-white text-[10px] leading-none rounded-full w-4 h-4 flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>

          {open && (
            <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto card p-2 z-30">
              {notifications.length === 0 && (
                <p className="text-sm text-center py-6 text-charcoal-900/50 dark:text-linen-100/50">
                  Sin notificaciones todavía.
                </p>
              )}
              {notifications.map((n) => (
                <div key={n.id} className="px-3 py-2 rounded-lg hover:bg-linen-100 dark:hover:bg-charcoal-700 text-sm">
                  <p>{n.message}</p>
                  <p className="text-xs text-charcoal-900/40 dark:text-linen-100/40 mt-0.5">
                    {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: es })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="hidden sm:flex items-center gap-2 pl-2 ml-1 border-l border-linen-200 dark:border-charcoal-700">
          <div className="w-8 h-8 rounded-full bg-mustard-400 text-charcoal-900 flex items-center justify-center text-sm font-semibold">
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div className="leading-tight">
            <p className="text-sm font-medium">{user?.name}</p>
            <p className="text-xs text-charcoal-900/50 dark:text-linen-100/50">{membership?.role === 'admin' ? 'Admin' : 'Miembro'}</p>
          </div>
          <button onClick={logout} className="ml-2 text-xs text-plum-500 hover:underline">
            Salir
          </button>
        </div>
      </div>
    </header>
  )
}
