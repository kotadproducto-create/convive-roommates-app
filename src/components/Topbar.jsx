import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { useTheme } from '../context/ThemeContext'
import { useLanguage } from '../context/LanguageContext'
import { MoonIcon, SunIcon, BellIcon, GearIcon, PersonIcon, CloseIcon } from './icons'
import Avatar from './Avatar'
import { formatDistanceToNow } from 'date-fns'

export default function Topbar({ title, subheader }) {
  const { user, floor, membership, logout } = useAuth()
  const { notifications, unreadCount, markAllNotificationsRead } = useData()
  const { theme, toggleTheme } = useTheme()
  const { t, language, setLanguage, dateLocale } = useLanguage()
  const [open, setOpen] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const unread = notifications.filter((n) => !n.read)
  const hasRead = notifications.length > unread.length
  const visibleNotifications = showAll ? notifications : unread

  return (
    <header className="sticky top-0 bg-white/90 dark:bg-ink-900/90 backdrop-blur z-20 border-b border-ink-900/10 dark:border-cream-100/15">
      <div
        className={`flex items-center justify-between px-5 landscape-sm:px-3 ${
          subheader ? 'pt-4 pb-2.5 landscape-sm:pt-2 landscape-sm:pb-1.5' : 'py-4 landscape-sm:py-2'
        }`}
      >
        <div>
          <h1 className="font-display text-xl landscape-sm:text-base font-bold tracking-tight">{title}</h1>
          {floor && (
            <p className="text-xs text-ink-900/50 dark:text-cream-100/50 landscape-sm:hidden">
              {floor.name} · código {floor.inviteCode}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 landscape-sm:gap-1">
        <div className="relative">
          <button
            onClick={() => setOpen((o) => !o)}
            aria-label={t('topbar.notifications')}
            className="relative w-10 h-10 landscape-sm:w-8 landscape-sm:h-8 rounded-xl flex items-center justify-center text-ink-900 dark:text-cream-100 hover:bg-cream-200 dark:hover:bg-ink-700"
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
                  {showAll ? t('topbar.all') : t('topbar.recent')}
                </p>
                {unread.length > 0 && (
                  <button
                    onClick={markAllNotificationsRead}
                    className="text-xs font-semibold text-violet-500 hover:underline"
                  >
                    {t('topbar.markRead')}
                  </button>
                )}
              </div>

              {visibleNotifications.length === 0 && (
                <p className="text-sm text-center py-6 text-ink-900/50 dark:text-cream-100/50">
                  {showAll ? t('topbar.noNotificationsYet') : t('topbar.noNewNotifications')}
                </p>
              )}
              {visibleNotifications.map((n) => (
                <div key={n.id} className="px-3 py-2 rounded-lg hover:bg-cream-100 dark:hover:bg-ink-700 text-sm">
                  <p className={n.read ? '' : 'font-semibold'}>{n.message}</p>
                  <p className="text-xs text-ink-900/40 dark:text-cream-100/40 mt-0.5">
                    {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: dateLocale })}
                  </p>
                </div>
              ))}

              {hasRead && (
                <button
                  type="button"
                  onClick={() => setShowAll((s) => !s)}
                  className="w-full text-center text-xs font-semibold text-violet-500 hover:underline pt-2 mt-1 border-t border-ink-900/10 dark:border-cream-100/15"
                >
                  {showAll ? t('topbar.hidePrevious') : t('topbar.showPrevious')}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="relative">
          <button
            onClick={() => setSettingsOpen((o) => !o)}
            aria-label={t('topbar.settingsAria')}
            className="w-10 h-10 landscape-sm:w-8 landscape-sm:h-8 rounded-xl flex items-center justify-center text-ink-900 dark:text-cream-100 hover:bg-cream-200 dark:hover:bg-ink-700"
          >
            <GearIcon className="w-5 h-5" />
          </button>

          {settingsOpen && (
            <div className="absolute right-0 mt-2 w-56 card p-1.5 z-30" onClick={() => setSettingsOpen(false)}>
              <Link to="/perfil" className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold hover:bg-cream-200 dark:hover:bg-ink-700">
                <PersonIcon className="w-4 h-4 shrink-0" />
                {t('topbar.myProfile')}
              </Link>
              <Link
                to="/perfil#preferencias"
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold hover:bg-cream-200 dark:hover:bg-ink-700"
              >
                <GearIcon className="w-4 h-4 shrink-0" />
                {t('topbar.settings')}
              </Link>
              <div className="flex items-center justify-between gap-2.5 px-3 py-2.5">
                <span className="flex items-center gap-2.5 text-sm font-semibold">
                  {theme === 'dark' ? <MoonIcon className="w-4 h-4 shrink-0" /> : <SunIcon className="w-4 h-4 shrink-0" />}
                  {t('topbar.darkTheme')}
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={theme === 'dark'}
                  aria-label={t('topbar.darkTheme')}
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleTheme()
                  }}
                  className={`w-10 h-5 rounded-full relative shrink-0 transition-colors border-2 border-ink-900 dark:border-cream-100/40 ${
                    theme === 'dark' ? 'bg-violet-500' : 'bg-cream-200'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                      theme === 'dark' ? 'translate-x-[18px]' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
              <div className="flex items-center justify-between gap-2.5 px-3 py-2.5">
                <span className="text-sm font-semibold">{t('topbar.language')}</span>
                <div
                  className="flex bg-cream-200 dark:bg-ink-700 rounded-lg p-0.5 text-xs font-semibold"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => setLanguage('es')}
                    aria-pressed={language === 'es'}
                    className={`px-2.5 py-1 rounded-md ${language === 'es' ? 'bg-white dark:bg-ink-800 shadow-sm' : 'opacity-60'}`}
                  >
                    ES
                  </button>
                  <button
                    type="button"
                    onClick={() => setLanguage('en')}
                    aria-pressed={language === 'en'}
                    className={`px-2.5 py-1 rounded-md ${language === 'en' ? 'bg-white dark:bg-ink-800 shadow-sm' : 'opacity-60'}`}
                  >
                    EN
                  </button>
                </div>
              </div>
              <div className="my-1 border-t border-ink-900/10 dark:border-cream-100/15" />
              <button
                type="button"
                onClick={logout}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold text-clay-500 hover:bg-clay-100 dark:hover:bg-clay-500/15"
              >
                <CloseIcon className="w-4 h-4 shrink-0" />
                {t('topbar.logout')}
              </button>
            </div>
          )}
        </div>

        <div className="hidden sm:flex items-center gap-2 pl-2 ml-1 border-l border-ink-900/10 dark:border-cream-100/15">
          <Link to="/perfil" className="flex items-center gap-2 hover:opacity-80" title="Ir a Perfil">
            <Avatar url={user?.avatarUrl} name={user?.name} size="w-8 h-8" />
            <div className="leading-tight">
              <p className="text-sm font-semibold">{user?.name}</p>
              <p className="text-xs text-ink-900/50 dark:text-cream-100/50">{membership?.role === 'admin' ? t('topbar.admin') : t('topbar.member')}</p>
            </div>
          </Link>
          <button onClick={logout} className="ml-2 text-xs font-semibold text-violet-500 hover:underline">
            {t('topbar.exit')}
          </button>
        </div>
      </div>
      </div>
      {subheader}
    </header>
  )
}
