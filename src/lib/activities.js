import { upsertIgnoreDuplicates } from './db'

/**
 * Gestor de actividades del piso: paralelo a rotation.js (que sigue
 * intacto para el sistema fijo de Compras/Basura/Lavadora), para
 * actividades propias con frecuencia flexible — semanal (N veces),
 * mensual, o evento único con fecha — y asignación manual o por
 * rotación automática sobre el mismo `rotationOrder` del piso.
 */

/** Clave estable de mes, ej: "2026-09" (mismo espíritu que getWeekKey de rotation.js). */
export function getMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

/** Índice monotónico de mes (para la rotación mensual), ej: 2026-09 → 2026*12+9 */
export function monthIndexFromKey(monthKey) {
  const [year, month] = monthKey.split('-').map(Number)
  return year * 12 + month
}

/** Período actual de una actividad, según su frecuencia. */
export function currentPeriodKey(activity, weekKey) {
  if (activity.frequencyType === 'weekly') return weekKey
  if (activity.frequencyType === 'monthly') return getMonthKey()
  return activity.specificDate // 'once'
}

/** Elige a quién le toca por rotación, dado un índice de período —
 * versión genérica de whoIsAssigned (esa tiene un "offset" específico
 * para escalonar las 3 tareas fijas dentro de la misma semana, que
 * las actividades propias no necesitan). */
export function rotationPick(rotationOrder, periodIndex) {
  if (!rotationOrder || rotationOrder.length === 0) return null
  return rotationOrder[periodIndex % rotationOrder.length]
}

/** ¿Quién le toca a esta actividad en este período? (manual: la
 * persona fija; rotation: según el rotationOrder del piso). Los
 * eventos únicos ('once') siempre son manuales — la rotación no
 * aplica cuando solo hay un turno. */
export function assigneeFor(activity, rotationOrder, weekKey) {
  if (activity.frequencyType === 'once' || activity.assignmentMode === 'manual') {
    return activity.assignedUserId || null
  }
  const period = currentPeriodKey(activity, weekKey)
  const index = activity.frequencyType === 'monthly' ? monthIndexFromKey(period) : weekIndexFromKey(period)
  return rotationPick(rotationOrder, index)
}

// Para 'weekly' el período YA es el weekKey — mismo cálculo de índice
// que weekIndexFromKey en rotation.js, repetido acá (una línea) para
// no crear una dependencia cruzada entre los dos módulos.
function weekIndexFromKey(weekKey) {
  const [year, week] = weekKey.split('-W').map(Number)
  return year * 53 + week
}

/**
 * Se asegura de que exista la fila de activity_completions del
 * período ACTUAL de cada actividad recurrente (weekly/monthly) — las
 * `once` no pasan por acá, su única fila se crea al crear la
 * actividad. Mismo patrón que ensureWeekTasks: upsert con "ignore
 * duplicates" sobre (activityId, periodKey), así es seguro aunque
 * dos pestañas lo disparen a la vez.
 */
export async function ensureActivityPeriods(activities, rotationOrder, weekKey) {
  const recurring = activities.filter((a) => a.frequencyType === 'weekly' || a.frequencyType === 'monthly')
  if (recurring.length === 0) return
  const rows = recurring.map((activity) => ({
    activityId: activity.id,
    floorId: activity.floorId,
    periodKey: currentPeriodKey(activity, weekKey),
    assignedUserId: assigneeFor(activity, rotationOrder, weekKey),
    timesDone: 0,
    completed: false
  }))
  await upsertIgnoreDuplicates('activity_completions', rows, ['activityId', 'periodKey'])
}
