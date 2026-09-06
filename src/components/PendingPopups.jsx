import { useMemo, useState } from 'react'
import { TASK_TYPES } from '../lib/rotation'
import { CartIcon, SparkleIcon, CloseIcon } from './icons'

const TASK_LABEL = Object.fromEntries(TASK_TYPES.map((t) => [t.key, t.label]))

function todayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

/** Cada categoría (compras/actividades) recuerda su propio cierre del
 * día — así, cerrar el aviso de una no oculta el de otra que aparezca
 * más tarde el mismo día (ej. se agota un producto después de que ya
 * viste el de actividades). */
function isDismissedToday(key) {
  try {
    return localStorage.getItem(key) === todayKey()
  } catch {
    return false
  }
}
function markDismissedToday(key) {
  try {
    localStorage.setItem(key, todayKey())
  } catch {}
}

const TONE_BADGE = {
  coral: 'bg-coral-500',
  sky: 'bg-sky-500'
}

/**
 * Avisos al abrir Inicio de lo que le toca a ESTA persona esta semana:
 * uno por Compras (si es la persona asignada y faltan artículos) y otro
 * por Actividades/Higiene (basura+lavadora asignadas y sin completar).
 * Se muestran uno a la vez y como máximo una vez por día (localStorage),
 * para no repetirse cada vez que se abre la app en el mismo día.
 */
export default function PendingPopups({ user, floor, tasks, shoppingItems }) {
  // Solo para forzar un re-render tras cerrar un aviso (escribir en
  // localStorage no dispara uno solo). El propio localStorage sigue
  // siendo la única fuente de verdad — se relee en cada render, así que
  // no hay riesgo de quedarse con un estado viejo mientras tasks/
  // shoppingItems todavía están cargando.
  const [, bump] = useState(0)

  const keyFor = (category) => (user && floor ? `convive_popup_${floor.id}_${user.id}_${category}` : null)

  const candidates = useMemo(() => {
    if (!user) return []
    const list = []

    const comprasTask = tasks.find((t) => t.type === 'compras')
    if (comprasTask?.assignedUserId === user.id) {
      const missing = shoppingItems.filter((i) => i.stockLevel === 'out')
      if (missing.length > 0) {
        list.push({
          key: 'compras',
          icon: CartIcon,
          tone: 'coral',
          title: 'Tienes que comprar estos artículos',
          items: missing.map((i) => i.name)
        })
      }
    }

    const pendingActivities = tasks.filter(
      (t) => (t.type === 'basura' || t.type === 'lavadora') && t.assignedUserId === user.id && !t.completed
    )
    if (pendingActivities.length > 0) {
      list.push({
        key: 'actividades',
        icon: SparkleIcon,
        tone: 'sky',
        title: 'Debes realizar estas actividades',
        bigNumber: pendingActivities.length,
        items: pendingActivities.map((t) => TASK_LABEL[t.type] || t.type)
      })
    }

    return list
  }, [user, tasks, shoppingItems])

  // Cerrar una categoría la saca de `popups` (queda marcada en
  // localStorage), y la siguiente pendiente pasa a ser la primera
  // automáticamente — no hace falta llevar un índice aparte.
  const popups = candidates.filter((c) => !isDismissedToday(keyFor(c.key)))

  if (popups.length === 0) return null

  const current = popups[0]
  const Icon = current.icon

  function handleClose() {
    markDismissedToday(keyFor(current.key))
    bump((n) => n + 1)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink-900/40 backdrop-blur-sm p-4"
      onClick={handleClose}
    >
      <div
        className="w-full sm:max-w-sm bg-white dark:bg-ink-800 border-2 border-ink-900 dark:border-cream-100/40 rounded-2xl p-5 relative toast-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={handleClose}
          aria-label="Cerrar"
          className="absolute top-3 right-3 w-8 h-8 rounded-lg flex items-center justify-center hover:bg-cream-200 dark:hover:bg-ink-700"
        >
          <CloseIcon className="w-4 h-4" />
        </button>

        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 ${TONE_BADGE[current.tone]}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>

        <h3 className="font-display text-lg font-bold tracking-tight pr-6">{current.title}</h3>

        {current.bigNumber != null && (
          <p className="font-display text-4xl font-extrabold mt-1 mb-2">{current.bigNumber}</p>
        )}

        <ul className="flex flex-col gap-1.5 text-sm text-ink-900/70 dark:text-cream-100/70 mt-2 mb-5">
          {current.items.map((item, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-ink-900/30 dark:bg-cream-100/30 shrink-0" />
              {item}
            </li>
          ))}
        </ul>

        <button type="button" onClick={handleClose} className="btn-primary w-full">
          Entendido
        </button>

        {popups.length > 1 && (
          <p className="text-center text-xs text-ink-900/40 dark:text-cream-100/40 mt-2">
            Queda{popups.length > 2 ? 'n' : ''} {popups.length - 1} más
          </p>
        )}
      </div>
    </div>
  )
}
