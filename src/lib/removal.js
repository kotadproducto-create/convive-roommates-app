/**
 * Vencimiento de una solicitud de salida (initiateRemoval, ver
 * DataContext.jsx): pura, sin acceso a Date.now() directamente (recibe
 * nowMs), así es testeable sin mockear nada — mismo patrón que
 * resolvePoll/pollDeadlineAt en lib/polls.js. Se invoca desde un efecto
 * oportunista en DataContext.jsx: no hay cron en esta arquitectura, se
 * revisa cada vez que alguien del piso tiene la app abierta.
 */

/** Horas que tiene el afectado para responder (confirmar o rechazar) antes
 * de que su salida se haga efectiva sola. */
export const REMOVAL_HOURS = 48

/** Momento (ISO) en que vence una solicitud iniciada en `requestedAtISO`. */
export function removalDeadlineAt(requestedAtISO) {
  return new Date(new Date(requestedAtISO).getTime() + REMOVAL_HOURS * 60 * 60 * 1000).toISOString()
}

/** true si, a `nowMs`, ya venció el plazo de `requestedAtISO` sin respuesta. */
export function isRemovalExpired(requestedAtISO, nowMs) {
  if (!requestedAtISO || typeof nowMs !== 'number') return false
  return nowMs >= new Date(removalDeadlineAt(requestedAtISO)).getTime()
}
