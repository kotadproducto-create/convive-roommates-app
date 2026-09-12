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
import { currentPeriodKey, isDueOnDate, assigneeFor, getWeekKeyOf } from '../lib/activities'
import { JarIcon, CartIcon, StoreIcon, WasherIcon, SparkleIcon } from './icons'
import { useToast } from '../context/ToastContext'
import { useLanguage } from '../context/LanguageContext'
import { TASK_TONE_CLASSES } from './TaskCard'
import { FIXED_ICONS } from './ActivityCard'

const ACTIVITY_TONE_CLASS = 'bg-violet-100 dark:bg-violet-700/25 text-violet-600 dark:text-violet-200'

/**
 * Calendario gráfico con vistas mes/semana/día y navegación. Las 3
 * tareas fijas (Compras/Basura/Lavadora, `activity.fixedKey`) y las
 * actividades propias del piso son ahora filas de la misma tabla
 * `activities` (ver lib/activities.js) — un solo camino de datos para
 * ambas. Solo el período ACTUAL de cada actividad tiene una fila real
 * en `activityCompletions` (ver `ensureActivityPeriods`), así que solo
 * ahí hay algo que marcar/deshacer; para otras fechas se previsualiza
 * de solo lectura quién le tocaría por rotación (`assigneeFor`), sin
 * inventar un historial de si se cumplió o no.
 *
 * Cada día puede traer MÁS DE UN ítem (varias actividades cayendo el
 * mismo día — ver isDueOnDate en lib/activities.js). Por eso
 * `dayInfo(date)` devuelve una LISTA, no un solo objeto: Mes/Semana
 * muestran el primero (con un "+N" si hay más) por espacio, y Día los
 * lista todos. Las actividades propias se muestran de solo lectura
 * acá (marcarlas hecha sigue siendo cosa de Actividades) — las 3
 * fijas conservan su botón de marcar/deshacer de siempre.
 */
export default function CalendarView({
  floor,
  memberById,
  activities = [],
  activityCompletions = [],
  setActivityProgress,
  potContributions = [],
  shoppingPurchases = [],
  shoppingItems = [],
  notifications = [],
  currentUserId
}) {
  const [view, setView] = useState('month')
  const [cursor, setCursor] = useState(() => new Date())
  const { t, dateLocale } = useLanguage()

  const VIEW_MODES = [
    { key: 'month', label: t('calendar.viewMonth') },
    { key: 'week', label: t('calendar.viewWeek') },
    { key: 'day', label: t('calendar.viewDay') }
  ]

  function shift(dir) {
    setCursor((d) => (view === 'month' ? addMonths(d, dir) : view === 'week' ? addWeeks(d, dir) : addDays(d, dir)))
  }

  function dayInfo(date) {
    const items = []
    const wk = getWeekKeyOf(date)

    for (const activity of activities) {
      if (!isDueOnDate(activity, date)) continue
      const isFixed = Boolean(activity.fixedKey)
      const period = currentPeriodKey(activity, wk)
      const completion = period ? activityCompletions.find((c) => c.activityId === activity.id && c.periodKey === period) : null
      // Sin finalización (semana/día/mes que no es el período activo
      // ahora mismo): se previsualiza igual quién le tocaría por
      // rotación, de solo lectura — mismo espíritu que antes con
      // whoIsAssigned para semanas fuera de la actual.
      const assignedUserId = completion ? completion.assignedUserId : assigneeFor(activity, floor?.rotationOrder, wk)
      const isMine = Boolean(currentUserId) && assignedUserId === currentUserId
      items.push({
        kind: isFixed ? 'fixed' : 'activity',
        key: activity.id,
        icon: isFixed ? FIXED_ICONS[activity.fixedKey] : SparkleIcon,
        label: activity.title,
        points: activity.points,
        assignee: memberById[assignedUserId],
        activity,
        completion,
        isCurrentPeriod: Boolean(completion),
        isMine,
        done: Boolean(completion?.completed),
        pending: isMine && completion && !completion.completed,
        toneClass: isFixed ? TASK_TONE_CLASSES[activity.fixedKey] : ACTIVITY_TONE_CLASS
      })
    }

    items.sort((a, b) => (a.kind === 'fixed' ? 0 : 1) - (b.kind === 'fixed' ? 0 : 1))
    return items
  }

  const title = useMemo(() => {
    if (view === 'month') return format(cursor, t('calendar.monthYearFormat'), { locale: dateLocale })
    if (view === 'week') {
      const start = startOfWeek(cursor, { weekStartsOn: 1 })
      const end = endOfWeek(cursor, { weekStartsOn: 1 })
      return `${format(start, 'd MMM', { locale: dateLocale })} – ${format(end, 'd MMM', { locale: dateLocale })}`
    }
    return format(cursor, t('calendar.dayTitleFormat'), { locale: dateLocale })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, cursor, dateLocale])

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => shift(-1)}
            aria-label={t('calendar.prevAria')}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-cream-200 dark:hover:bg-ink-700 active:scale-90 transition-transform"
          >
            ‹
          </button>
          <p className="font-display font-bold capitalize min-w-[9rem] sm:min-w-[11rem] text-center">{title}</p>
          <button
            type="button"
            onClick={() => shift(1)}
            aria-label={t('calendar.nextAria')}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-cream-200 dark:hover:bg-ink-700 active:scale-90 transition-transform"
          >
            ›
          </button>
          <button type="button" onClick={() => setCursor(new Date())} className="text-xs font-semibold text-violet-500 hover:underline ml-1">
            {t('calendar.today')}
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

      {view === 'month' && <MonthGrid cursor={cursor} dayInfo={dayInfo} t={t} dateLocale={dateLocale} />}
      {view === 'week' && <WeekStrip cursor={cursor} dayInfo={dayInfo} t={t} dateLocale={dateLocale} />}
      {view === 'day' && (
        <DayDetail
          cursor={cursor}
          dayInfo={dayInfo}
          setActivityProgress={setActivityProgress}
          memberById={memberById}
          potContributions={potContributions}
          shoppingPurchases={shoppingPurchases}
          shoppingItems={shoppingItems}
          notifications={notifications}
          t={t}
          dateLocale={dateLocale}
        />
      )}
    </div>
  )
}

function MonthGrid({ cursor, dayInfo, t, dateLocale }) {
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 })
  })
  // Iniciales de día de la semana localizadas (en vez de un array fijo
  // en español) — se toman de una semana cualquiera con el `dateLocale`
  // activo, mismo formato de una sola letra ('EEEEE') que ya usa WeekStrip.
  const weekdayLabels = useMemo(() => {
    const start = startOfWeek(new Date(), { weekStartsOn: 1 })
    return eachDayOfInterval({ start, end: addDays(start, 6) }).map((d) => format(d, 'EEEEE', { locale: dateLocale }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateLocale])

  return (
    <div>
      <div className="grid grid-cols-7 mb-1">
        {weekdayLabels.map((d, i) => (
          <p key={i} className="text-[10px] font-bold uppercase text-center text-ink-900/40 dark:text-cream-100/40">
            {d}
          </p>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((date) => {
          const items = dayInfo(date)
          const first = items[0]
          const Icon = first?.icon
          const inMonth = isSameMonth(date, cursor)
          return (
            <div
              key={date.toISOString()}
              className={`aspect-square rounded-lg p-1 flex flex-col items-center justify-center gap-0.5 ${
                isToday(date) ? 'bg-violet-50 dark:bg-violet-700/20 ring-2 ring-violet-500' : ''
              } ${!inMonth ? 'opacity-30' : ''}`}
            >
              <span className="text-[10px] font-semibold">{format(date, 'd')}</span>
              {first && (
                <div className="relative">
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center border ${
                      first.done
                        ? 'bg-gold-400 border-ink-900'
                        : first.pending
                          ? 'bg-coral-500 border-ink-900'
                          : `${first.toneClass} border-transparent`
                    }`}
                    title={`${first.label} · ${first.assignee?.name || t('calendar.unassigned')}${first.pending ? t('calendar.yourTurnParen') : ''}`}
                  >
                    {Icon && <Icon className={`w-3 h-3 ${first.done || first.pending ? 'text-white' : ''}`} />}
                  </div>
                  {items.length > 1 && (
                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-ink-900 dark:bg-cream-100 text-cream-100 dark:text-ink-900 text-[8px] font-bold flex items-center justify-center">
                      +{items.length - 1}
                    </span>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function WeekStrip({ cursor, dayInfo, t, dateLocale }) {
  const days = eachDayOfInterval({
    start: startOfWeek(cursor, { weekStartsOn: 1 }),
    end: endOfWeek(cursor, { weekStartsOn: 1 })
  })

  return (
    <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
      {days.map((date) => {
        const items = dayInfo(date)
        const first = items[0]
        const Icon = first?.icon
        return (
          <div
            key={date.toISOString()}
            className={`flex flex-col items-center gap-1.5 rounded-xl py-3 px-1 ${isToday(date) ? 'bg-violet-50 dark:bg-violet-700/20' : ''}`}
          >
            <span className="text-[10px] font-bold uppercase text-ink-900/40 dark:text-cream-100/40">{format(date, 'EEEEE', { locale: dateLocale })}</span>
            <span className="text-xs font-bold">{format(date, 'd')}</span>
            {first ? (
              <div className="relative mt-1">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center border-2 ${
                    first.done
                      ? 'bg-gold-400 border-ink-900'
                      : first.pending
                        ? 'bg-coral-500 border-ink-900 ring-2 ring-coral-500/40'
                        : `${first.toneClass} border-transparent`
                  }`}
                  title={`${first.label} · ${first.assignee?.name || t('calendar.unassigned')}${first.kind === 'fixed' && !first.isCurrentPeriod ? t('calendar.plannedParen') : ''}${first.pending ? t('calendar.yourTurnDash') : ''}`}
                >
                  {Icon && <Icon className={`w-4 h-4 ${first.done || first.pending ? 'text-white' : ''}`} />}
                </div>
                {items.length > 1 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-ink-900 dark:bg-cream-100 text-cream-100 dark:text-ink-900 text-[9px] font-bold flex items-center justify-center">
                    +{items.length - 1}
                  </span>
                )}
              </div>
            ) : (
              <div className="w-9 h-9 mt-1" />
            )}
            <span
              className={`text-[10px] text-center leading-tight ${
                first?.pending ? 'font-bold text-coral-600 dark:text-coral-400' : 'text-ink-900/50 dark:text-cream-100/50'
              }`}
            >
              {first?.pending ? t('calendar.yourTurn') : first?.assignee?.name?.split(' ')[0] || ''}
            </span>
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
function useDayEvents(cursor, memberById, potContributions, shoppingPurchases, shoppingItems, notifications, t) {
  return useMemo(() => {
    const events = []

    for (const c of potContributions) {
      if (!isSameDay(new Date(c.createdAt), cursor)) continue
      const isExpense = Number(c.amount) < 0
      const name = memberById[c.userId]?.name || t('calendar.someone')
      events.push({
        id: `pot-${c.id}`,
        time: c.createdAt,
        icon: JarIcon,
        tone: isExpense ? 'clay' : 'sage',
        title: t(isExpense ? 'calendar.spentFromPot' : 'calendar.contributedToPot', { name, amount: Math.abs(Number(c.amount)).toFixed(2) }),
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
        title: t('shopping.someoneBought', { name: memberById[p.userId]?.name || t('calendar.someone'), item: p.itemName }),
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
        title: t('calendar.addedToList', { name: memberById[item.createdBy]?.name || t('calendar.someone'), item: item.name }),
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor, memberById, potContributions, shoppingPurchases, shoppingItems, notifications, t])
}

function DayDetail({ cursor, dayInfo, setActivityProgress, memberById, potContributions, shoppingPurchases, shoppingItems, notifications, t }) {
  const items = dayInfo(cursor)
  const { showToast } = useToast()
  const events = useDayEvents(cursor, memberById, potContributions, shoppingPurchases, shoppingItems, notifications, t)

  function handleToggle(item) {
    const wasCompleted = item.completion.completed
    const delta = wasCompleted ? -1 : 1
    setActivityProgress(item.completion, delta)
    if (!wasCompleted) {
      const target = item.activity?.timesPerWeek || 1
      const timesDone = Math.min(target, Math.max(0, (item.completion.timesDone || 0) + delta))
      if (timesDone >= target) {
        showToast(t('taskCard.completedToast', { label: item.label, points: item.points }), 'success')
      }
    }
  }

  return (
    <div className="py-2">
      {items.length === 0 ? (
        <p className="text-sm text-center py-6 text-ink-900/50 dark:text-cream-100/50">{t('calendar.noTaskToday')}</p>
      ) : (
        items.map((item, i) => {
          const Icon = item.icon
          const toneClass = item.pending ? 'bg-coral-500 text-white' : item.toneClass
          const badgeBorderClass = item.pending ? 'border-coral-600' : 'border-ink-900/70 dark:border-cream-100/30'
          const isShopping = item.activity?.fixedKey === 'compras'
          return (
            <div
              key={item.key}
              className={`flex items-center gap-4 py-4 ${i < items.length - 1 ? 'border-b border-ink-900/10 dark:border-cream-100/15' : ''}`}
            >
              {isShopping ? (
                <Link
                  to="/compras"
                  className={`w-14 h-14 rounded-2xl border-2 ${badgeBorderClass} ${toneClass} flex items-center justify-center shrink-0 hover:opacity-80`}
                  title={t('calendar.goToShoppingList')}
                >
                  {Icon && <Icon className="w-7 h-7" />}
                </Link>
              ) : (
                <div className={`w-14 h-14 rounded-2xl border-2 ${badgeBorderClass} ${toneClass} flex items-center justify-center shrink-0`}>
                  {Icon && <Icon className="w-7 h-7" />}
                </div>
              )}
              <div className="flex-1 min-w-0">
                {isShopping ? (
                  <Link to="/compras" className="font-display font-semibold underline decoration-dotted underline-offset-2 hover:opacity-80">
                    {item.label}
                  </Link>
                ) : (
                  <p className="font-display font-semibold">{item.label}</p>
                )}
                <p className="text-sm text-ink-900/60 dark:text-cream-100/60">
                  {item.pending ? (
                    <span className="font-bold text-coral-600 dark:text-coral-400">{t('calendar.yourTurnBold')}</span>
                  ) : (
                    item.assignee?.name || t('calendar.unassigned')
                  )}
                  {item.points != null && (
                    <>
                      {' '}
                      · {t('taskCard.rewards', { points: item.points })}
                    </>
                  )}
                  {item.completion && (
                    <span className={item.completion.completed ? 'text-sage-500' : 'text-gold-500'}>
                      {' '}
                      · {item.completion.completed ? t('calendar.doneStatus') : t('calendar.pendingStatus')}
                    </span>
                  )}
                </p>
                {!item.isCurrentPeriod && (
                  <p className="text-xs text-ink-900/40 dark:text-cream-100/40 mt-0.5">{t('calendar.plannedHint')}</p>
                )}
              </div>
              {item.kind === 'fixed' && item.isCurrentPeriod && (
                <button
                  type="button"
                  onClick={() => handleToggle(item)}
                  className={item.completion.completed ? 'btn-secondary text-sm shrink-0' : 'btn-primary text-sm shrink-0'}
                >
                  {item.completion.completed ? t('calendar.undo') : t('calendar.markDone')}
                </button>
              )}
            </div>
          )
        })
      )}

      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-900/50 dark:text-cream-100/50 mb-2">{t('calendar.daySummary')}</p>
        {events.length === 0 ? (
          <p className="text-sm text-ink-900/50 dark:text-cream-100/50 py-2">{t('calendar.noActivityToday')}</p>
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
