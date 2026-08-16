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
