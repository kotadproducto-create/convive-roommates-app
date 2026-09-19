/**
 * Lógica de resolución de una consulta (Votaciones) — pura, sin acceso a
 * la BD ni a Date.now() directamente (recibe todayISO), así es testeable
 * sin mockear nada. Se invoca desde un efecto oportunista en
 * DataContext.jsx, igual que la expiración de absence_requests: no hay
 * cron en esta arquitectura, se revisa cada vez que alguien tiene la app
 * abierta.
 */

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
 * Regla de empate: nunca se inventa un desempate. Si todos votaron pero
 * ninguna opción tiene mayoría (o no hay unanimidad en modo
 * 'unanimity'), la consulta no se resuelve sola — se queda pendiente
 * hasta que alguien la cierre a mano, o hasta que venza el plazo (si
 * hay), en cuyo caso pasa a 'closed' (ya no puede haber más votos que
 * la destraben). Si el plazo vence y todavía faltaba gente por votar,
 * pasa a 'expired' en cambio.
 *
 * `deadlineAt` (opcional, timestamp preciso en vez de solo fecha) es para
 * consultas que necesitan un plazo más corto que "un día calendario" —
 * por ahora, la de aprobar un cambio de orden de rotación (<24h). Si el
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

  const tally = tallyVotes(relevantVotes)

  let winner = null
  if (everyoneVoted) {
    if (poll.resolutionMode === 'unanimity') {
      const options = Object.keys(tally)
      if (options.length === 1) winner = options[0]
    } else {
      for (const [option, count] of Object.entries(tally)) {
        if (count > relevantVotes.length / 2) {
          winner = option
          break
        }
      }
    }
  }
  if (winner) return { status: 'resolved', resolvedOption: winner }

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
