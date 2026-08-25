import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { TASK_TYPES, TASK_DAY_OFFSET, getMondayOfWeek } from '../lib/rotation'
import { StampIcon, DropletIcon, JarIcon, SparkleIcon, CartIcon, CoinIcon } from '../components/icons'
import { potAmountColorClass } from '../lib/pot'
import { useToast } from '../context/ToastContext'
import Reveal from '../components/Reveal'
import { format, formatDistanceToNow, isSameDay } from 'date-fns'
import { es } from 'date-fns/locale'

export default function Timeline() {
  const { user } = useAuth()
  const { floor, members, tasks, notifications, shoppingItems, completeTask, uncompleteTask, weekKey, markAllNotificationsRead } = useData()
  const { showToast } = useToast()
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

  const hygieneTasks = tasks.filter((t) => t.type === 'basura' || t.type === 'lavadora')
  const hygieneDone = hygieneTasks.filter((t) => t.completed).length
  const outOfStockCount = shoppingItems.filter((i) => i.stockLevel === 'out').length
  const weekDone = tasks.filter((t) => t.completed).length

  return (
    <AppLayout title="Inicio">
      {/* Chips: tareas de la semana, recompensas, pote */}
      <div className="flex items-center gap-2 mb-4">
        <span className="inline-flex items-center gap-1.5 text-xs font-bold border-2 border-ink-900/70 dark:border-cream-100/30 rounded-full pl-2 pr-2.5 py-1 bg-sage-100 dark:bg-sage-500/15 text-sage-600 dark:text-sage-300">
          <StampIcon className="w-3.5 h-3.5" />
          {weekDone}/{tasks.length}
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs font-bold border-2 border-ink-900/70 dark:border-cream-100/30 rounded-full pl-2 pr-2.5 py-1 bg-gold-100 dark:bg-gold-400/15 text-gold-600 dark:text-gold-300">
          <CoinIcon className="w-3.5 h-3.5" />
          {user?.points || 0}
        </span>
        <span
          className={`inline-flex items-center gap-1.5 text-xs font-bold border-2 border-ink-900/70 dark:border-cream-100/30 rounded-full pl-2 pr-2.5 py-1 bg-violet-100 dark:bg-violet-700/20 ${potAmountColorClass(floor?.potAmount ?? 0)}`}
        >
          <JarIcon className="w-3.5 h-3.5" />
          {floor?.potAmount ?? 0}€
        </span>
      </div>

      {/* Perfil + saludo */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-14 h-14 rounded-full bg-gold-400 border-2 border-ink-900 text-ink-900 flex items-center justify-center text-xl font-bold shrink-0">
          {user?.name?.[0]?.toUpperCase()}
        </div>
        <div className="min-w-0">
          <h2 className="font-display text-xl font-bold tracking-tight">¡Hola, {user?.name?.split(' ')[0]}!</h2>
          <p className="font-display text-sm font-medium text-ink-900/60 dark:text-cream-100/60">
            Esto es lo que pasa en {floor?.name}.
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5 items-start mb-8">
        {/* Calendario de racha */}
        <section className="lg:col-span-2">
          <h3 className="font-display text-lg font-bold mb-3">Racha de la semana</h3>
          <div className="card p-4">
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
              {days.map(({ date, type, task }) => {
                const assignee = task ? memberById[task.assignedUserId] : null
                const today = isSameDay(date, new Date())
                const isFuture = date.getTime() > Date.now()
                return (
                  <div
                    key={date.toISOString()}
                    className={`flex flex-col items-center gap-1.5 rounded-xl py-2.5 px-1 ${today ? 'bg-violet-50 dark:bg-violet-700/20' : ''}`}
                  >
                    <span className="text-[10px] font-bold uppercase text-ink-900/40 dark:text-cream-100/40">
                      {format(date, 'EEEEE', { locale: es })}
                    </span>
                    <span className="text-xs font-bold">{format(date, 'd')}</span>
                    {type ? (
                      <button
                        type="button"
                        disabled={isFuture || !task}
                        onClick={() => handleStamp(task, type)}
                        title={`${type.label} · ${assignee?.name || 'Sin asignar'}`}
                        className="stamp-btn relative mt-1 disabled:cursor-not-allowed"
                      >
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold border-2 transition-colors ${
                            task?.completed
                              ? 'bg-gold-400 border-ink-900 text-ink-900 shadow-[0_3px_0_0_theme(colors.ink.900)]'
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
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-900/50 dark:text-cream-100/50">Pote de dinero</p>
                <p className={`text-xl font-display font-bold ${potAmountColorClass(floor?.potAmount ?? 0)}`}>{floor?.potAmount ?? 0}€ disponibles</p>
              </div>
            </div>
            <Link to="/pote" className="btn-secondary text-sm w-full">
              Ver detalles
            </Link>
          </div>

          {/* Notificaciones recientes */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display text-base font-bold">Notificaciones</h3>
              {unreadNotifications.length > 0 && (
                <button onClick={markAllNotificationsRead} className="text-xs font-semibold text-violet-500 hover:underline">
                  Marcar leídas
                </button>
              )}
            </div>
            {visibleNotifications.length === 0 ? (
              <p className="text-sm text-ink-900/50 dark:text-cream-100/50">
                {showAllNotifications ? 'Sin notificaciones todavía.' : 'Sin notificaciones nuevas.'}
              </p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {visibleNotifications.slice(0, 5).map((n) => (
                  <li key={n.id} className="text-sm">
                    <p className={n.read ? '' : 'font-semibold'}>{n.message}</p>
                    <p className="text-xs text-ink-900/40 dark:text-cream-100/40">
                      {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: es })}
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
                {showAllNotifications ? 'Ocultar anteriores' : 'Ver notificaciones anteriores'}
              </button>
            )}
          </div>
        </aside>
      </div>

      {/* Temas */}
      <section>
        <h3 className="font-display text-lg font-bold mb-3">Temas</h3>
        <p className="text-xs text-ink-900/40 dark:text-cream-100/40 mb-3 sm:hidden">Desliza una tarjeta para ir más rápido.</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Reveal delay={0}>
            <ThemeCard to="/calendario" icon={DropletIcon} tone="violet" label="Higiene" stat={`${hygieneDone}/${hygieneTasks.length} hecho`} />
          </Reveal>
          <Reveal delay={60}>
            <ThemeCard
              to="/compras"
              icon={CartIcon}
              tone="coral"
              label="Compras"
              stat={outOfStockCount > 0 ? `${outOfStockCount} agotado${outOfStockCount > 1 ? 's' : ''}` : `${shoppingItems.length} en la lista`}
              warn={outOfStockCount > 0}
            />
          </Reveal>
          <Reveal delay={120}>
            <ThemeCard to="/pote" icon={JarIcon} tone="gold" label="Pote de dinero" stat={`${floor?.potAmount ?? 0}€ disponibles`} />
          </Reveal>
          <Reveal delay={180}>
            <ThemeCard icon={SparkleIcon} tone="sky" label="Actividades" stat="Próximamente" soon />
          </Reveal>
        </div>
      </section>
    </AppLayout>
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
          aria-label={`Ir a ${label}`}
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
