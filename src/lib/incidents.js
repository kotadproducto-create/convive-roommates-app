/**
 * Muro de incidencias: cuánto dura activa una incidencia y cuándo pasa al
 * historial (sola, al vencer el tiempo, o porque alguien la marcó como
 * solucionada). Funciones puras — igual que resolvePoll en lib/polls.js,
 * sin tocar la base ni el reloj, para poder probarlas sin mockear nada.
 */

/** Duraciones fijas que se pueden elegir al crear una incidencia (horas).
 * "Otro tiempo" no tiene entrada aquí — deja elegir una fecha/hora exacta. */
export const INCIDENT_DURATION_OPTIONS = [
  { key: '12h', hours: 12 },
  { key: '24h', hours: 24 },
  { key: '1w', hours: 24 * 7 }
]

/** `expiresAt` (ISO) a partir de horas desde ahora — para las duraciones fijas. */
export function incidentExpiresAt(hours, nowMs = Date.now()) {
  return new Date(nowMs + hours * 60 * 60 * 1000).toISOString()
}

/** Sigue activa: no la marcaron como solucionada y (si tiene plazo) todavía no venció. */
export function isIncidentActive(incident, nowMs = Date.now()) {
  if (incident.resolvedAt) return false
  if (incident.expiresAt && new Date(incident.expiresAt).getTime() <= nowMs) return false
  return true
}

/** Instante (ms) en que una incidencia activa pasa sola al historial, o
 * `null` si no tiene plazo (solo se archiva a mano). Para el reloj
 * oportunista de DataContext.jsx (mismo patrón que pollClock/removalClock). */
export function incidentExpiryMs(incident) {
  if (!incident.expiresAt) return null
  return new Date(incident.expiresAt).getTime()
}

/** Para ordenar el historial: cuándo terminó (se marcó solucionada, o venció). */
export function incidentFinishedAtMs(incident) {
  if (incident.resolvedAt) return new Date(incident.resolvedAt).getTime()
  if (incident.expiresAt) return new Date(incident.expiresAt).getTime()
  return new Date(incident.createdAt).getTime()
}
