/**
 * Espacios compartidos (Actividades → "Espacios compartidos"): elementos de
 * uso común del piso que se "reservan" avisando al resto — hoy solo la
 * lavadora. Es una lógica aparte de las actividades de limpieza/tareas
 * (no hay turnos, ni rotación, ni puntos): quien va a usarlo lo avisa, y
 * mientras dure ese uso el espacio figura "en uso" para todos.
 *
 * Para agregar otro espacio (secadora, cocina, terraza…): una entrada en
 * SHARED_SPACES (su clave va a shared_space_uses.space_key, sin migración)
 * y sus textos en i18n `sharedSpaces.spaces.<clave>`.
 */
export const SHARED_SPACES = [
  {
    key: 'washer',
    // Cómo se nombra en el aviso que se manda al piso (mensaje guardado en
    // notifications, siempre en español como el resto de avisos de sistema).
    notifyName: 'la lavadora',
    // Duración por defecto y opciones para "cuánto la voy a usar" (minutos).
    defaultMinutes: 120,
    durations: [60, 120, 180]
  }
]

export const SHARED_SPACE_BY_KEY = Object.fromEntries(SHARED_SPACES.map((s) => [s.key, s]))

/**
 * Uso vigente de un espacio: el más reciente que no se liberó antes de
 * tiempo ("Ya terminé") y cuyo fin todavía no pasó. null = libre. Como no hay
 * cron, "libre" se calcula en el momento con la hora actual, no se guarda.
 *
 * @param {{spaceKey:string, startsAt:string, endsAt:string, releasedAt?:string|null}[]} uses
 * @param {string} spaceKey
 * @param {number} [nowMs]
 */
export function currentSpaceUse(uses, spaceKey, nowMs = Date.now()) {
  return (
    uses
      .filter((u) => u.spaceKey === spaceKey && !u.releasedAt && new Date(u.endsAt).getTime() > nowMs)
      .sort((a, b) => new Date(b.startsAt) - new Date(a.startsAt))[0] || null
  )
}

/** Minutos que faltan para que termine un uso (mínimo 1 mientras siga vigente). */
export function minutesLeft(use, nowMs = Date.now()) {
  return Math.max(1, Math.ceil((new Date(use.endsAt).getTime() - nowMs) / 60000))
}

/** 95 → { hours: 1, minutes: 35 } — para mostrar "1 h 35 min" / "35 min". */
export function splitMinutes(total) {
  return { hours: Math.floor(total / 60), minutes: total % 60 }
}
