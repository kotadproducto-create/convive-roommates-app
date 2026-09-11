/**
 * Semáforo de color para el total del pote, usado en todas las pantallas
 * que lo muestran (Pote, Inicio, Calendario): rojo si se gastó de más
 * (negativo), naranja si está bajo pero sin llegar a deber, verde si está
 * saludable.
 */
export function potAmountColorClass(amount) {
  const n = Number(amount) || 0
  if (n < 0) return 'text-clay-500'
  if (n < 5) return 'text-gold-500'
  return 'text-sage-500'
}

/** Mensaje corto para el globo de diálogo del pote, a juego con el mismo
 * semáforo. Recibe `t` (LanguageContext) para traducirse — si no se pasa,
 * cae al texto en español fijo (por si algún caller todavía no lo pasa). */
export function potAmountBubbleMessage(amount, t) {
  const n = Number(amount) || 0
  const tt = t || ((key) => ({ 'pot.needsRefill': '¡Toca reponer! 🪫', 'pot.runningLow': 'Va quedando poco 👀', 'pot.healthy': '¡Vais bien! 🌿' })[key])
  if (n < 0) return tt('pot.needsRefill')
  if (n < 5) return tt('pot.runningLow')
  return tt('pot.healthy')
}
