import { upsertIgnoreDuplicates } from './db'

/**
 * Gestor de actividades del piso — incluye tanto las actividades
 * propias como las 3 "fijas" (Compras/Basura/Lavadora, identificadas
 * por `fixedKey`, ver rotation.js para lo poco que queda de aquel
 * motor viejo, ya solo histórico). Recurrentes (cada N días/semanas/
 * meses, con días de la semana elegibles si es semanal) o de una sola
 * vez con fecha — asignación manual (incluye "Todos", assignedUserId
 * null) o por rotación automática sobre el mismo `rotationOrder` del
 * piso.
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

/** Clave estable de día, ej: "2026-09-13" — el período de una actividad diaria. */
export function getDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** Índice monotónico de día (días desde el epoch), para el intervalo de las diarias. */
function dayIndexFromKey(dateKey) {
  return Math.floor(new Date(`${dateKey}T00:00:00Z`).getTime() / 86400000)
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

// Mismo cálculo que getMondayOfWeek en rotation.js — repetido acá (una
// línea) para no crear una dependencia cruzada entre módulos.
function mondayOfWeekKey(weekKey) {
  const [year, week] = weekKey.split('-W').map(Number)
  const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7))
  const dow = simple.getUTCDay()
  const monday = new Date(simple)
  if (dow <= 4) monday.setUTCDate(simple.getUTCDate() - dow + 1)
  else monday.setUTCDate(simple.getUTCDate() + 8 - dow)
  return monday
}

// Mismo cálculo de clave de semana ISO que getWeekKey en rotation.js —
// repetido acá para no crear una dependencia cruzada entre módulos.
export function getWeekKeyOf(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

/**
 * ¿Este día/semana/mes es una "ocurrencia" de una actividad
 * recurrente, según su intervalo (cada N días/semanas/meses) contado
 * desde start_date? Con intervalo 1 (el caso más común) siempre es
 * true.
 */
function isOccurrencePeriod(activity, periodKey) {
  const interval = activity.recurrenceInterval || 1
  const start = toDateOnly(activity.startDate)
  if (activity.recurrenceUnit === 'month') {
    const startMonth = getMonthKey(start)
    return (monthIndexFromKey(periodKey) - monthIndexFromKey(startMonth)) % interval === 0
  }
  if (activity.recurrenceUnit === 'day') {
    return (dayIndexFromKey(periodKey) - dayIndexFromKey(getDateKey(start))) % interval === 0
  }
  // 'week' (o sin especificar, por compatibilidad con datos viejos)
  const startWeekKey = getWeekKeyOf(start)
  return (weekIndexFromKey(periodKey) - weekIndexFromKey(startWeekKey)) % interval === 0
}

/** ¿Ya pasó la fecha límite (`until_date`) de una actividad recurrente,
 * para el período dado? */
function isPastUntil(activity, periodKey) {
  if (!activity.untilDate) return false
  const until = toDateOnly(activity.untilDate)
  if (activity.recurrenceUnit === 'month') return monthIndexFromKey(periodKey) > monthIndexFromKey(getMonthKey(until))
  if (activity.recurrenceUnit === 'day') return dayIndexFromKey(periodKey) > dayIndexFromKey(getDateKey(until))
  return weekIndexFromKey(periodKey) > weekIndexFromKey(getWeekKeyOf(until))
}

/** Período actual de una actividad, según su frecuencia — null si es
 * recurrente pero este día/semana/mes no le toca ocurrencia, o si ya
 * pasó su fecha límite. */
export function currentPeriodKey(activity, weekKey) {
  if (activity.frequencyType !== 'recurring') return activity.specificDate // 'once'
  const period = activity.recurrenceUnit === 'month' ? getMonthKey() : activity.recurrenceUnit === 'day' ? getDateKey() : weekKey
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

/**
 * Índice de turno "global" del piso, para el modo de rotación
 * `Determinado` (`floor.rotationMode === 'period'`): en vez de que cada
 * actividad avance el turno según SU PROPIA frecuencia (semanal/
 * mensual/diaria), todas comparten un único reloj — cada N
 * días/semanas/meses/años (`rotationPeriodUnit`/`rotationPeriodInterval`)
 * el turno completo avanza una posición, contado desde
 * `rotationEpoch` (se resetea cada vez que cambia el orden o la
 * cadencia, para que el conteo arranque limpio).
 */
export function globalPeriodIndex(floor, date) {
  const unit = floor.rotationPeriodUnit || 'week'
  const interval = floor.rotationPeriodInterval || 1
  const epoch = toDateOnly(floor.rotationEpoch || date)
  if (unit === 'year') {
    return Math.floor((date.getFullYear() - epoch.getFullYear()) / interval)
  }
  if (unit === 'month') {
    return Math.floor((monthIndexFromKey(getMonthKey(date)) - monthIndexFromKey(getMonthKey(epoch))) / interval)
  }
  if (unit === 'day') {
    return Math.floor((dayIndexFromKey(getDateKey(date)) - dayIndexFromKey(getDateKey(epoch))) / interval)
  }
  return Math.floor((weekIndexFromKey(getWeekKeyOf(date)) - weekIndexFromKey(getWeekKeyOf(epoch))) / interval)
}

/** Índice de turno a usar para una actividad en un período dado — en
 * modo `period` (Determinado), el reloj global del piso reemplaza el
 * cálculo por-actividad de abajo; en modo `random` (Aleatorio, o pisos
 * sin configurar) el comportamiento es exactamente el de siempre. */
function rotationIndexFor(activity, period, weekKey, floor) {
  if (floor?.rotationMode === 'period' && floor.rotationPeriodUnit) {
    return globalPeriodIndex(floor, mondayOfWeekKey(weekKey))
  }
  return activity.recurrenceUnit === 'month' ? monthIndexFromKey(period) : activity.recurrenceUnit === 'day' ? dayIndexFromKey(period) : weekIndexFromKey(period)
}

/** ¿Quién le toca a esta actividad en este período? (manual: la
 * persona fija, o nadie en particular si se dejó en "Todos"; rotation:
 * según el rotationOrder del piso). Los eventos únicos ('once')
 * siempre son manuales — la rotación no aplica cuando solo hay un
 * turno. `floor` es opcional: sin él (o en modo 'random'), el índice
 * se calcula igual que siempre, por-actividad. */
export function assigneeFor(activity, rotationOrder, weekKey, floor) {
  if (activity.frequencyType === 'once' || activity.assignmentMode === 'manual') {
    return activity.assignedUserId || null
  }
  const period = currentPeriodKey(activity, weekKey)
  if (!period) return null
  return rotationPick(rotationOrder, rotationIndexFor(activity, period, weekKey, floor))
}

/**
 * ¿Esta actividad "cae" en esta fecha concreta? Para el Calendario e
 * Inicio: las de una sola vez, en su specific_date; las diarias, todos
 * los días de ocurrencia; las mensuales, el día del mes de start_date;
 * las semanales/quincenales, en la semana de ocurrencia Y en uno de
 * sus weekdays elegidos — sin un día elegido, no tiene lugar propio en
 * el Calendario (sigue viéndose igual en Actividades).
 */
export function isDueOnDate(activity, date) {
  if (activity.frequencyType === 'once') {
    return activity.specificDate === getDateKey(date)
  }
  const period =
    activity.recurrenceUnit === 'month' ? getMonthKey(date) : activity.recurrenceUnit === 'day' ? getDateKey(date) : getWeekKeyOf(date)
  if (isPastUntil(activity, period)) return false
  if (!isOccurrencePeriod(activity, period)) return false
  if (activity.recurrenceUnit === 'month') {
    const startDay = toDateOnly(activity.startDate).getDate()
    return date.getDate() === startDay
  }
  if (activity.recurrenceUnit === 'day') return true
  return (activity.weekdays || []).includes(isoWeekday(date))
}

/**
 * Fecha y responsable de la PRÓXIMA ocurrencia de una actividad
 * recurrente, buscando día por día después de `fromDate` (por defecto
 * hoy) — para mostrar "próximo turno" una vez que la actual ya se
 * completó. `skipPeriodKey` (opcional, normalmente el período recién
 * completado) descarta cualquier fecha que caiga en ESE MISMO período
 * — necesario para las semanales con varios días elegidos (ej. "3
 * veces a la semana"): esos días comparten una sola finalización por
 * semana, así que el próximo turno de verdad es la semana siguiente,
 * no el segundo día de ocurrencia de esta misma semana. `null` si es
 * de una sola vez (no tiene "próxima vez") o si no se encuentra
 * ninguna dentro de los próximos 2 años (p.ej. una semanal sin ningún
 * día de la semana elegido). `floor` es opcional (ver rotationIndexFor).
 */
export function nextOccurrence(activity, rotationOrder, fromDate = new Date(), skipPeriodKey = null, floor) {
  if (activity.frequencyType !== 'recurring') return null
  const start = toDateOnly(fromDate)
  for (let i = 1; i <= 730; i++) {
    const date = new Date(start)
    date.setDate(date.getDate() + i)
    if (!isDueOnDate(activity, date)) continue
    const period =
      activity.recurrenceUnit === 'month' ? getMonthKey(date) : activity.recurrenceUnit === 'day' ? getDateKey(date) : getWeekKeyOf(date)
    if (period === skipPeriodKey) continue
    const index =
      floor?.rotationMode === 'period' && floor.rotationPeriodUnit
        ? globalPeriodIndex(floor, date)
        : activity.recurrenceUnit === 'month'
          ? monthIndexFromKey(period)
          : activity.recurrenceUnit === 'day'
            ? dayIndexFromKey(period)
            : weekIndexFromKey(period)
    const assignedUserId = activity.assignmentMode === 'manual' ? activity.assignedUserId || null : rotationPick(rotationOrder, index)
    return { date, periodKey: period, assignedUserId }
  }
  return null
}

/** Actividades (con su finalización del período que corresponda, si
 * ya existe) que caen en una fecha concreta — usado por el Calendario
 * y por el "stamp" semanal de Inicio, para no duplicar esta lógica en
 * cada uno. No filtra por piso: se espera que `activities`/
 * `activityCompletions` ya vengan acotadas al piso actual. */
export function dueActivitiesOnDate(date, activities, activityCompletions) {
  const result = []
  for (const activity of activities) {
    if (!isDueOnDate(activity, date)) continue
    const period = currentPeriodKey(activity, getWeekKeyOf(date))
    const completion = period ? activityCompletions.find((c) => c.activityId === activity.id && c.periodKey === period) : null
    result.push({ activity, completion })
  }
  return result
}

/**
 * Se asegura de que exista la fila de activity_completions del
 * período ACTUAL de cada actividad recurrente (si este día/semana/mes
 * le toca ocurrencia) — las `once` no pasan por acá, su única fila se
 * crea al crear la actividad. Mismo patrón que el viejo ensureWeekTasks:
 * upsert con "ignore duplicates" sobre (activityId, periodKey), así es
 * seguro aunque el efecto que llama a esto se dispare dos veces a la
 * vez (p.ej. React.StrictMode en desarrollo, o dos pestañas del mismo
 * piso reaccionando a la vez a un cambio en vivo).
 */
export async function ensureActivityPeriods(activities, rotationOrder, weekKey, floor) {
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
        assignedUserId: assigneeFor(activity, rotationOrder, weekKey, floor),
        timesDone: 0,
        completed: false
      }
    })
    .filter(Boolean)
  if (rows.length === 0) return
  await upsertIgnoreDuplicates('activity_completions', rows, ['activityId', 'periodKey'])
}
