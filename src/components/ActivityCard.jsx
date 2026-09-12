import Avatar from './Avatar'
import { SparkleIcon, EditIcon, TrashIcon, PlusIcon, MinusIcon, CartIcon, WasherIcon } from './icons'
import { format, startOfWeek, addDays } from 'date-fns'

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
export default function ActivityCard({ activity, completion, memberById, onEdit, onDelete, onProgress, t, dateLocale }) {
  const assignedUserId = completion?.assignedUserId || activity.assignedUserId
  const assignee = memberById[assignedUserId]
  const isEveryone = activity.assignmentMode === 'manual' && !assignedUserId
  const target = activity.timesPerWeek || 1
  const timesDone = completion?.timesDone || 0
  const isDone = completion?.completed || false
  const isStepper = activity.frequencyType === 'recurring' && activity.recurrenceUnit === 'week' && target > 1
  const notThisPeriod = activity.frequencyType === 'recurring' && !completion
  const Icon = (activity.fixedKey && FIXED_ICONS[activity.fixedKey]) || SparkleIcon

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
          <div className="flex items-center gap-2">
            {isEveryone ? (
              <span className="text-sm font-medium truncate">{t('activities.everyone')}</span>
            ) : (
              <>
                <Avatar url={assignee?.avatarUrl} name={assignee?.name} size="w-7 h-7" textSize="text-xs" />
                <span className="text-sm font-medium truncate">{assignee ? assignee.name : t('activities.unassigned')}</span>
              </>
            )}
            {activity.assignmentMode === 'rotation' && activity.frequencyType !== 'once' && (
              <span className="text-[10px] text-ink-900/40 dark:text-cream-100/40 shrink-0">{t('activities.rotationTag')}</span>
            )}
          </div>

          {onProgress &&
            (isStepper ? (
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{t('activities.stepProgress', { done: timesDone, target })}</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onProgress(-1)}
                    disabled={timesDone <= 0}
                    className="w-7 h-7 rounded-lg border-2 border-ink-900/70 dark:border-cream-100/30 flex items-center justify-center disabled:opacity-40"
                  >
                    <MinusIcon className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onProgress(1)}
                    disabled={timesDone >= target}
                    className="w-7 h-7 rounded-lg border-2 border-ink-900/70 dark:border-cream-100/30 flex items-center justify-center disabled:opacity-40"
                  >
                    <PlusIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : isDone ? (
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-sage-500">{t('activities.completed')}</p>
                <button type="button" onClick={() => onProgress(-1)} className="text-xs text-ink-900/40 dark:text-cream-100/40 hover:underline">
                  {t('activities.undo')}
                </button>
              </div>
            ) : (
              <button type="button" className="btn-primary text-sm w-full" onClick={() => onProgress(1)}>
                {t('activities.markDone')}
              </button>
            ))}
        </>
      )}
    </div>
  )
}
