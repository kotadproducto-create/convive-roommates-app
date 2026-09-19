import { useMemo } from 'react'
import Avatar from './Avatar'
import { SparkleIcon, EditIcon, TrashIcon, CartIcon, WasherIcon } from './icons'
import { nextOccurrence, occurrenceSlots } from '../lib/activities'
import { useProgressConfirm } from './ProgressConfirm'
import { format, startOfWeek, addDays } from 'date-fns'

// "2026-09-17" → "jueves" (nombre del día en el idioma activo).
function dayName(dateKey, dateLocale) {
  return format(new Date(`${dateKey}T00:00:00`), 'EEEE', { locale: dateLocale })
}

// Ícono de las 3 fijas, por `fixedKey` — el resto de las actividades
// propias usan el genérico SparkleIcon.
export const FIXED_ICONS = { compras: CartIcon, basura: TrashIcon, lavadora: WasherIcon }

/** Descripción legible de la frecuencia de una actividad, para la
 * tarjeta y el listado de Actividades. Compartida para que Dashboard
 * y Activities.jsx muestren siempre el mismo texto. */
export function describeFrequency(activity, t, dateLocale) {
  if (activity.frequencyType === 'once') {
    return activity.specificDate
      ? t('activities.frequencyOnceDate', { date: format(new Date(`${activity.specificDate}T00:00:00`), t('calendar.dayMonthFormat'), { locale: dateLocale }) })
      : t('activities.frequencyOnce')
  }
  const interval = activity.recurrenceInterval || 1
  const parts = []
  if (activity.recurrenceUnit === 'month') {
    parts.push(interval > 1 ? t('activities.recurEveryNMonths', { n: interval }) : t('activities.recurEveryMonth'))
  } else if (activity.recurrenceUnit === 'day') {
    parts.push(interval > 1 ? t('activities.recurEveryNDays', { n: interval }) : t('activities.recurEveryDay'))
  } else {
    parts.push(interval > 1 ? t('activities.recurEveryNWeeks', { n: interval }) : t('activities.recurEveryWeek'))
    if (activity.weekdays?.length) {
      const start = startOfWeek(new Date(), { weekStartsOn: 1 })
      const labels = activity.weekdays
        .slice()
        .sort((a, b) => a - b)
        .map((d) => format(addDays(start, d), 'EEEEE', { locale: dateLocale }))
      parts.push(labels.join(' '))
    }
  }
  if (activity.untilDate) {
    parts.push(t('activities.untilLabel', { date: format(new Date(`${activity.untilDate}T00:00:00`), t('calendar.dayMonthFormat'), { locale: dateLocale }) }))
  }
  return parts.join(' · ')
}

/**
 * Tarjeta de una actividad (fija o propia): nombre, frecuencia,
 * responsable, y el control de progreso (stepper si tiene varias
 * veces por semana, si no un botón simple de marcar hecho/deshacer).
 * Usada en Actividades y en Inicio (Dashboard) para las 3 fijas.
 */
export default function ActivityCard({
  activity,
  completion,
  memberById,
  rotationOrder,
  floor,
  extras = 0,
  onEdit,
  onDelete,
  showProgress = false,
  onExtra,
  onUndoExtra,
  t,
  dateLocale
}) {
  const assignedUserId = completion?.assignedUserId || activity.assignedUserId
  const assignee = memberById[assignedUserId]
  const isEveryone = activity.assignmentMode === 'manual' && !assignedUserId
  const occ = occurrenceSlots(activity, completion)
  const target = occ.target
  const timesDone = completion?.timesDone || 0
  const isDone = completion?.completed || false
  const notThisPeriod = activity.frequencyType === 'recurring' && !completion
  const { ask: askProgress, dialog: progressDialog } = useProgressConfirm()
  const Icon = (activity.fixedKey && FIXED_ICONS[activity.fixedKey]) || SparkleIcon

  // Solo se calcula (y se muestra) una vez que la actividad ya quedó
  // marcada como hecha — es ahí donde tiene sentido preguntarse "¿y la
  // próxima vez?" en vez de mostrarlo siempre.
  const next = useMemo(
    () => (isDone ? nextOccurrence(activity, rotationOrder || [], new Date(), completion?.periodKey ?? null, floor) : null),
    [isDone, activity, rotationOrder, completion?.periodKey, floor]
  )
  const nextAssignee = next?.assignedUserId ? memberById[next.assignedUserId] : null

  return (
    <div className={`card p-4 flex flex-col gap-3 ${isDone || notThisPeriod ? 'opacity-70' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl border-2 border-ink-900/70 dark:border-cream-100/30 bg-violet-100 dark:bg-violet-700/25 text-violet-600 dark:text-violet-200 flex items-center justify-center shrink-0">
            <Icon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="font-display font-semibold truncate">{activity.title}</p>
            <p className="text-xs text-ink-900/50 dark:text-cream-100/50">{describeFrequency(activity, t, dateLocale)}</p>
          </div>
        </div>
        {(onEdit || onDelete) && (
          <div className="flex items-center gap-1 shrink-0">
            {onEdit && (
              <button
                type="button"
                onClick={onEdit}
                title={t('activities.edit')}
                className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-cream-200 dark:hover:bg-ink-700"
              >
                <EditIcon className="w-4 h-4" />
              </button>
            )}
            {onDelete && !activity.fixedKey && (
              <button
                type="button"
                onClick={onDelete}
                title={t('activities.delete')}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-clay-500 hover:bg-clay-100 dark:hover:bg-clay-500/15"
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {notThisPeriod ? (
        <p className="text-xs text-ink-900/40 dark:text-cream-100/40">{t('activities.notThisPeriod')}</p>
      ) : (
        <>
          <div className="flex items-center gap-2 min-w-0">
            {isEveryone ? (
              <span className="text-sm font-medium truncate min-w-0">{t('activities.everyone')}</span>
            ) : (
              <>
                <Avatar url={assignee?.avatarUrl} name={assignee?.name} size="w-7 h-7" textSize="text-xs" />
                <span className="text-sm font-medium truncate min-w-0">{assignee ? assignee.name : t('activities.unassigned')}</span>
              </>
            )}
            {activity.assignmentMode === 'rotation' && activity.frequencyType !== 'once' && (
              <span className="text-[10px] text-ink-900/40 dark:text-cream-100/40 shrink-0">{t('activities.rotationTag')}</span>
            )}
          </div>

          {showProgress && (
            <div className="flex flex-col gap-2">
              {/* Barra por ocasiones: un tramo por cada vez prevista. */}
              <div
                className="flex gap-1"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={target}
                aria-valuenow={Math.min(timesDone, target)}
              >
                {Array.from({ length: target }).map((_, i) => (
                  <span
                    key={i}
                    className={`h-2 flex-1 rounded-full ${i < timesDone ? 'bg-sage-500' : 'bg-ink-900/10 dark:bg-cream-100/15'}`}
                  />
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
                <p className={`text-xs min-w-0 ${isDone ? 'font-semibold text-sage-500' : 'text-ink-900/50 dark:text-cream-100/50'}`}>
                  {isDone
                    ? t('activities.completed')
                    : occ.gated && occ.nextDateKey
                      ? occ.canMark
                        ? t('activities.readyToMark')
                        : t('activities.nextTime', { day: dayName(occ.nextDateKey, dateLocale) })
                      : ''}
                </p>
                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                  {timesDone > 0 && (
                    <button type="button" onClick={() => askProgress(completion, -1)} className="text-[11px] text-ink-900/40 dark:text-cream-100/40 hover:underline">
                      {t('activities.undo')}
                    </button>
                  )}
                  {!isDone && (
                    <button
                      type="button"
                      className="btn-primary text-xs px-3 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                      disabled={!occ.canMark}
                      onClick={() => askProgress(completion, 1)}
                    >
                      {t('activities.markDone')}
                    </button>
                  )}
                  {onExtra && activity.frequencyType === 'recurring' && completion && (
                    <button type="button" className="btn-secondary text-xs px-2.5 py-1.5" onClick={onExtra} title={t('activities.extraHint')}>
                      {t('activities.extraButton')}
                    </button>
                  )}
                </div>
              </div>

              {extras > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-gold-100 dark:bg-gold-400/20 text-gold-500">
                    {t('activities.extraCount', { count: extras })}
                  </span>
                  {onUndoExtra && (
                    <button type="button" onClick={onUndoExtra} className="text-[11px] text-ink-900/40 dark:text-cream-100/40 hover:underline">
                      {t('activities.undoExtra')}
                    </button>
                  )}
                </div>
              )}
              {isDone && next && (
                <p className="text-xs text-ink-900/50 dark:text-cream-100/50">
                  {t('activities.nextTurn', {
                    name: nextAssignee ? nextAssignee.name : t('activities.everyone'),
                    date: format(next.date, t('calendar.dayMonthFormat'), { locale: dateLocale })
                  })}
                </p>
              )}
            </div>
          )}
        </>
      )}
      {progressDialog}
    </div>
  )
}
