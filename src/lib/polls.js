/**
 * Lógica de resolución de una consulta (Votaciones) — pura, sin acceso a
 * la BD ni a Date.now() directamente (recibe todayISO), así es testeable
 * sin mockear nada. Se invoca desde un efecto oportunista en
 * DataContext.jsx, igual que la expiración de absence_requests: no hay
 * cron en esta arquitectura, se revisa cada vez que alguien tiene la app
 * abierta.
 */

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
 * @param {{status:string, resolutionMode:'majority'|'unanimity', deadline:?string}} poll
 * @param {{userId:string, option:string}[]} votesForPoll
 * @param {string[]} activeMemberIds
 * @param {string} todayISO - 'YYYY-MM-DD'
 * @returns {null|{status:'resolved'|'closed'|'expired', resolvedOption:?string}}
 */
export function resolvePoll(poll, votesForPoll, activeMemberIds, todayISO) {
  if (poll.status !== 'pending') return null

  const electorate = new Set(activeMemberIds)
  const relevantVotes = votesForPoll.filter((v) => electorate.has(v.userId))
  const distinctVoters = new Set(relevantVotes.map((v) => v.userId))
  const everyoneVoted = electorate.size > 0 && distinctVoters.size >= electorate.size

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

  const deadlinePassed = poll.deadline && poll.deadline < todayISO
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
