import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { TASK_TYPES, TASK_DAY_OFFSET, getMondayOfWeek, computeWeekStreak } from '../lib/rotation'
import { StampIcon, JarIcon, SparkleIcon, CartIcon, CoinIcon, SunIcon, MoonIcon, FlameIcon, UsersIcon, BellIcon } from '../components/icons'
import { potAmountColorClass } from '../lib/pot'
import { getTimeGreeting } from '../lib/greeting'
import { useToast } from '../context/ToastContext'
import { useLanguage } from '../context/LanguageContext'
import Reveal from '../components/Reveal'
import PendingPopups from '../components/PendingPopups'
import { format, formatDistanceToNow, isSameDay } from 'date-fns'

export default function Timeline() {
  const { user } = useAuth()
  const { floor, members, tasks, notifications, shoppingItems, completeTask, uncompleteTask, weekKey, markAllNotificationsRead } = useData()
  const { showToast } = useToast()
  const { t, dateLocale } = useLanguage()
  const [showAllNotifications, setShowAllNotifications] = useState(false)

  const monday = getMondayOfWeek(weekKey)
  const unreadNotifications = notifications.filter((n) => !n.read)
  const hasReadNotifications = notifications.length > unreadNotifications.length
  const visibleNotifications = showAllNotifications ? notifications : unreadNotifications

  function handleStamp(task, type) {
    if (task.completed) {
      uncompleteTask(task.id)
    } else {
      completeTask(task.id)
      showToast(`¡${type.label} completada! +${type.points} recompensas`, 'success')
    }
  }

  const memberById = useMemo(() => Object.fromEntries(members.map((m) => [m.id, m])), [members])

  const days = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
      const date = new Date(monday)
      date.setUTCDate(monday.getUTCDate() + i)
      const type = TASK_TYPES.find((t) => TASK_DAY_OFFSET[t.key] === i)
      const task = type ? tasks.find((t) => t.type === type.key) : null
      return { date, type, task }
    })
  }, [monday, tasks])

  const outOfStockCount = shoppingItems.filter((i) => i.stockLevel === 'out').length
  const pendingShoppingCount = shoppingItems.filter((i) => i.stockLevel !== 'ok').length
  const weekDone = tasks.filter((t) => t.completed).length
  const weekStreak = computeWeekStreak(tasks, weekKey)
  const greeting = getTimeGreeting()
  const GreetingIcon = greeting.icon === 'moon' ? MoonIcon : SunIcon

  return (
    <>
      <PendingPopups user={user} floor={floor} tasks={tasks} shoppingItems={shoppingItems} />
      <AppLayout
        title={t('nav.inicio')}
        subheader={
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar px-5 pb-3">
          <Chip
            to="/calendario"
            tone="sky"
            icon={StampIcon}
            value={`${weekDone}/${tasks.length}`}
            label={t('timeline.chips.activities')}
            streak={weekStreak}
          />
          <Chip to="/recompensas" tone="gold" icon={CoinIcon} value={user?.points || 0} label={t('timeline.chips.points')} />
          <Chip
            to="/pote"
            tone="gold"
            icon={JarIcon}
            value={`${floor?.potAmount ?? 0}€`}
            label={t('timeline.chips.pot')}
            valueClassName={potAmountColorClass(floor?.potAmount ?? 0)}
          />
          <Chip to="/compras" tone="coral" icon={CartIcon} value={pendingShoppingCount} label={t('timeline.chips.shopping')} />
        </div>
      }
    >
      {/* Perfil + saludo: sin caja, flotando sobre el fondo */}
      <div className="flex items-center gap-4 landscape-sm:gap-3 mb-6 landscape-sm:mb-3 mt-1">
        <div className="w-16 h-16 landscape-sm:w-11 landscape-sm:h-11 rounded-full bg-gold-400 border-2 border-ink-900 text-ink-900 flex items-center justify-center text-2xl landscape-sm:text-base font-bold shrink-0">
          {user?.name?.[0]?.toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-violet-500 dark:text-violet-300">
            <GreetingIcon className="w-3.5 h-3.5" />
            {t(`greeting.${greeting.key}`)}
          </p>
          <h2 className="font-display text-2xl font-bold tracking-tight -mt-0.5">{user?.name?.split(' ')[0]}</h2>
          <p className="font-display text-sm font-medium text-ink-900/60 dark:text-cream-100/60">
            {t('timeline.subtitle', { floorName: floor?.name })}
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5 items-start mb-8">
        {/* Calendario de racha */}
        <section className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-lg font-bold">{t('timeline.streakTitle')}</h3>
            {weekStreak > 0 && (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-gold-600 dark:text-gold-300">
                <FlameIcon className="w-4 h-4" />
                {weekStreak} {weekStreak === 1 ? t('timeline.streakWeek') : t('timeline.streakWeeks')}
              </span>
            )}
          </div>
          <div className="card p-4">
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
              {days.map(({ date, type, task }) => {
                const assignee = task ? memberById[task.assignedUserId] : null
                const today = isSameDay(date, new Date())
                const isFuture = date.getTime() > Date.now()
                const isMinePending = assignee?.id === user?.id && task && !task.completed
                return (
                  <div
                    key={date.toISOString()}
                    className={`flex flex-col items-center gap-1.5 rounded-xl py-2.5 px-1 ${today ? 'bg-violet-50 dark:bg-violet-700/20' : ''}`}
                  >
                    <span className="text-[10px] font-bold uppercase text-ink-900/40 dark:text-cream-100/40">
                      {format(date, 'EEEEE', { locale: dateLocale })}
                    </span>
                    <span className="text-xs font-bold">{format(date, 'd')}</span>
                    {type ? (
                      <button
                        type="button"
                        disabled={isFuture || !task}
                        onClick={() => handleStamp(task, type)}
                        title={`${type.label} · ${assignee?.name || 'Sin asignar'}${isMinePending ? ' — te toca a ti' : ''}`}
                        className="stamp-btn relative mt-1 disabled:cursor-not-allowed"
                      >
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold border-2 transition-colors ${
                            task?.completed
                              ? 'bg-gold-400 border-ink-900 text-ink-900 shadow-[0_3px_0_0_theme(colors.ink.900)]'
                              : isMinePending
                                ? 'bg-coral-500 border-ink-900 text-white shadow-[0_3px_0_0_theme(colors.ink.900)] ring-2 ring-coral-500/40'
                                : `bg-cream-100 dark:bg-ink-700 border-dashed text-ink-900/40 dark:text-cream-100/40 ${
                                    isFuture
                                      ? 'border-ink-900/10 dark:border-cream-100/10 opacity-50'
                                      : 'border-ink-900/30 dark:border-cream-100/30 shadow-[0_3px_0_0_theme(colors.ink.900/20%)]'
                                  }`
                          }`}
                        >
                          {assignee?.name?.[0]?.toUpperCase() || '?'}
                        </div>
                        {task?.completed && (
                          <StampIcon className="w-4 h-4 absolute -bottom-1 -right-1 text-violet-500 bg-cream-100 dark:bg-ink-800 rounded-full" />
                        )}
                      </button>
                    ) : (
                      <div className="w-9 h-9 mt-1" />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        <aside className="flex flex-col gap-4">
          {/* Pote de dinero: disponible ahora + acceso directo */}
          <div className="card p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-gold-100 dark:bg-gold-400/20 text-gold-500 flex items-center justify-center shrink-0">
                <JarIcon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-900/50 dark:text-cream-100/50">{t('timeline.potCardLabel')}</p>
                <p className={`text-xl font-display font-bold ${potAmountColorClass(floor?.potAmount ?? 0)}`}>{t('timeline.potAvailable', { amount: floor?.potAmount ?? 0 })}</p>
              </div>
            </div>
            <Link to="/pote" className="btn-secondary text-sm w-full">
              {t('timeline.viewDetails')}
            </Link>
          </div>

          {/* Notificaciones recientes */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display text-base font-bold flex items-center gap-1.5">
                <BellIcon className="w-4 h-4" />
                {t('timeline.notifications')}
              </h3>
              {unreadNotifications.length > 0 && (
                <button onClick={markAllNotificationsRead} className="text-xs font-semibold text-violet-500 hover:underline">
                  {t('timeline.markRead')}
                </button>
              )}
            </div>
            {visibleNotifications.length === 0 ? (
              <p className="text-sm text-ink-900/50 dark:text-cream-100/50">
                {showAllNotifications ? t('timeline.noNotificationsYet') : t('timeline.noNewNotifications')}
              </p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {visibleNotifications.slice(0, 5).map((n) => (
                  <li key={n.id} className="text-sm">
                    <p className={n.read ? '' : 'font-semibold'}>{n.message}</p>
                    <p className="text-xs text-ink-900/40 dark:text-cream-100/40">
                      {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: dateLocale })}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            {hasReadNotifications && (
              <button
                type="button"
                onClick={() => setShowAllNotifications((s) => !s)}
                className="w-full text-center text-xs font-semibold text-violet-500 hover:underline pt-3 mt-3 border-t border-ink-900/10 dark:border-cream-100/15"
              >
                {showAllNotifications ? t('timeline.hidePrevious') : t('timeline.showPrevious')}
              </button>
            )}
          </div>
        </aside>
      </div>

      {/* Temas */}
      <section>
        <h3 className="font-display text-lg font-bold mb-3">{t('timeline.themesTitle')}</h3>
        <p className="text-xs text-ink-900/40 dark:text-cream-100/40 mb-3 sm:hidden">{t('timeline.swipeHint')}</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Reveal delay={0}>
            <ThemeCard
              to="/calendario"
              icon={SparkleIcon}
              tone="sky"
              label={t('timeline.themeActivities')}
              stat={t('timeline.themeActivitiesStat', { done: weekDone, total: tasks.length })}
            />
          </Reveal>
          <Reveal delay={60}>
            <ThemeCard
              to="/compras"
              icon={CartIcon}
              tone="coral"
              label={t('timeline.themeShopping')}
              stat={
                outOfStockCount > 0
                  ? t('timeline.outOfStock', { count: outOfStockCount, plural: outOfStockCount > 1 ? 's' : '' })
                  : t('timeline.inList', { count: shoppingItems.length })
              }
              warn={outOfStockCount > 0}
            />
          </Reveal>
          <Reveal delay={120}>
            <ThemeCard to="/pote" icon={JarIcon} tone="gold" label={t('timeline.themePot')} stat={t('timeline.themePotStat', { amount: floor?.potAmount ?? 0 })} />
          </Reveal>
          <Reveal delay={180}>
            <ThemeCard
              to="/convives"
              icon={UsersIcon}
              tone="violet"
              label={t('timeline.themeConvives')}
              stat={t('timeline.themeConvivesStat', { count: members.length })}
            />
          </Reveal>
        </div>
      </section>
      </AppLayout>
    </>
  )
}

const CHIP_TONE_CLASSES = {
  sage: { bg: 'bg-sage-100 dark:bg-sage-500/15', badge: 'bg-sage-500' },
  gold: { bg: 'bg-gold-100 dark:bg-gold-400/15', badge: 'bg-gold-500' },
  violet: { bg: 'bg-violet-100 dark:bg-violet-700/20', badge: 'bg-violet-500' },
  coral: { bg: 'bg-coral-100 dark:bg-coral-500/15', badge: 'bg-coral-500' },
  sky: { bg: 'bg-sky-100 dark:bg-sky-500/15', badge: 'bg-sky-500' }
}

// Botón de acceso rápido de la cabecera de Inicio (racha, recompensas,
// pote, compras): icono en una burbuja de color sólido + valor/etiqueta,
// y lleva directo a su apartado. `streak` (opcional) agrega el fueguito
// con el número de semanas seguidas completadas, en la esquina del
// icono — dorado y un poco más grande a partir de 7, para dar la
// sensación de "racha larga".
function Chip({ to, tone, icon: Icon, value, label, valueClassName, streak }) {
  const t = CHIP_TONE_CLASSES[tone]
  const isLongStreak = streak >= 7
  return (
    <Link
      to={to}
      className={`shrink-0 inline-flex items-center gap-1.5 border-2 border-ink-900/70 dark:border-cream-100/30 rounded-full pl-1 pr-2.5 py-1 ${t.bg} shadow-[0_2px_0_0_theme(colors.ink.900/20%)] dark:shadow-[0_2px_0_0_theme(colors.cream.100/15%)] transition-transform active:translate-y-0.5 active:shadow-none`}
    >
      <span className={`relative w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${t.badge}`}>
        <Icon className="w-3 h-3 text-white" />
        {streak > 0 && (
          <span
            className={`absolute -top-1.5 -right-1.5 flex items-center gap-0.5 pl-0.5 pr-1 h-3.5 rounded-full border border-cream-100 dark:border-ink-900 ${
              isLongStreak ? 'bg-gold-500 scale-110' : 'bg-coral-500'
            }`}
          >
            <FlameIcon className="w-2 h-2 text-white shrink-0" />
            <span className="text-[8px] font-extrabold text-white leading-none">{streak}</span>
          </span>
        )}
      </span>
      <span className="leading-tight whitespace-nowrap">
        <span className={`block text-xs font-bold ${valueClassName || 'text-ink-900 dark:text-cream-100'}`}>{value}</span>
        <span className="block text-[9px] font-bold uppercase tracking-wide text-ink-900/50 dark:text-cream-100/50 -mt-0.5">
          {label}
        </span>
      </span>
    </Link>
  )
}

const GRADIENT_CLASSES = {
  violet: 'bg-gradient-to-br from-violet-500 to-[#4C36AD] text-white',
  coral: 'bg-gradient-to-br from-coral-500 to-[#E24322] text-white',
  gold: 'bg-gradient-to-br from-gold-400 to-[#D99420] text-ink-900',
  sky: 'bg-gradient-to-br from-sky-500 to-[#2E5BD9] text-white'
}
const ICON_BADGE_CLASSES = {
  violet: 'bg-white/20 border-white/50 text-white',
  coral: 'bg-white/20 border-white/50 text-white',
  gold: 'bg-ink-900/10 border-ink-900/35 text-ink-900',
  sky: 'bg-white/20 border-white/50 text-white'
}
const STAT_CLASSES = {
  violet: 'text-white/85',
  coral: 'text-white/85',
  gold: 'text-ink-900/75',
  sky: 'text-white/85'
}
const SWIPE_REVEAL = 64

// Tarjeta de sección: arrastrarla hacia la izquierda revela un acceso
// directo "Ir" detrás — sigue siendo un <Link> normal por debajo, así
// que tocarla (sin arrastrar) navega igual que antes.
function ThemeCard({ icon: Icon, label, stat, tone, warn, soon, to }) {
  const { t } = useLanguage()
  const [dragX, setDragX] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const drag = useRef({ startX: 0, active: false, moved: false })
  const draggable = Boolean(to) && !soon

  function handlePointerDown(e) {
    if (!draggable) return
    drag.current = { startX: e.clientX, active: true, moved: false }
    setIsDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  function handlePointerMove(e) {
    if (!drag.current.active) return
    const delta = drag.current.startX - e.clientX
    if (Math.abs(delta) > 4) drag.current.moved = true
    setDragX(Math.min(Math.max(delta, 0), SWIPE_REVEAL))
  }
  function handlePointerUp() {
    if (!drag.current.active) return
    drag.current.active = false
    setIsDragging(false)
    setDragX((x) => (x > SWIPE_REVEAL / 2 ? SWIPE_REVEAL : 0))
  }
  function handleClickCapture(e) {
    if (drag.current.moved) {
      e.preventDefault()
      drag.current.moved = false
    }
  }

  const content = (
    <>
      <div className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center relative shrink-0 ${ICON_BADGE_CLASSES[tone]}`}>
        <Icon className="w-5 h-5" />
        {warn && (
          <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-clay-500 border-2 border-cream-100 dark:border-ink-900" />
        )}
      </div>
      <p className="font-display font-bold text-base mt-2.5">{label}</p>
      <p className={`font-display text-xs font-semibold ${STAT_CLASSES[tone]}`}>{stat}</p>
    </>
  )

  if (!draggable) {
    return (
      <div
        className={`rounded-2xl p-4 flex flex-col min-h-[128px] border-2 border-ink-900/70 dark:border-cream-100/20 ${GRADIENT_CLASSES[tone]} ${soon ? 'opacity-55' : ''}`}
      >
        {content}
      </div>
    )
  }

  return (
    <div className="relative rounded-2xl overflow-hidden border-2 border-ink-900 dark:border-cream-100/40">
      <div className="absolute inset-0 flex items-center justify-end pr-3 bg-ink-900">
        <Link
          to={to}
          className="w-10 h-10 rounded-full border-2 border-cream-100 bg-cream-100 text-ink-900 flex items-center justify-center text-lg font-bold shrink-0"
          aria-label={t('timeline.goTo', { label })}
        >
          →
        </Link>
      </div>
      <Link
        to={to}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClickCapture={handleClickCapture}
        style={{ transform: `translateX(${-dragX}px)`, touchAction: 'pan-y' }}
        className={`relative flex flex-col min-h-[128px] p-4 transition-transform ${isDragging ? '' : 'duration-200 ease-out'} ${GRADIENT_CLASSES[tone]}`}
      >
        {content}
      </Link>
    </div>
  )
}
