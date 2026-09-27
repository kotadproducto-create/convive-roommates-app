import MarqueeText from './MarqueeText'
import { useEffect, useMemo, useRef, useState } from 'react'
import Avatar from './Avatar'
import { getMemberColor, createOrbWalker, stepOrbWalker } from '../lib/roomieColors'
import { useLanguage } from '../context/LanguageContext'
import { CloseIcon } from './icons'

/**
 * Círculo de "luces" de Inicio: un punto difuminado por roomie, cada
 * uno con su color (Perfil → Tu color) y su propio paseo continuo (ver
 * lib/roomieColors.js) — inspirado en los 3 puntos del logo de la app.
 * Interactivo: quien tiene algo pendiente esta semana brilla un poco más
 * (estado del piso de un vistazo, sin tocar nada), y tocar un punto — o
 * su avatar en la fila de debajo — abre una tarjetita con su progreso de
 * la semana. `tasks` acá es el progreso de las 3 fijas del período
 * actual, ya resuelto por Timeline.jsx (title/assignedUserId/completed)
 * — no la tabla vieja `tasks`.
 *
 * El paseo se anima con requestAnimationFrame en vez de CSS @keyframes:
 * el efecto de abajo escribe el `transform` de cada punto directo en el
 * DOM (por ref, sin pasar por el estado de React) para que sea fluido
 * cuadro a cuadro y nunca en bucle (ver stepOrbWalker en lib/roomieColors.js).
 * Respeta "reducir movimiento": ahí cada punto se queda quieto en su
 * posición de casa.
 */
export default function RoomieOrb({ members, tasks = [] }) {
  const { t } = useLanguage()
  const [selectedId, setSelectedId] = useState(null)
  const dotRefs = useRef(new Map())
  // Clave estable (no la referencia de `members`, que puede recrearse en
  // cada render sin que cambie quién está en el piso) — así el paseo de
  // cada quien sigue exactamente donde iba en vez de reiniciarse solo.
  const membersKey = useMemo(() => members.map((m) => m.id).join(','), [members])
  // Tamaño y posición de "casa" de cada punto (arranque, y a donde vuelve
  // solo el paseo) — separado del propio walker en movimiento para no
  // recalcularlo en cada render (solo cambia si cambia quién está en el
  // piso), aunque ambos parten exactamente de la misma semilla.
  const appearanceById = useMemo(() => {
    const map = new Map()
    members.forEach((m, index) => map.set(m.id, createOrbWalker(m.id, index, members.length)))
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [membersKey])
  const walkersRef = useRef(new Map())

  useEffect(() => {
    walkersRef.current = new Map(appearanceById)
    const paint = () => {
      for (const [id, walker] of walkersRef.current) {
        const el = dotRefs.current.get(id)
        if (el) el.style.transform = `translate(-50%, -50%) translate(${walker.x}px, ${walker.y}px)`
      }
    }
    paint()

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined

    let frameId
    let last = performance.now()
    function tick(now) {
      // Tope de 100ms: si la pestaña estuvo en segundo plano un rato, al
      // volver no debe intentar "recuperar" todo ese tiempo de una sola
      // vez (se vería como un salto largo) — sigue desde donde estaba,
      // como si nada.
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      for (const [id, walker] of walkersRef.current) {
        walkersRef.current.set(id, stepOrbWalker(walker, dt))
      }
      paint()
      frameId = requestAnimationFrame(tick)
    }
    frameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameId)
  }, [appearanceById])

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
          const { size, left, top } = appearanceById.get(member.id)
          const isPending = tasks.some((task) => task.assignedUserId === member.id && !task.completed)
          return (
            <button
              key={member.id}
              ref={(el) => {
                if (el) dotRefs.current.set(member.id, el)
                else dotRefs.current.delete(member.id)
              }}
              type="button"
              title={member.name}
              aria-label={member.name}
              onClick={() => toggleSelected(member.id)}
              className={`orb-dot ${isPending ? 'orb-dot--pending' : ''}`}
              style={{
                width: size,
                height: size,
                left: `${left}%`,
                top: `${top}%`,
                transform: 'translate(-50%, -50%)',
                background: color,
                filter: 'blur(9px)',
                opacity: 0.82
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
        <MarqueeText as="p" className="font-display font-bold text-sm">{member.name}</MarqueeText>
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
                  {task.title}
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
