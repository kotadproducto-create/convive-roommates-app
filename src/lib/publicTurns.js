import { assigneeFor, currentPeriodKey, floorKeeperFor, getWeekKeyOf, nextOccurrence } from './activities'
import { SHARED_SPACES, currentSpaceUse, waitlistFor } from './sharedSpaces'

/**
 * Link público de turnos (solo lectura): a partir de los datos crudos que
 * entrega get_public_turns (ver supabase/public_turns.sql) calcula lo que se
 * muestra —la persona encargada del piso, el turno actual y el siguiente de
 * cada actividad— con la MISMA lógica de rotación que usa la app, así que
 * coincide con lo que ven los miembros. Es pura: no toca la base ni el reloj.
 */

/** Link que se comparte (y se convierte en QR). */
export function publicTurnsLink(origin, token) {
  return `${String(origin).replace(/\/$/, '')}/turnos/${token}`
}

/** Un token válido es texto hexadecimal largo: evita armar rutas raras. */
export function isPublicTurnsToken(token) {
  return typeof token === 'string' && /^[0-9a-f]{32,128}$/i.test(token)
}

const person = (byId, id) => (id && byId[id] ? { id, name: byId[id].name } : null)

// Mismo cálculo que getMondayOfWeek en lib/rotation.js — repetido acá (una
// línea) para no crear una dependencia cruzada entre módulos (este archivo
// es puro y rotation.js arrastra el cliente de Supabase).
function mondayOfWeekKey(weekKey) {
  const [year, week] = weekKey.split('-W').map(Number)
  const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7))
  const dow = simple.getUTCDay()
  const monday = new Date(simple)
  if (dow <= 4) monday.setUTCDate(simple.getUTCDate() - dow + 1)
  else monday.setUTCDate(simple.getUTCDate() + 8 - dow)
  return monday
}

/**
 * @param {object} data    respuesta de get_public_turns (ok: true)
 * @param {Date}   [now]
 * @returns {{floorName:string, keeper:{now:?object, next:?object},
 *            activities:object[], rotation:object[], away:string[]}}
 */
export function buildPublicTurns(data, now = new Date()) {
  const floor = data.floor || {}
  const members = data.members || []
  const byId = Object.fromEntries(members.map((m) => [m.id, m]))
  const awayIds = new Set(members.filter((m) => m.away).map((m) => m.id))
  // Orden efectivo: como en la app, quien está fuera se salta.
  const order = (floor.rotationOrder || []).filter((id) => byId[id] && !awayIds.has(id))

  const weekKey = getWeekKeyOf(now)
  const nextWeek = new Date(now)
  nextWeek.setDate(nextWeek.getDate() + 7)
  const nextWeekKey = getWeekKeyOf(nextWeek)

  const completionByKey = {}
  for (const c of data.completions || []) completionByKey[`${c.activityId}|${c.periodKey}`] = c

  const activities = (data.activities || []).map((activity) => {
    const period = currentPeriodKey(activity, weekKey)
    const completion = period ? completionByKey[`${activity.id}|${period}`] : null
    const isManual = activity.assignmentMode === 'manual'

    let current = null
    if (period) {
      // Si alguien ya abrió la app este período, manda lo que quedó guardado;
      // si no, se calcula igual que lo haría la app.
      const assignedId = completion ? completion.assignedUserId : assigneeFor(activity, order, weekKey, floor)
      current = { person: person(byId, assignedId), everyone: !assignedId && isManual }
    }

    const target = activity.recurrenceUnit === 'week' ? activity.timesPerWeek || 1 : 1
    const upcoming = nextOccurrence(activity, order, now, period, floor)

    return {
      id: activity.id,
      title: activity.title,
      fixedKey: activity.fixedKey || null,
      thisPeriod: Boolean(period),
      now: current
        ? { ...current, done: Boolean(completion?.completed), timesDone: completion?.timesDone || 0, target }
        : null,
      next: upcoming
        ? {
            date: upcoming.date,
            person: person(byId, upcoming.assignedUserId),
            everyone: !upcoming.assignedUserId && isManual
          }
        : null
    }
  })

  const keeperNowId = floorKeeperFor(floor, order, weekKey)
  const keeperNextId = floorKeeperFor(floor, order, nextWeekKey)

  // Espacios compartidos (hoy la lavadora, ver lib/sharedSpaces.js): mismas
  // funciones puras que usa la app con sesión (SharedSpaces.jsx), a partir
  // de los usos/lista de espera crudos que entrega get_public_turns.
  const spaceUses = data.sharedSpaceUses || []
  const spaceWaitlist = data.sharedSpaceWaitlist || []
  const sharedSpaces = SHARED_SPACES.map((space) => {
    const use = currentSpaceUse(spaceUses, space.key, now.getTime())
    return {
      key: space.key,
      current: use ? { person: person(byId, use.userId), endsAt: new Date(use.endsAt) } : null,
      waitlist: waitlistFor(spaceWaitlist, space.key)
        .map((w) => person(byId, w.userId))
        .filter(Boolean)
    }
  })

  return {
    floorName: floor.name || '',
    // Código de invitación del piso (get_public_turns lo incluye) — para el
    // botón "Unirme a este piso" (ver PublicTurns.jsx); null si por lo que
    // sea no vino (enlaces viejos antes de este campo, o datos de prueba).
    inviteCode: floor.inviteCode || null,
    keeper: { now: person(byId, keeperNowId), next: person(byId, keeperNextId), nextChangeDate: mondayOfWeekKey(nextWeekKey) },
    activities,
    sharedSpaces,
    rotation: (floor.rotationOrder || [])
      .filter((id) => byId[id])
      .map((id) => ({ id, name: byId[id].name, isVirtual: Boolean(byId[id].isVirtual), away: awayIds.has(id) })),
    away: members.filter((m) => m.away).map((m) => m.name)
  }
}

/**
 * Mismo cálculo que buildPublicTurns, pero a partir de los datos ya cargados
 * en DataContext (con sesión) en vez de la respuesta cruda de get_public_turns
 * — para la previsualización "cambió el orden de rotación" (ver
 * RotationOrderNotice.jsx) que se muestra sin pasar por el link público.
 * `members` son los de useData() (id, name, isVirtual); `awayUserIds` es el
 * Set que ya arma DataContext.jsx.
 */
export function buildFloorTurnsPreview(floor, members, awayUserIds, activities, completions, now = new Date()) {
  return buildPublicTurns(
    {
      floor: {
        name: floor?.name,
        rotationOrder: floor?.rotationOrder || [],
        rotationMode: floor?.rotationMode,
        rotationPeriodUnit: floor?.rotationPeriodUnit,
        rotationPeriodInterval: floor?.rotationPeriodInterval,
        rotationEpoch: floor?.rotationEpoch,
        rotationOffset: floor?.rotationOffset
      },
      members: (members || []).map((m) => ({ id: m.id, name: m.name, isVirtual: Boolean(m.isVirtual), away: awayUserIds?.has(m.id) || false })),
      activities: activities || [],
      completions: completions || []
    },
    now
  )
}
