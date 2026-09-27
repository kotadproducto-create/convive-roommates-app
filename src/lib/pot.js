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

/** Movimiento del pote que es un ajuste manual (aprobado por todo el
 * piso, ver requestPotAdjustment) y no un aporte ni un gasto de nadie:
 * no cuenta para el saldo personal, ni como "participó en el pote". */
export function isPotAdjustment(contribution) {
  return contribution?.kind === 'adjustment'
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

/**
 * Un importe del Pote listo para MOSTRAR: siempre con exactamente 2
 * decimales, nunca más — esto no toca la precisión interna del número, que
 * sigue circulando completa por computeWallets/expense-splitting-core; es
 * solo el texto final. En español usa coma decimal (12,50), como el resto
 * de la app; en inglés, punto (12.50) — `language` es el código que ya
 * expone useLanguage() ('es' | 'en'), español por defecto. Un número muy
 * cercano a cero (p.ej. -0.001, que redondea a "-0,00") se muestra como
 * "0,00", nunca con un signo negativo vacío de contenido.
 */
export function formatMoney(amount, language = 'es') {
  const n = Number.isFinite(Number(amount)) ? Number(amount) : 0
  const rounded = Math.round(n * 100) / 100
  const fixed = (rounded === 0 ? 0 : rounded).toFixed(2)
  return language === 'en' ? fixed : fixed.replace('.', ',')
}

/** `formatMoney` con el símbolo de euro, en el formato que se espera en
 * toda la app: "12,50 €" (con espacio antes del símbolo). */
export function formatEuros(amount, language = 'es') {
  return `${formatMoney(amount, language)} €`
}

/**
 * Mensaje de "X registró un aporte/gasto a tu nombre en el Pote" (ver
 * addPotContribution/addPotExpense en DataContext.jsx) — pura y testeable
 * sin mockear Date.now() (recibe `dateISO`). Igual que el resto de
 * mensajes de notificación que genera esa pantalla, siempre en español,
 * sin importar el idioma de quien la recibe.
 */
export function potOnBehalfMessage({ actorName, kind, amount, dateISO, note }) {
  const verb = kind === 'expense' ? 'gasto' : 'aporte'
  const amountStr = formatMoney(Math.abs(Number(amount)))
  const dateStr = new Date(dateISO).toLocaleDateString('es-ES')
  const noteStr = note ? ` — Concepto: ${note}` : ''
  return `${actorName} ha registrado un ${verb} de ${amountStr} € a tu nombre en el Pote (${dateStr})${noteStr}.`
}

/** Mensaje al autor de un aporte/gasto cuando la persona afectada reporta
 * una incidencia sobre ese registro (ver disputePotContribution). */
export function potDisputeMessage({ actorName, reason }) {
  return `${actorName} reportó una incidencia sobre un movimiento del Pote que registraste a su nombre: "${reason}"`
}
