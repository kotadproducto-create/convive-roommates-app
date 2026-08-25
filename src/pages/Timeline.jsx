import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { TASK_TYPES, TASK_DAY_OFFSET, getMondayOfWeek } from '../lib/rotation'
import { StampIcon, DropletIcon, JarIcon, SparkleIcon, CartIcon } from '../components/icons'
import { potAmountColorClass } from '../lib/pot'
import { useToast } from '../context/ToastContext'
import Reveal from '../components/Reveal'
import { format, formatDistanceToNow, isSameDay } from 'date-fns'
import { es } from 'date-fns/locale'

export default function Timeline() {
  const { user } = useAuth()
  const { floor, members, tasks, notifications, shoppingItems, completeTask, uncompleteTask, weekKey, markAllNotificationsRead } = useData()
  const { showToast } = useToast()

  const monday = getMondayOfWeek(weekKey)

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

  return (
    <AppLayout title="Inicio">
      {/* Perfil + saludo */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-14 h-14 rounded-full bg-gold-400 border-2 border-ink-900 text-ink-900 flex items-center justify-center text-xl font-bold shrink-0">
          {user?.name?.[0]?.toUpperCase()}
        </div>
        <div className="min-w-0">
          <h2 className="font-display text-xl font-bold tracking-tight">Hola, {user?.name?.split(' ')[0]}</h2>
          <p className="text-sm text-ink-900/60 dark:text-cream-100/60">Esto es lo que pasa en {floor?.name}.</p>
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
              {notifications.length > 0 && (
                <button onClick={markAllNotificationsRead} className="text-xs font-semibold text-violet-500 hover:underline">
                  Marcar leídas
                </button>
              )}
            </div>
            {notifications.length === 0 ? (
              <p className="text-sm text-ink-900/50 dark:text-cream-100/50">Sin notificaciones todavía.</p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {notifications.slice(0, 5).map((n) => (
                  <li key={n.id} className="text-sm">
                    <p className={n.read ? '' : 'font-semibold'}>{n.message}</p>
                    <p className="text-xs text-ink-900/40 dark:text-cream-100/40">
                      {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: es })}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>

      {/* Temas */}
      <section>
        <h3 className="font-display text-lg font-bold mb-3">Temas</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Reveal delay={0}><ThemeCard to="/calendario" icon={DropletIcon} tone="violet" label="Higiene" stat={`${hygieneDone}/${hygieneTasks.length} hecho`} /></Reveal>
          <Reveal delay={60}>
            <ThemeCard
              to="/compras"
              icon={CartIcon}
              tone="coral"
              label="Compras"
              stat={outOfStockCount > 0 ? `${outOfStockCount} agotado${outOfStockCount > 1 ? 's' : ''}` : `${shoppingItems.length} en la lista`}
              statColorClass={outOfStockCount > 0 ? 'text-clay-500' : undefined}
            />
          </Reveal>
          <Reveal delay={120}><ThemeCard to="/pote" icon={JarIcon} tone="gold" label="Pote de dinero" stat={`${floor?.potAmount ?? 0}€`} statColorClass={potAmountColorClass(floor?.potAmount ?? 0)} /></Reveal>
          <Reveal delay={180}><ThemeCard icon={SparkleIcon} tone="sky" label="Actividades" stat="Próximamente" soon /></Reveal>
        </div>
      </section>
    </AppLayout>
  )
}

const TONE_CLASSES = {
  violet: 'bg-violet-100 dark:bg-violet-700/25 text-violet-600 dark:text-violet-200',
  coral: 'bg-coral-100 dark:bg-coral-500/20 text-coral-500',
  gold: 'bg-gold-100 dark:bg-gold-400/20 text-gold-500',
  sky: 'bg-sky-100 dark:bg-sky-500/20 text-sky-500'
}

function ThemeCard({ icon: Icon, label, stat, tone, warn, soon, to, statColorClass }) {
  const content = (
    <>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${TONE_CLASSES[tone]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="font-display font-semibold text-sm">{label}</p>
      <p className={`text-xs font-semibold ${statColorClass || (warn ? 'text-clay-500' : 'text-ink-900/50 dark:text-cream-100/50')}`}>{stat}</p>
    </>
  )
  if (to && !soon) {
    return (
      <Link to={to} className="card p-4 flex flex-col gap-2 transition-transform hover:-translate-y-0.5 active:scale-95">
        {content}
      </Link>
    )
  }
  return <div className={`card p-4 flex flex-col gap-2 ${soon ? 'opacity-60' : ''}`}>{content}</div>
}
