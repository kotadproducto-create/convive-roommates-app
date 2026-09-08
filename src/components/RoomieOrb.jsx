import { useState } from 'react'
import Avatar from './Avatar'
import { getMemberColor, getOrbMotion } from '../lib/roomieColors'
import { TASK_LABEL } from '../lib/rotation'
import { useLanguage } from '../context/LanguageContext'
import { CloseIcon } from './icons'

/**
 * Círculo de "luces" de Inicio: un punto difuminado por roomie, cada
 * uno con su color (Perfil → Tu color) y un recorrido propio y estable
 * (ver lib/roomieColors.js) — inspirado en los 3 puntos del logo de la
 * app. Interactivo: quien tiene algo pendiente esta semana brilla un
 * poco más (estado del piso de un vistazo, sin tocar nada), y tocar un
 * punto — o su avatar en la fila de debajo — abre una tarjetita con su
 * progreso de la semana.
 */
export default function RoomieOrb({ members, tasks = [] }) {
  const { t } = useLanguage()
  const [selectedId, setSelectedId] = useState(null)

  if (!members || members.length === 0) return null

  function toggleSelected(id) {
    setSelectedId((current) => (current === id ? null : id))
  }

  const selectedMember = members.find((m) => m.id === selectedId) || null

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-52 h-52 sm:w-64 sm:h-64 rounded-full overflow-hidden border-2 border-ink-900/70 dark:border-cream-100/30 bg-gradient-to-br from-cream-200 to-cream-100 dark:from-ink-800 dark:to-ink-700">
        {members.map((member) => {
          const color = getMemberColor(member)
          const motion = getOrbMotion(member.id)
          const isPending = tasks.some((task) => task.assignedUserId === member.id && !task.completed)
          return (
            <button
              key={member.id}
              type="button"
              title={member.name}
              aria-label={member.name}
              onClick={() => toggleSelected(member.id)}
              className={`orb-dot ${isPending ? 'orb-dot--pending' : ''}`}
              style={{
                width: motion.size,
                height: motion.size,
                left: `${motion.left}%`,
                top: `${motion.top}%`,
                transform: 'translate(-50%, -50%)',
                background: color,
                filter: 'blur(9px)',
                opacity: 0.82,
                '--dx1': `${motion.dx1}px`,
                '--dy1': `${motion.dy1}px`,
                '--dx2': `${motion.dx2}px`,
                '--dy2': `${motion.dy2}px`,
                '--dx3': `${motion.dx3}px`,
                '--dy3': `${motion.dy3}px`,
                '--dur': `${motion.duration}s`,
                '--delay': `${motion.delay}s`
              }}
            />
          )
        })}
      </div>

      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1.5 mt-3 max-w-xs">
        {members.map((member) => (
          <button
            key={member.id}
            type="button"
            onClick={() => toggleSelected(member.id)}
            className="flex items-center gap-1.5"
          >
            <span className="rounded-full p-0.5 border-2 shrink-0" style={{ borderColor: getMemberColor(member) }}>
              <Avatar url={member.avatarUrl} name={member.name} size="w-5 h-5" textSize="text-[9px]" />
            </span>
            <span className="text-xs font-medium text-ink-900/70 dark:text-cream-100/70">{member.name?.split(' ')[0]}</span>
          </button>
        ))}
      </div>

      {selectedMember && (
        <RoomieCard
          key={selectedMember.id}
          member={selectedMember}
          tasks={tasks}
          t={t}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  )
}

function RoomieCard({ member, tasks, t, onClose }) {
  const memberTasks = tasks.filter((task) => task.assignedUserId === member.id)
  const doneCount = memberTasks.filter((task) => task.completed).length
  const pendingTasks = memberTasks.filter((task) => !task.completed)

  return (
    <div className="toast-pop mt-3 w-full max-w-xs card p-3.5 relative">
      <button
        type="button"
        onClick={onClose}
        aria-label={t('roomieOrb.close')}
        className="absolute top-2 right-2 w-6 h-6 rounded-lg flex items-center justify-center hover:bg-cream-200 dark:hover:bg-ink-700"
      >
        <CloseIcon className="w-3.5 h-3.5" />
      </button>

      <div className="flex items-center gap-2.5 mb-2 pr-6">
        <span className="rounded-full p-0.5 border-2 shrink-0" style={{ borderColor: getMemberColor(member) }}>
          <Avatar url={member.avatarUrl} name={member.name} size="w-9 h-9" textSize="text-sm" />
        </span>
        <p className="font-display font-bold text-sm truncate">{member.name}</p>
      </div>

      {memberTasks.length === 0 ? (
        <p className="text-xs text-ink-900/50 dark:text-cream-100/50">{t('roomieOrb.noTasks')}</p>
      ) : (
        <>
          <p className="text-xs font-semibold text-ink-900/60 dark:text-cream-100/60 mb-1.5">
            {t('roomieOrb.doneThisWeek', { done: doneCount, total: memberTasks.length })}
          </p>
          {pendingTasks.length > 0 ? (
            <ul className="flex flex-col gap-1 text-xs text-ink-900/70 dark:text-cream-100/70">
              {pendingTasks.map((task) => (
                <li key={task.id} className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-coral-500 shrink-0" />
                  {TASK_LABEL[task.type] || task.type}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs font-semibold text-sage-500">{t('roomieOrb.allDone')}</p>
          )}
        </>
      )}
    </div>
  )
}
