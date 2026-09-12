import { upsertIgnoreDuplicates } from './db'

/**
 * Gestor de actividades del piso: paralelo a rotation.js (que sigue
 * intacto para el sistema fijo de Compras/Basura/Lavadora), para
 * actividades propias — recurrentes (cada N semanas o meses, con días
 * de la semana elegibles si es semanal) o de una sola vez con fecha —
 * y asignación manual o por rotación automática sobre el mismo
 * `rotationOrder` del piso.
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

// Para 'week' el período YA es el weekKey — mismo cálculo de índice
// que weekIndexFromKey en rotation.js, repetido acá (una línea) para
// no crear una dependencia cruzada entre los dos módulos.
function weekIndexFromKey(weekKey) {
  const [year, week] = weekKey.split('-W').map(Number)
  return year * 53 + week
}

/** Día de la semana (0=lunes..6=domingo) de una fecha JS normal. */
function isoWeekday(date) {
  return (date.getDay() + 6) % 7
}

function toDateOnly(dateLike) {
  return dateLike instanceof Date ? dateLike : new Date(`${dateLike}T00:00:00`)
}

/**
 * ¿Esta semana/mes es una "ocurrencia" de una actividad recurrente,
 * según su intervalo (cada N semanas/meses) contado desde start_date?
 * Con intervalo 1 (el caso más común, equivalente a lo que antes eran
 * 'weekly'/'monthly') siempre es true.
 */
function isOccurrencePeriod(activity, periodKey) {
  const interval = activity.recurrenceInterval || 1
  if (activity.recurrenceUnit === 'month') {
    const startMonth = getMonthKey(toDateOnly(activity.startDate))
    return (monthIndexFromKey(periodKey) - monthIndexFromKey(startMonth)) % interval === 0
  }
  // 'week' (o sin especificar, por compatibilidad con datos viejos)
  const start = toDateOnly(activity.startDate)
  const startWeekKey = getWeekKeyOf(start)
  return (weekIndexFromKey(periodKey) - weekIndexFromKey(startWeekKey)) % interval === 0
}

// Mismo cálculo de clave de semana ISO que getWeekKey en rotation.js —
// repetido acá para no crear una dependencia cruzada entre módulos.
function getWeekKeyOf(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

/** ¿Ya pasó la fecha límite (`until_date`) de una actividad recurrente,
 * para el período dado? */
function isPastUntil(activity, periodKey) {
  if (!activity.untilDate) return false
  const until = toDateOnly(activity.untilDate)
  if (activity.recurrenceUnit === 'month') return monthIndexFromKey(periodKey) > monthIndexFromKey(getMonthKey(until))
  return weekIndexFromKey(periodKey) > weekIndexFromKey(getWeekKeyOf(until))
}

/** Período actual de una actividad, según su frecuencia — null si es
 * recurrente pero esta semana/mes no le toca ocurrencia, o si ya pasó
 * su fecha límite. */
export function currentPeriodKey(activity, weekKey) {
  if (activity.frequencyType !== 'recurring') return activity.specificDate // 'once'
  const period = activity.recurrenceUnit === 'month' ? getMonthKey() : weekKey
  if (isPastUntil(activity, period)) return null
  return isOccurrencePeriod(activity, period) ? period : null
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
  if (!period) return null
  const index = activity.recurrenceUnit === 'month' ? monthIndexFromKey(period) : weekIndexFromKey(period)
  return rotationPick(rotationOrder, index)
}

/**
 * ¿Esta actividad "cae" en esta fecha concreta? Para el Calendario:
 * las de una sola vez, en su specific_date; las recurrentes, en la
 * semana/mes de ocurrencia Y (si es semanal) en uno de sus weekdays
 * elegidos — sin un día elegido, no tiene lugar propio en el
 * Calendario (sigue viéndose igual en Actividades).
 */
export function isDueOnDate(activity, date) {
  if (activity.frequencyType === 'once') {
    return activity.specificDate === `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  }
  const weekKey = getWeekKeyOf(date)
  const period = activity.recurrenceUnit === 'month' ? getMonthKey(date) : weekKey
  if (isPastUntil(activity, period)) return false
  if (!isOccurrencePeriod(activity, period)) return false
  if (activity.recurrenceUnit === 'month') {
    const startDay = toDateOnly(activity.startDate).getDate()
    return date.getDate() === startDay
  }
  return (activity.weekdays || []).includes(isoWeekday(date))
}

/**
 * Se asegura de que exista la fila de activity_completions del
 * período ACTUAL de cada actividad recurrente (si esta semana/mes le
 * toca ocurrencia) — las `once` no pasan por acá, su única fila se
 * crea al crear la actividad. Mismo patrón que ensureWeekTasks: upsert
 * con "ignore duplicates" sobre (activityId, periodKey), así es seguro
 * aunque el efecto que llama a esto se dispare dos veces a la vez
 * (p.ej. React.StrictMode en desarrollo, o dos pestañas del mismo piso
 * reaccionando a la vez a un cambio en vivo).
 */
export async function ensureActivityPeriods(activities, rotationOrder, weekKey) {
  const recurring = activities.filter((a) => a.frequencyType === 'recurring')
  if (recurring.length === 0) return
  const rows = recurring
    .map((activity) => {
      const periodKey = currentPeriodKey(activity, weekKey)
      if (!periodKey) return null
      return {
        activityId: activity.id,
        floorId: activity.floorId,
        periodKey,
        assignedUserId: assigneeFor(activity, rotationOrder, weekKey),
        timesDone: 0,
        completed: false
      }
    })
    .filter(Boolean)
  if (rows.length === 0) return
  await upsertIgnoreDuplicates('activity_completions', rows, ['activityId', 'periodKey'])
}
