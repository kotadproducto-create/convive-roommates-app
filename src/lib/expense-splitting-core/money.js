/**
 * Aritmética monetaria en céntimos (enteros) — evita los errores de coma
 * flotante de repartir euros directamente (0.1 + 0.2 !== 0.3 en JS). Todo
 * el motor de reparto trabaja puertas adentro en céntimos; `toCents` /
 * `fromCents` son la única frontera con "euros" (o cualquier moneda,
 * asumiendo 2 decimales) como número.
 */

const CENTS_PER_UNIT = 100

/** Convierte un monto en unidades (ej. euros) a céntimos enteros. */
export function toCents(amount) {
  return Math.round(Number(amount) * CENTS_PER_UNIT)
}

/** Convierte céntimos enteros de vuelta a unidades (ej. euros). */
export function fromCents(cents) {
  return Math.round(cents) / CENTS_PER_UNIT
}

export function sumCents(centsList) {
  return centsList.reduce((sum, c) => sum + c, 0)
}

/**
 * Reparte `totalCents` proporcionalmente a `weights` (mismo orden y
 * longitud que los participantes), garantizando que la suma del
 * resultado sea EXACTAMENTE `totalCents` — método del resto mayor
 * (largest remainder method, el mismo algoritmo de apportionment que se
 * usa por ejemplo para repartir escaños electorales):
 *
 *   1. La parte "ideal" de cada quien es `totalCents * peso / sumaPesos`.
 *   2. Se trunca cada una hacia abajo — la suma de los truncados queda
 *      por debajo del total en algunos céntimos (el "resto").
 *   3. Esos céntimos sobrantes se reparten de a uno, empezando por quien
 *      tenía el resto decimal más grande (empate: quien aparece primero
 *      en `weights` gana el céntimo).
 *
 * Determinista: los mismos inputs siempre dan el mismo resultado. Con
 * `weights` todos iguales, esto es exactamente un reparto EQUAL.
 */
export function allocate(totalCents, weights) {
  if (!Number.isInteger(totalCents)) {
    throw new Error('allocate: totalCents debe ser un entero (céntimos).')
  }
  if (!weights.length) return []
  const weightSum = weights.reduce((s, w) => s + w, 0)
  if (!(weightSum > 0)) {
    throw new Error('allocate: la suma de los pesos debe ser positiva.')
  }

  const ideal = weights.map((w) => (totalCents * w) / weightSum)
  const floors = ideal.map(Math.floor)
  const remainder = totalCents - sumCents(floors)

  const byLargestFraction = floors
    .map((_, i) => ({ i, frac: ideal[i] - floors[i] }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i)

  const result = [...floors]
  for (let k = 0; k < remainder; k++) {
    result[byLargestFraction[k].i] += 1
  }
  return result
}
