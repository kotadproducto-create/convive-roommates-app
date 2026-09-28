/**
 * Lógica de resolución de una consulta (Votaciones) — pura, sin acceso a
 * la BD ni a Date.now() directamente (recibe todayISO), así es testeable
 * sin mockear nada. Se invoca desde un efecto oportunista en
 * DataContext.jsx, igual que la expiración de absence_requests: no hay
 * cron en esta arquitectura, se revisa cada vez que alguien tiene la app
 * abierta.
 */

import { formatMoney } from './pot'

/** 'Aprobar'/'Rechazar' son los valores que se guardan en la base (no
 * cambian, ya hay votos guardados con ellos) — esto solo traduce cómo se
 * VEN. Las opciones de una consulta 'custom' son texto libre de quien la
 * creó y se muestran tal cual, nunca pasan por acá. */
export function pollOptionLabel(option, t) {
  if (option === 'Aprobar') return t('votaciones.approve')
  if (option === 'Rechazar') return t('votaciones.reject')
  return option
}

/**
 * Texto de la pregunta de una consulta, listo para mostrar en el idioma
 * de quien la ve. Las de kind 'custom' guardan la pregunta tal cual la
 * escribió quien la creó (texto libre, no se traduce — como el nombre de
 * una actividad). Las de sistema (rotation_order/house_rule/
 * pot_adjustment/balance_reset) reconstruyen el texto a partir de
 * `payload` en vez de usar `poll.question` (que quedó grabado en el
 * idioma de quien la propuso): así cada quien la lee en el suyo.
 * `language` es el código de useLanguage() ('es'|'en'), para formatMoney.
 */
export function pollQuestionText(poll, t, proposerName, language) {
  const payload = poll.payload || {}
  if (poll.kind === 'rotation_order') {
    const { newOrder, mode, periodUnit, periodInterval } = payload
    const parts = []
    if (newOrder) parts.push(t('votaciones.rotationPartNewOrder'))
    if (mode) parts.push(t('votaciones.rotationPartMode', { mode: mode === 'random' ? t('floorSettings.modeRandom') : t('floorSettings.modePeriod') }))
    if (periodUnit) {
      const n = Math.max(1, Number(periodInterval) || 1)
      const unitCap = periodUnit.charAt(0).toUpperCase() + periodUnit.slice(1)
      const unit = t(`floorSettings.unit${unitCap}${n === 1 ? 'Option' : 'Plural'}`)
      parts.push(t('votaciones.rotationPartPeriod', { n, unit }))
    }
    return t('votaciones.rotationOrderQuestion', { name: proposerName, parts: parts.join(', ') })
  }
  if (poll.kind === 'house_rule') {
    const key =
      payload.action === 'delete' ? 'votaciones.houseRuleDeleteQuestion' : payload.action === 'edit' ? 'votaciones.houseRuleEditQuestion' : 'votaciones.houseRuleCreateQuestion'
    return t(key, { title: payload.title })
  }
  if (poll.kind === 'pot_adjustment') {
    return t('votaciones.potAdjustmentQuestion', { amount: formatMoney(payload.newAmount ?? 0, language) })
  }
  if (poll.kind === 'balance_reset') {
    return t('votaciones.balanceResetQuestion', { amount: formatMoney(payload.newBalance ?? 0, language), name: proposerName })
  }
  return poll.question
}

/** Consultas de sistema donde una opción concreta actúa como veto: basta
 * un solo voto por ella para resolverla de inmediato. Hoy solo la
 * modificación manual del Pote (todos deben aprobar; un "Rechazar" la
 * tumba). */
const VETO_OPTION_BY_KIND = { pot_adjustment: 'Rechazar' }

/**
 * Decide si una consulta 'pending' debe cambiar de estado, dado el
 * padrón de electores actual (miembros activos del piso) y los votos
 * emitidos hasta ahora. Devuelve `null` si debe seguir tal cual.
 *
 * Mayoría ('majority'): se resuelve en cuanto una opción supera la mitad
 * del PADRÓN completo (no de los votos ya emitidos) — con 6 electores
 * hacen falta 4 votos a favor, no hace falta esperar a que voten los 6.
 * Unanimidad ('unanimity'): sigue exigiendo que haya votado todo el
 * padrón y que todos hayan elegido la misma opción.
 *
 * Regla de empate: nunca se inventa un desempate. Si todos votaron pero
 * ninguna opción alcanzó lo necesario (mayoría del padrón, o unanimidad
 * en ese modo), la consulta no se resuelve sola — se queda pendiente
 * hasta que alguien la cierre a mano, o hasta que venza el plazo (si
 * hay), en cuyo caso pasa a 'closed' (ya no puede haber más votos que
 * la destraben). Si el plazo vence y todavía faltaba gente por votar,
 * pasa a 'expired' en cambio.
 *
 * `deadlineAt` (opcional, timestamp preciso en vez de solo fecha) es para
 * consultas que necesitan un plazo más corto que "un día calendario" —
 * por ahora, la de aprobar un cambio de orden de rotación (72 h) y las
 * consultas normales, cuyo plazo se elige entre 12, 24 o 72 horas. Si el
 * poll trae `deadlineAt`, se usa esa comparación exacta en vez de
 * `deadline < todayISO`; si no, el comportamiento es idéntico al de
 * siempre.
 *
 * @param {{status:string, resolutionMode:'majority'|'unanimity', deadline:?string, deadlineAt:?string}} poll
 * @param {{userId:string, option:string}[]} votesForPoll
 * @param {string[]} activeMemberIds
 * @param {string} todayISO - 'YYYY-MM-DD'
 * @param {number} [nowMs] - solo necesario cuando el poll trae `deadlineAt`
 * @returns {null|{status:'resolved'|'closed'|'expired', resolvedOption:?string}}
 */
export function resolvePoll(poll, votesForPoll, activeMemberIds, todayISO, nowMs) {
  if (poll.status !== 'pending') return null

  const electorate = new Set(activeMemberIds)
  const relevantVotes = votesForPoll.filter((v) => electorate.has(v.userId))
  const distinctVoters = new Set(relevantVotes.map((v) => v.userId))
  const everyoneVoted = electorate.size > 0 && distinctVoters.size >= electorate.size

  // Consultas con derecho a veto (ver VETO_OPTION_BY_KIND): un solo voto
  // por la opción de veto la resuelve al instante, sin esperar a que
  // voten los demás — no tiene sentido dejar "pendiente" algo que ya no
  // puede aprobarse.
  const vetoOption = VETO_OPTION_BY_KIND[poll.kind]
  if (vetoOption && relevantVotes.some((v) => v.option === vetoOption)) {
    return { status: 'resolved', resolvedOption: vetoOption }
  }

  // Reinicio de saldo "para todos" (kind 'balance_reset'): cada persona
  // decide POR SÍ MISMA y solo se le cambia su propio saldo si aprueba, así
  // que no hay ganador ni veto — la consulta sigue abierta para que todos
  // puedan votar y termina cuando ya votaron todos (o vence el plazo).
  if (poll.kind === 'balance_reset') {
    if (everyoneVoted) return { status: 'resolved', resolvedOption: null }
    return deadlineOutcome(poll, todayISO, nowMs, everyoneVoted)
  }

  const tally = tallyVotes(relevantVotes)

  let winner = null
  if (poll.resolutionMode === 'unanimity') {
    // Unanimidad: sigue exigiendo que haya votado todo el padrón (esto no
    // cambia — el pedido de "no esperar a todos" era solo para mayoría).
    if (everyoneVoted) {
      const options = Object.keys(tally)
      if (options.length === 1) winner = options[0]
    }
  } else {
    // Mayoría: no hace falta esperar a que vote todo el mundo — basta con
    // que una opción ya tenga más de la mitad del PADRÓN completo (no de
    // los votos emitidos hasta ahora). Con 6 electores hacen falta 4 votos
    // a favor, con 10 hacen falta 6, etc. Como el padrón es fijo y cada
    // persona vota una sola vez, nunca puede haber dos opciones con más de
    // la mitad al mismo tiempo — no hay ambigüedad de cuál "gana primero".
    for (const [option, count] of Object.entries(tally)) {
      if (electorate.size > 0 && count > electorate.size / 2) {
        winner = option
        break
      }
    }
  }
  if (winner) return { status: 'resolved', resolvedOption: winner }

  return deadlineOutcome(poll, todayISO, nowMs, everyoneVoted)
}

/** Si el plazo ya venció: 'closed' (votaron todos pero sin resultado) o
 * 'expired' (faltaba gente). Si no, null (sigue pendiente). */
function deadlineOutcome(poll, todayISO, nowMs, everyoneVoted) {
  const deadlinePassed = poll.deadlineAt
    ? typeof nowMs === 'number' && nowMs >= new Date(poll.deadlineAt).getTime()
    : poll.deadline && poll.deadline < todayISO
  if (deadlinePassed) {
    if (everyoneVoted) return { status: 'closed', resolvedOption: null }
    return { status: 'expired', resolvedOption: null }
  }
  return null
}

/** Conteo de votos por opción — usado tanto por resolvePoll como por la
 * UI (barra de progreso, desglose siempre público). */
export function tallyVotes(votesForPoll) {
  const tally = {}
  for (const v of votesForPoll) tally[v.option] = (tally[v.option] || 0) + 1
  return tally
}

/** Duraciones (en horas) que se pueden elegir al crear una consulta normal. */
export const POLL_DURATION_OPTIONS = [12, 24, 72]

/** Duración por defecto de una consulta normal. */
export const DEFAULT_POLL_HOURS = 72

/** Plazo de una consulta de aprobación de cambio de rotación (no se elige). */
export const ROTATION_POLL_HOURS = 72

/**
 * Momento (ISO) en que vence una consulta que dura `hours` horas contadas desde
 * `nowMs`. Solo valen las duraciones de POLL_DURATION_OPTIONS; cualquier otro
 * valor cae en la duración por defecto.
 */
export function pollDeadlineAt(hours, nowMs = Date.now()) {
  const h = POLL_DURATION_OPTIONS.includes(Number(hours)) ? Number(hours) : DEFAULT_POLL_HOURS
  return new Date(nowMs + h * 60 * 60 * 1000).toISOString()
}

/**
 * Instante (ms desde epoch) en que vence una consulta, para la cuenta
 * atrás de Votaciones.jsx — o `null` si no tiene plazo. Si trae
 * `deadlineAt` (hora exacta) se usa tal cual; si solo trae `deadline`
 * (fecha, sin hora) vence al empezar el día siguiente — mismo criterio
 * que `deadlineOutcome` de más arriba (`deadline < todayISO`), para que
 * la cuenta atrás llegue a cero justo cuando la consulta pasa a vencida.
 */
export function pollDeadlineMs(poll) {
  if (poll.deadlineAt) return new Date(poll.deadlineAt).getTime()
  if (poll.deadline) {
    const d = new Date(`${poll.deadline}T00:00:00`)
    d.setDate(d.getDate() + 1)
    return d.getTime()
  }
  return null
}

/**
 * Cuenta atrás legible a partir de cuánto falta (en ms): con cuántos
 * días/horas/minutos/segundos quedan, mostrando la unidad más gruesa que
 * corresponda (nunca segundos si faltan días, por ejemplo) — la
 * traducción de cada combinación vive en Votaciones.jsx (votaciones.countdown*).
 * `null` si ya venció (remainingMs <= 0).
 * @returns {null|{unit:'days', days:number, hours:number}
 *              |{unit:'hours', hours:number, minutes:number}
 *              |{unit:'minutes', minutes:number, seconds:number}
 *              |{unit:'seconds', seconds:number}}
 */
export function formatCountdown(remainingMs) {
  if (!(remainingMs > 0)) return null
  const totalSeconds = Math.floor(remainingMs / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (days > 0) return { unit: 'days', days, hours }
  if (hours > 0) return { unit: 'hours', hours, minutes }
  if (minutes > 0) return { unit: 'minutes', minutes, seconds }
  return { unit: 'seconds', seconds }
}
