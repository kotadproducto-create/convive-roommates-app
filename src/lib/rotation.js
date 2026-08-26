import { getAll, update, upsertIgnoreDuplicates } from './db'

/**
 * Las 3 tareas fijas del piso. El "offset" determina que, dentro de la
 * misma semana, cada tarea recaiga sobre una persona distinta de la
 * rotación (si offset fuese igual para las 3, siempre le tocarían las
 * 3 tareas a la misma persona la misma semana).
 */
export const TASK_TYPES = [
  { key: 'compras', label: 'Compras del piso', offset: 0, icon: 'cart', points: 15 },
  { key: 'basura', label: 'Sacar la basura', offset: 1, icon: 'trash', points: 5 },
  { key: 'lavadora', label: 'Lavadora (lencería de baño)', offset: 2, icon: 'washer', points: 10 }
]

/**
 * Día de la semana (0=lunes..6=domingo) en el que se muestra cada tipo de
 * tarea en las vistas de calendario. Es solo de presentación — la
 * asignación real sigue siendo semanal, vía whoIsAssigned/rotationOrder.
 */
export const TASK_DAY_OFFSET = { compras: 0, basura: 2, lavadora: 4 }

/** Devuelve una clave estable de semana ISO, ej: "2026-W32" */
export function getWeekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

/** Índice monotónico de semana (para calcular el turno por rotación) */
function weekIndexFromKey(weekKey) {
  const [year, week] = weekKey.split('-W').map(Number)
  return year * 53 + week
}

export function getMondayOfWeek(weekKey) {
  const [year, week] = weekKey.split('-W').map(Number)
  const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7))
  const dow = simple.getUTCDay()
  const monday = new Date(simple)
  if (dow <= 4) monday.setUTCDate(simple.getUTCDate() - dow + 1)
  else monday.setUTCDate(simple.getUTCDate() + 8 - dow)
  return monday
}

/** ¿A quién le toca este tipo de tarea, en esta semana, según el orden de rotación? */
export function whoIsAssigned(rotationOrder, weekKey, taskOffset) {
  if (!rotationOrder || rotationOrder.length === 0) return null
  const idx = (weekIndexFromKey(weekKey) + taskOffset) % rotationOrder.length
  return rotationOrder[idx]
}

/**
 * Se asegura de que existan las 3 tareas de la semana para un piso.
 * Si ya existen, no hace nada (idempotente). Si el piso cambia su
 * rotationOrder DESPUÉS de haber generado la semana, esa semana ya
 * generada no se re-escribe automáticamente (evita "mover" tareas que
 * la gente ya está gestionando); los cambios de orden aplican desde
 * la semana en la que se guardan en adelante.
 *
 * Usa upsert con "ignore duplicates" (constraint UNIQUE en BD sobre
 * floor_id+week_key+type) en vez de "leer lo que existe y crear lo que
 * falta": así es seguro aunque el efecto que llama a esto se dispare
 * dos veces a la vez (p.ej. React.StrictMode en desarrollo, o dos
 * pestañas del mismo piso reaccionando a la vez a un cambio en vivo).
 */
export async function ensureWeekTasks(floorId, weekKey, rotationOrder) {
  const rows = TASK_TYPES.map((type) => ({
    floorId,
    weekKey,
    type: type.key,
    assignedUserId: whoIsAssigned(rotationOrder, weekKey, type.offset),
    completed: false,
    completedAt: null
  }))
  await upsertIgnoreDuplicates('tasks', rows, ['floorId', 'weekKey', 'type'])
}

/**
 * Devuelve un nuevo orden de rotación con `partnerId` colocado justo
 * después de `anchorId`. Se usa cuando dos personas confirman que
 * comparten habitación: como cada tarea avanza una posición del
 * `rotationOrder` por semana (ver `whoIsAssigned`), dejarlas contiguas
 * hace que a la pareja le toque la semana inmediatamente siguiente a
 * la del otro. Si alguno de los dos todavía no está en el orden (caso
 * raro), se agrega antes de emparejar. Preserva el orden relativo del
 * resto de miembros.
 */
export function placeAdjacentInRotation(order, anchorId, partnerId) {
  if (!anchorId || !partnerId || anchorId === partnerId) return order || []
  const base = (order || []).includes(anchorId) ? [...order] : [...(order || []), anchorId]
  const withoutPartner = base.filter((id) => id !== partnerId)
  const anchorIdx = withoutPartner.indexOf(anchorId)
  const newOrder = [...withoutPartner]
  newOrder.splice(anchorIdx + 1, 0, partnerId)
  return newOrder
}

/**
 * Reasigna las tareas PENDIENTES de un usuario eliminado al siguiente
 * miembro disponible en la rotación (según el nuevo rotationOrder, ya
 * sin el usuario eliminado).
 */
export async function reassignPendingTasks(floorId, removedUserId, newRotationOrder) {
  const pending = (await getAll('tasks', { floorId })).filter(
    (t) => t.assignedUserId === removedUserId && !t.completed
  )
  for (const task of pending) {
    const taskType = TASK_TYPES.find((tt) => tt.key === task.type)
    const nextUser = whoIsAssigned(newRotationOrder, task.weekKey, taskType?.offset || 0)
    await update('tasks', task.id, { assignedUserId: nextUser, reassigned: true })
  }
}
