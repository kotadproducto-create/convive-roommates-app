import { useState } from 'react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { TASK_ICONS, CoinIcon } from './icons'
import { useToast } from '../context/ToastContext'

// Cada tipo de tarea, su propio bloque pastel — así el ojo distingue
// "compras" de "basura" de "lavadora" antes incluso de leer el texto.
export const TASK_TONE_CLASSES = {
  compras: 'bg-coral-100 dark:bg-coral-500/20 text-coral-500',
  basura: 'bg-gold-100 dark:bg-gold-400/20 text-gold-500',
  lavadora: 'bg-sky-100 dark:bg-sky-500/20 text-sky-500'
}

export default function TaskCard({ task, typeInfo, assignee, currentUserId, onToggle }) {
  const isMine = task.assignedUserId === currentUserId
  const TypeIcon = TASK_ICONS[typeInfo?.icon]
  const { showToast } = useToast()
  const [celebrate, setCelebrate] = useState(false)
  const isCompras = typeInfo?.key === 'compras'
  const toneClass = TASK_TONE_CLASSES[typeInfo?.key] || 'bg-violet-100 dark:bg-violet-700/25 text-violet-600 dark:text-violet-200'

  function handleComplete() {
    setCelebrate(true)
    setTimeout(() => setCelebrate(false), 500)
    showToast(`¡${typeInfo?.label} completada! +${typeInfo?.points} recompensas`, 'success')
    onToggle(task.id)
  }

  return (
    <div className={`card p-4 flex flex-col gap-3 ${task.completed ? 'opacity-70' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        {isCompras ? (
          <Link to="/compras" className="flex items-center gap-3 hover:opacity-80" title="Ir a la lista de compras">
            <div
              className={`w-10 h-10 rounded-xl border-2 border-ink-900/70 dark:border-cream-100/30 ${toneClass} flex items-center justify-center shrink-0 ${
                celebrate ? 'celebrate-pop' : ''
              }`}
            >
              {TypeIcon && <TypeIcon className="w-5 h-5" />}
            </div>
            <div>
              <p className="font-display font-semibold underline decoration-dotted underline-offset-2">{typeInfo?.label}</p>
              <p className="flex items-center gap-1 text-xs text-ink-900/50 dark:text-cream-100/50">
                <CoinIcon className="w-3.5 h-3.5" />+{typeInfo?.points} recompensas
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
              <p className="font-display font-semibold">{typeInfo?.label}</p>
              <p className="flex items-center gap-1 text-xs text-ink-900/50 dark:text-cream-100/50">
                <CoinIcon className="w-3.5 h-3.5" />+{typeInfo?.points} recompensas
              </p>
            </div>
          </div>
        )}
        {isMine && !task.completed && (
          <span className="text-[10px] uppercase tracking-wide bg-gold-100 dark:bg-gold-400/20 text-gold-500 border-2 border-ink-900/70 dark:border-cream-100/30 px-2 py-1 rounded-full font-bold">
            Tu turno
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-violet-100 dark:bg-violet-700/25 text-violet-600 dark:text-violet-200 flex items-center justify-center text-xs font-bold">
          {assignee?.name?.[0]?.toUpperCase() || '?'}
        </div>
        <span className="text-sm font-medium">{assignee ? assignee.name : 'Sin asignar'}</span>
        {task.reassigned && (
          <span className="text-[10px] text-ink-900/40 dark:text-cream-100/40">(reasignada)</span>
        )}
      </div>

      {task.completed ? (
        <p className="text-xs font-semibold text-sage-500">
          ✓ Completada {task.completedAt && format(new Date(task.completedAt), "d MMM, HH:mm", { locale: es })}
        </p>
      ) : (
        <button className="btn-primary text-sm w-full" onClick={handleComplete}>
          Marcar como hecha
        </button>
      )}
      {task.completed && (
        <button
          onClick={() => onToggle(task.id, true)}
          className="text-xs text-ink-900/40 dark:text-cream-100/40 hover:underline self-start"
        >
          Deshacer
        </button>
      )}
    </div>
  )
}
