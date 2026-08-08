import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export default function TaskCard({ task, typeInfo, assignee, currentUserId, onToggle }) {
  const isMine = task.assignedUserId === currentUserId

  return (
    <div className={`card p-4 flex flex-col gap-3 ${task.completed ? 'opacity-70' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{typeInfo?.icon}</span>
          <div>
            <p className="font-medium">{typeInfo?.label}</p>
            <p className="text-xs text-charcoal-900/50 dark:text-linen-100/50">+{typeInfo?.points} puntos</p>
          </div>
        </div>
        {isMine && !task.completed && (
          <span className="text-[10px] uppercase tracking-wide bg-mustard-100 text-mustard-500 px-2 py-1 rounded-full font-semibold">
            Tu turno
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-plum-100 text-plum-600 flex items-center justify-center text-xs font-semibold">
          {assignee?.name?.[0]?.toUpperCase() || '?'}
        </div>
        <span className="text-sm">{assignee ? assignee.name : 'Sin asignar'}</span>
        {task.reassigned && (
          <span className="text-[10px] text-charcoal-900/40 dark:text-linen-100/40">(reasignada)</span>
        )}
      </div>

      {task.completed ? (
        <p className="text-xs text-sage-500">
          ✓ Completada {task.completedAt && format(new Date(task.completedAt), "d MMM, HH:mm", { locale: es })}
        </p>
      ) : (
        <button className="btn-primary text-sm w-full" onClick={() => onToggle(task.id)}>
          Marcar como hecha
        </button>
      )}
      {task.completed && (
        <button
          onClick={() => onToggle(task.id, true)}
          className="text-xs text-charcoal-900/40 dark:text-linen-100/40 hover:underline self-start"
        >
          Deshacer
        </button>
      )}
    </div>
  )
}
