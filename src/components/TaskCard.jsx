import { useState } from 'react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { TASK_ICONS, CoinIcon, FlameIcon, EditIcon } from './icons'
import { useToast } from '../context/ToastContext'
import { useLanguage } from '../context/LanguageContext'
import { getMemberColor } from '../lib/roomieColors'
import Avatar from './Avatar'

// Cada tipo de tarea, su propio bloque pastel — así el ojo distingue
// "compras" de "basura" de "lavadora" antes incluso de leer el texto.
export const TASK_TONE_CLASSES = {
  compras: 'bg-coral-100 dark:bg-coral-500/20 text-coral-500',
  basura: 'bg-gold-100 dark:bg-gold-400/20 text-gold-500',
  lavadora: 'bg-sky-100 dark:bg-sky-500/20 text-sky-500'
}

// `overrideLabel`/`overridePoints`: nombre y puntos personalizados por
// piso para esta tarea fija (floors.fixed_task_overrides, editable
// desde Actividades — ver fixedTaskOverride en lib/rotation.js). Si no
// vienen, se usa el texto/valor por defecto de siempre. `onEdit` es
// opcional: solo Actividades lo pasa (Inicio/Calendario no muestran el
// botón de editar).
export default function TaskCard({ task, typeInfo, overrideLabel, overridePoints, assignee, currentUserId, onToggle, onEdit }) {
  const isMine = task.assignedUserId === currentUserId
  const TypeIcon = TASK_ICONS[typeInfo?.icon]
  const { showToast } = useToast()
  const { t, dateLocale } = useLanguage()
  const [celebrate, setCelebrate] = useState(false)
  const isCompras = typeInfo?.key === 'compras'
  const toneClass = TASK_TONE_CLASSES[typeInfo?.key] || 'bg-violet-100 dark:bg-violet-700/25 text-violet-600 dark:text-violet-200'
  const typeLabel = overrideLabel || (typeInfo ? t(`taskTypes.${typeInfo.key}`) : '')
  const points = overridePoints ?? typeInfo?.points

  function handleComplete() {
    setCelebrate(true)
    setTimeout(() => setCelebrate(false), 500)
    showToast(t('taskCard.completedToast', { label: typeLabel, points }), 'success')
    onToggle(task.id)
  }

  return (
    <div className={`card p-4 flex flex-col gap-3 ${task.completed ? 'opacity-70' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        {isCompras ? (
          <Link to="/compras" className="flex items-center gap-3 hover:opacity-80" title={t('taskCard.goToShopping')}>
            <div
              className={`w-10 h-10 rounded-xl border-2 border-ink-900/70 dark:border-cream-100/30 ${toneClass} flex items-center justify-center shrink-0 ${
                celebrate ? 'celebrate-pop' : ''
              }`}
            >
              {TypeIcon && <TypeIcon className="w-5 h-5" />}
            </div>
            <div>
              <p className="font-display font-semibold underline decoration-dotted underline-offset-2">{typeLabel}</p>
              <p className="flex items-center gap-1 text-xs text-ink-900/50 dark:text-cream-100/50">
                <CoinIcon className="w-3.5 h-3.5" />{t('taskCard.rewards', { points })}
              </p>
            </div>
          </Link>
        ) : (
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl border-2 border-ink-900/70 dark:border-cream-100/30 ${toneClass} flex items-center justify-center shrink-0 ${
                celebrate ? 'celebrate-pop' : ''
              }`}
            >
              {TypeIcon && <TypeIcon className="w-5 h-5" />}
            </div>
            <div>
              <p className="font-display font-semibold">{typeLabel}</p>
              <p className="flex items-center gap-1 text-xs text-ink-900/50 dark:text-cream-100/50">
                <CoinIcon className="w-3.5 h-3.5" />{t('taskCard.rewards', { points })}
              </p>
            </div>
          </div>
        )}
        <div className="flex items-center gap-1 shrink-0">
          {isMine && !task.completed && (
            <span
              className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-white border-2 border-ink-900 px-2.5 py-1 rounded-full font-extrabold shadow-[0_2px_0_0_theme(colors.ink.900)] animate-pulse shrink-0"
              style={{ backgroundColor: getMemberColor(assignee) }}
            >
              <FlameIcon className="w-3 h-3 shrink-0" />
              {t('taskCard.yourTurn')}
            </span>
          )}
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
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Avatar url={assignee?.avatarUrl} name={assignee?.name} size="w-7 h-7" textSize="text-xs" />
        <span className="text-sm font-medium">{assignee ? assignee.name : t('taskCard.unassigned')}</span>
        {task.reassigned && (
          <span className="text-[10px] text-ink-900/40 dark:text-cream-100/40">{t('taskCard.reassigned')}</span>
        )}
      </div>

      {task.completed ? (
        <p className="text-xs font-semibold text-sage-500">
          {t('taskCard.completed', {
            date: task.completedAt ? format(new Date(task.completedAt), 'd MMM, HH:mm', { locale: dateLocale }) : ''
          })}
        </p>
      ) : (
        <button className="btn-primary text-sm w-full" onClick={handleComplete}>
          {t('taskCard.markDone')}
        </button>
      )}
      {task.completed && (
        <button
          onClick={() => onToggle(task.id, true)}
          className="text-xs text-ink-900/40 dark:text-cream-100/40 hover:underline self-start"
        >
          {t('taskCard.undo')}
        </button>
      )}
    </div>
  )
}
