import Avatar from './Avatar'
import { getMemberColor, getOrbMotion } from '../lib/roomieColors'

/**
 * Círculo de "luces" de Inicio: un punto difuminado por roomie, cada
 * uno con su color (Perfil → Tu color) y un recorrido propio y estable
 * (ver lib/roomieColors.js) — inspirado en los 3 puntos del logo de la
 * app. Debajo, una fila de avatares con un anillo del mismo color de
 * cada persona, para que el efecto quede anclado a gente real y no
 * solo sea decorativo.
 */
export default function RoomieOrb({ members }) {
  if (!members || members.length === 0) return null

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-40 h-40 sm:w-52 sm:h-52 rounded-full overflow-hidden border-2 border-ink-900/70 dark:border-cream-100/30 bg-gradient-to-br from-cream-200 to-cream-100 dark:from-ink-800 dark:to-ink-700">
        {members.map((member) => {
          const color = getMemberColor(member)
          const motion = getOrbMotion(member.id)
          return (
            <span
              key={member.id}
              title={member.name}
              className="orb-dot"
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
          <span key={member.id} className="flex items-center gap-1.5">
            <span className="rounded-full p-0.5 border-2 shrink-0" style={{ borderColor: getMemberColor(member) }}>
              <Avatar url={member.avatarUrl} name={member.name} size="w-5 h-5" textSize="text-[9px]" />
            </span>
            <span className="text-xs font-medium text-ink-900/70 dark:text-cream-100/70">{member.name?.split(' ')[0]}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
