import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  format,
  addMonths,
  addWeeks,
  addDays,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday
} from 'date-fns'
import { es } from 'date-fns/locale'
import { TASK_TYPES, TASK_DAY_OFFSET, getWeekKey, whoIsAssigned } from '../lib/rotation'
import { TASK_ICONS, JarIcon, CartIcon, StoreIcon, WasherIcon } from './icons'
import { useToast } from '../context/ToastContext'
import { TASK_TONE_CLASSES } from './TaskCard'

const VIEW_MODES = [
  { key: 'month', label: 'Mes' },
  { key: 'week', label: 'Semana' },
  { key: 'day', label: 'Día' }
]

/**
 * Calendario gráfico con vistas mes/semana/día y navegación.
 * La asignación de cada día se calcula en vivo con whoIsAssigned/getWeekKey
 * (la misma lógica real que ya usa la app) — nunca se inventan datos.
 * Solo la semana ACTUAL tiene tareas reales cargadas (tasks), así que solo
 * ahí se puede marcar/deshacer; el resto del calendario es el horario
 * previsto (quién le toca), no un historial de si se cumplió o no.
 */
export default function CalendarView({
  floor,
  memberById,
  currentWeekKey,
  tasks,
  completeTask,
  uncompleteTask,
  potContributions = [],
  shoppingPurchases = [],
  shoppingItems = [],
  notifications = []
}) {
  const [view, setView] = useState('month')
  const [cursor, setCursor] = useState(() => new Date())

  function shift(dir) {
    setCursor((d) => (view === 'month' ? addMonths(d, dir) : view === 'week' ? addWeeks(d, dir) : addDays(d, dir)))
  }

  function dayInfo(date) {
    const dow = (date.getDay() + 6) % 7 // 0=lunes .. 6=domingo
    const type = TASK_TYPES.find((t) => TASK_DAY_OFFSET[t.key] === dow)
    if (!type || !floor) return {}
    const wk = getWeekKey(date)
    const isCurrentWeek = wk === currentWeekKey
    const assignedUserId = isCurrentWeek
      ? tasks.find((t) => t.type === type.key)?.assignedUserId
      : whoIsAssigned(floor.rotationOrder, wk, type.offset)
    const task = isCurrentWeek ? tasks.find((t) => t.type === type.key) : null
    return { type, assignee: memberById[assignedUserId], task, isCurrentWeek }
  }

  const title = useMemo(() => {
    if (view === 'month') return format(cursor, "MMMM 'de' yyyy", { locale: es })
    if (view === 'week') {
      const start = startOfWeek(cursor, { weekStartsOn: 1 })
      const end = endOfWeek(cursor, { weekStartsOn: 1 })
      return `${format(start, 'd MMM', { locale: es })} – ${format(end, 'd MMM', { locale: es })}`
    }
    return format(cursor, "EEEE d 'de' MMMM", { locale: es })
  }, [view, cursor])

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => shift(-1)}
            aria-label="Anterior"
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-cream-200 dark:hover:bg-ink-700 active:scale-90 transition-transform"
          >
            ‹
          </button>
          <p className="font-display font-bold capitalize min-w-[9rem] sm:min-w-[11rem] text-center">{title}</p>
          <button
            type="button"
            onClick={() => shift(1)}
            aria-label="Siguiente"
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-cream-200 dark:hover:bg-ink-700 active:scale-90 transition-transform"
          >
            ›
          </button>
          <button type="button" onClick={() => setCursor(new Date())} className="text-xs font-semibold text-violet-500 hover:underline ml-1">
            Hoy
          </button>
        </div>
        <div className="flex bg-cream-200 dark:bg-ink-700 rounded-full p-1 text-xs font-semibold">
          {VIEW_MODES.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => setView(v.key)}
              className={`px-3 py-1.5 rounded-full transition-colors ${
                view === v.key ? 'bg-white dark:bg-ink-800 shadow-sm' : 'text-ink-900/60 dark:text-cream-100/60'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {view === 'month' && <MonthGrid cursor={cursor} dayInfo={dayInfo} completeTask={completeTask} uncompleteTask={uncompleteTask} />}
      {view === 'week' && <WeekStrip cursor={cursor} dayInfo={dayInfo} completeTask={completeTask} uncompleteTask={uncompleteTask} />}
      {view === 'day' && (
        <DayDetail
          cursor={cursor}
          dayInfo={dayInfo}
          completeTask={completeTask}
          uncompleteTask={uncompleteTask}
          memberById={memberById}
          potContributions={potContributions}
          shoppingPurchases={shoppingPurchases}
          shoppingItems={shoppingItems}
          notifications={notifications}
        />
      )}
    </div>
  )
}

const WEEKDAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

function MonthGrid({ cursor, dayInfo, completeTask, uncompleteTask }) {
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 })
  })

  return (
    <div>
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAY_LABELS.map((d) => (
          <p key={d} className="text-[10px] font-bold uppercase text-center text-ink-900/40 dark:text-cream-100/40">
            {d}
          </p>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((date) => {
          const { type, assignee, task } = dayInfo(date)
          const Icon = type ? TASK_ICONS[type.icon] : null
          const inMonth = isSameMonth(date, cursor)
          return (
            <div
              key={date.toISOString()}
              className={`aspect-square rounded-lg p-1 flex flex-col items-center justify-center gap-0.5 ${
                isToday(date) ? 'bg-violet-50 dark:bg-violet-700/20 ring-2 ring-violet-500' : ''
              } ${!inMonth ? 'opacity-30' : ''}`}
            >
              <span className="text-[10px] font-semibold">{format(date, 'd')}</span>
              {type && (
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center border ${
                    task?.completed
                      ? 'bg-gold-400 border-ink-900'
                      : 'bg-violet-100 dark:bg-violet-700/25 border-violet-200 dark:border-violet-600/40'
                  }`}
                  title={`${type.label} · ${assignee?.name || 'Sin asignar'}`}
                >
                  {Icon && <Icon className="w-3 h-3 text-violet-600 dark:text-violet-100" />}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function WeekStrip({ cursor, dayInfo }) {
  const days = eachDayOfInterval({
    start: startOfWeek(cursor, { weekStartsOn: 1 }),
    end: endOfWeek(cursor, { weekStartsOn: 1 })
  })

  return (
    <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
      {days.map((date) => {
        const { type, assignee, task, isCurrentWeek } = dayInfo(date)
        const Icon = type ? TASK_ICONS[type.icon] : null
        return (
          <div
            key={date.toISOString()}
            className={`flex flex-col items-center gap-1.5 rounded-xl py-3 px-1 ${isToday(date) ? 'bg-violet-50 dark:bg-violet-700/20' : ''}`}
          >
            <span className="text-[10px] font-bold uppercase text-ink-900/40 dark:text-cream-100/40">{format(date, 'EEEEE', { locale: es })}</span>
            <span className="text-xs font-bold">{format(date, 'd')}</span>
            {type ? (
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center border-2 mt-1 ${
                  task?.completed
                    ? 'bg-gold-400 border-ink-900'
                    : 'bg-cream-100 dark:bg-ink-700 border-dashed border-ink-900/30 dark:border-cream-100/30'
                }`}
                title={`${type.label} · ${assignee?.name || 'Sin asignar'}${!isCurrentWeek ? ' (previsto)' : ''}`}
              >
                {Icon && <Icon className="w-4 h-4 text-ink-900/70 dark:text-cream-100/70" />}
              </div>
            ) : (
              <div className="w-9 h-9 mt-1" />
            )}
            <span className="text-[10px] text-ink-900/50 dark:text-cream-100/50 text-center leading-tight">{assignee?.name?.split(' ')[0] || ''}</span>
          </div>
        )
      })}
    </div>
  )
}

const EVENT_TONE_CLASSES = {
  sage: 'bg-sage-100 dark:bg-sage-500/20 text-sage-500',
  clay: 'bg-clay-100 dark:bg-clay-500/20 text-clay-500',
  coral: 'bg-coral-100 dark:bg-coral-500/20 text-coral-500',
  violet: 'bg-violet-100 dark:bg-violet-700/25 text-violet-600 dark:text-violet-200',
  sky: 'bg-sky-100 dark:bg-sky-500/20 text-sky-500'
}

/** Junta, para un día concreto, todo lo que pasó en el piso ese día:
 * aportes/gastos del pote, compras realizadas, productos agregados a la
 * lista, y avisos de lavadora — ordenado cronológicamente, como un
 * historial resumen del día. */
function useDayEvents(cursor, memberById, potContributions, shoppingPurchases, shoppingItems, notifications) {
  return useMemo(() => {
    const events = []

    for (const c of potContributions) {
      if (!isSameDay(new Date(c.createdAt), cursor)) continue
      const isExpense = Number(c.amount) < 0
      events.push({
        id: `pot-${c.id}`,
        time: c.createdAt,
        icon: JarIcon,
        tone: isExpense ? 'clay' : 'sage',
        title: `${memberById[c.userId]?.name || 'Alguien'} ${isExpense ? 'gastó' : 'aportó'} ${Math.abs(Number(c.amount)).toFixed(2)}€ en el pote`,
        subtitle: c.note || null
      })
    }

    for (const p of shoppingPurchases) {
      if (!isSameDay(new Date(p.createdAt), cursor)) continue
      events.push({
        id: `purchase-${p.id}`,
        time: p.createdAt,
        icon: CartIcon,
        tone: 'coral',
        title: `${memberById[p.userId]?.name || 'Alguien'} compró ${p.itemName}`,
        subtitle: p.price ? `${p.price}€` : null
      })
    }

    for (const item of shoppingItems) {
      if (!isSameDay(new Date(item.createdAt), cursor)) continue
      events.push({
        id: `item-${item.id}`,
        time: item.createdAt,
        icon: StoreIcon,
        tone: 'violet',
        title: `${memberById[item.createdBy]?.name || 'Alguien'} agregó "${item.name}" a la lista de compras`,
        subtitle: null
      })
    }

    for (const n of notifications) {
      if (n.type !== 'lavadora' || !isSameDay(new Date(n.createdAt), cursor)) continue
      events.push({
        id: `notif-${n.id}`,
        time: n.createdAt,
        icon: WasherIcon,
        tone: 'sky',
        title: n.message,
        subtitle: null
      })
    }

    return events.sort((a, b) => new Date(a.time) - new Date(b.time))
  }, [cursor, memberById, potContributions, shoppingPurchases, shoppingItems, notifications])
}

function DayDetail({
  cursor,
  dayInfo,
  completeTask,
  uncompleteTask,
  memberById,
  potContributions,
  shoppingPurchases,
  shoppingItems,
  notifications
}) {
  const { type, assignee, task, isCurrentWeek } = dayInfo(cursor)
  const Icon = type ? TASK_ICONS[type.icon] : null
  const toneClass = TASK_TONE_CLASSES[type?.key] || 'bg-violet-100 dark:bg-violet-700/25 text-violet-600 dark:text-violet-200'
  const { showToast } = useToast()
  const events = useDayEvents(cursor, memberById, potContributions, shoppingPurchases, shoppingItems, notifications)

  function handleToggle() {
    if (task.completed) {
      uncompleteTask(task.id)
    } else {
      completeTask(task.id)
      showToast(`¡${type.label} completada! +${type.points} recompensas`, 'success')
    }
  }

  return (
    <div className="py-2">
      {type ? (
        <div className="flex items-center gap-4 py-4 border-b border-ink-900/10 dark:border-cream-100/15">
          {type.key === 'compras' ? (
            <Link
              to="/compras"
              className={`w-14 h-14 rounded-2xl border-2 border-ink-900/70 dark:border-cream-100/30 ${toneClass} flex items-center justify-center shrink-0 hover:opacity-80`}
              title="Ir a la lista de compras"
            >
              {Icon && <Icon className="w-7 h-7" />}
            </Link>
          ) : (
            <div
              className={`w-14 h-14 rounded-2xl border-2 border-ink-900/70 dark:border-cream-100/30 ${toneClass} flex items-center justify-center shrink-0`}
            >
              {Icon && <Icon className="w-7 h-7" />}
            </div>
          )}
          <div className="flex-1 min-w-0">
            {type.key === 'compras' ? (
              <Link to="/compras" className="font-display font-semibold underline decoration-dotted underline-offset-2 hover:opacity-80">
                {type.label}
              </Link>
            ) : (
              <p className="font-display font-semibold">{type.label}</p>
            )}
            <p className="text-sm text-ink-900/60 dark:text-cream-100/60">
              {assignee?.name || 'Sin asignar'} · +{type.points} recompensas
              {isCurrentWeek && task && <span className={task.completed ? 'text-sage-500' : 'text-gold-500'}> · {task.completed ? 'Hecha' : 'Pendiente'}</span>}
            </p>
            {!isCurrentWeek && (
              <p className="text-xs text-ink-900/40 dark:text-cream-100/40 mt-0.5">Horario previsto, todavía no es la semana en curso.</p>
            )}
          </div>
          {isCurrentWeek && task && (
            <button type="button" onClick={handleToggle} className={task.completed ? 'btn-secondary text-sm shrink-0' : 'btn-primary text-sm shrink-0'}>
              {task.completed ? 'Deshacer' : 'Marcar como hecha'}
            </button>
          )}
        </div>
      ) : (
        <p className="text-sm text-center py-6 text-ink-900/50 dark:text-cream-100/50">Ninguna tarea programada este día.</p>
      )}

      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-900/50 dark:text-cream-100/50 mb-2">Resumen del día</p>
        {events.length === 0 ? (
          <p className="text-sm text-ink-900/50 dark:text-cream-100/50 py-2">Sin más actividad registrada este día.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {events.map((e) => (
              <li key={e.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-cream-100 dark:bg-ink-700">
                <div
                  className={`w-9 h-9 rounded-xl border-2 border-ink-900/70 dark:border-cream-100/30 flex items-center justify-center shrink-0 ${EVENT_TONE_CLASSES[e.tone]}`}
                >
                  <e.icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{e.title}</p>
                  {e.subtitle && <p className="text-xs text-ink-900/50 dark:text-cream-100/50 truncate">{e.subtitle}</p>}
                </div>
                <span className="text-xs text-ink-900/40 dark:text-cream-100/40 shrink-0">{format(new Date(e.time), 'HH:mm')}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
