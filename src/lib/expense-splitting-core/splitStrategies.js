import { allocate } from './money.js'
import { SplitValidationError } from './errors.js'

function assertNoDuplicateParticipants(participantIds) {
  if (new Set(participantIds).size !== participantIds.length) {
    throw new SplitValidationError('Hay participantes duplicados en el gasto.')
  }
}

function assertHasSplitInputs(splitInputs, splitType) {
  if (!splitInputs || typeof splitInputs !== 'object') {
    throw new SplitValidationError(`${splitType} requiere splitInputs con un valor por participante.`)
  }
}

function assertNoMissingInputs(participantIds, splitInputs, splitType) {
  const missing = participantIds.filter((id) => !(id in splitInputs))
  if (missing.length) {
    throw new SplitValidationError(`Falta el valor de ${splitType} para: ${missing.join(', ')}`)
  }
}

function toSplits(expense, participantIds, amounts) {
  return participantIds.map((participantId, i) => ({
    expenseId: expense.id,
    participantId,
    amountCents: amounts[i]
  }))
}

/** Reparte el gasto en partes iguales entre todos los participantes. */
export function equalSplit(expense) {
  const { participantIds, amountCents } = expense
  assertNoDuplicateParticipants(participantIds)
  const amounts = allocate(amountCents, participantIds.map(() => 1))
  return toSplits(expense, participantIds, amounts)
}

/** Cada participante paga exactamente el monto (en céntimos) que se le indique. */
export function exactSplit(expense) {
  const { participantIds, amountCents, splitInputs } = expense
  assertNoDuplicateParticipants(participantIds)
  assertHasSplitInputs(splitInputs, 'EXACT')
  assertNoMissingInputs(participantIds, splitInputs, 'EXACT')

  let total = 0
  const amounts = participantIds.map((id) => {
    const cents = splitInputs[id]
    if (!Number.isInteger(cents) || cents < 0) {
      throw new SplitValidationError(`El monto exacto de "${id}" debe ser un entero de céntimos >= 0.`)
    }
    total += cents
    return cents
  })

  if (total !== amountCents) {
    throw new SplitValidationError(
      `La suma de los montos exactos (${total}) no coincide con el total del gasto (${amountCents}).`
    )
  }
  return toSplits(expense, participantIds, amounts)
}

/** Reparte el gasto según un porcentaje (0-100) por participante; deben sumar 100. */
export function percentageSplit(expense) {
  const { participantIds, amountCents, splitInputs } = expense
  assertNoDuplicateParticipants(participantIds)
  assertHasSplitInputs(splitInputs, 'PERCENTAGE')
  assertNoMissingInputs(participantIds, splitInputs, 'PERCENTAGE')

  const percentages = participantIds.map((id) => splitInputs[id])
  for (const pct of percentages) {
    if (typeof pct !== 'number' || Number.isNaN(pct) || pct < 0) {
      throw new SplitValidationError('Los porcentajes deben ser números >= 0.')
    }
  }
  const sum = percentages.reduce((s, p) => s + p, 0)
  // Tolerancia mínima por representación en coma flotante del input (ej.
  // 33.33+33.33+33.34), no para "casi 100 vale" — la regla de negocio
  // sigue siendo que deben sumar 100.
  if (Math.abs(sum - 100) > 1e-9) {
    throw new SplitValidationError(`Los porcentajes deben sumar 100 (suman ${sum}).`)
  }

  const amounts = allocate(amountCents, percentages)
  return toSplits(expense, participantIds, amounts)
}

/** Reparte el gasto en proporción a las "shares" (partes) de cada participante. */
export function sharesSplit(expense) {
  const { participantIds, amountCents, splitInputs } = expense
  assertNoDuplicateParticipants(participantIds)
  assertHasSplitInputs(splitInputs, 'SHARES')
  assertNoMissingInputs(participantIds, splitInputs, 'SHARES')

  const shares = participantIds.map((id) => splitInputs[id])
  for (const s of shares) {
    if (typeof s !== 'number' || Number.isNaN(s) || s <= 0) {
      throw new SplitValidationError('Las shares deben ser números positivos.')
    }
  }
  const totalShares = shares.reduce((s, n) => s + n, 0)
  if (!(totalShares > 0)) {
    throw new SplitValidationError('La suma de las shares debe ser mayor que 0.')
  }

  const amounts = allocate(amountCents, shares)
  return toSplits(expense, participantIds, amounts)
}

/** Registro de estrategias por `splitType` — el "Strategy pattern" en JS
 * es simplemente este objeto de funciones puras: añadir un tipo nuevo es
 * añadir una función y una entrada acá, sin tocar expenseSplitter.js. */
export const splitStrategies = {
  EQUAL: equalSplit,
  EXACT: exactSplit,
  PERCENTAGE: percentageSplit,
  SHARES: sharesSplit
}
