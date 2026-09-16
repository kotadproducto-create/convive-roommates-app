import { splitStrategies } from './splitStrategies.js'
import { SplitValidationError } from './errors.js'
import { sumCents } from './money.js'

function validateExpense(expense) {
  if (!expense || typeof expense !== 'object') {
    throw new SplitValidationError('El gasto es inválido.')
  }
  const { amountCents, paidBy, participantIds, splitType } = expense
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new SplitValidationError('El monto del gasto debe ser un entero positivo de céntimos.')
  }
  if (!paidBy) {
    throw new SplitValidationError('El gasto debe indicar quién pagó (paidBy).')
  }
  if (!Array.isArray(participantIds) || participantIds.length === 0) {
    throw new SplitValidationError('El gasto debe tener al menos un participante.')
  }
  if (!splitStrategies[splitType]) {
    throw new SplitValidationError(`Tipo de reparto desconocido: "${splitType}".`)
  }
}

/**
 * Calcula cómo se reparte UN gasto entre sus participantes, según su
 * `splitType`. No acumula balances entre varios gastos — eso es
 * responsabilidad de balanceCalculator.js.
 * @param {import('./types.js').Expense} expense
 * @returns {import('./types.js').SplitResult}
 */
export function calculateSplit(expense) {
  validateExpense(expense)
  const strategy = splitStrategies[expense.splitType]
  const splits = strategy(expense)

  const total = sumCents(splits.map((s) => s.amountCents))
  if (total !== expense.amountCents) {
    // Guarda de invariante — no debería dispararse nunca si las
    // estrategias están bien implementadas (lo cubren los tests de
    // invariantes); si salta, es un bug del motor, no un dato de usuario.
    throw new Error(`Invariante violado: sum(splits)=${total} !== expense.amountCents=${expense.amountCents}`)
  }

  return { expense, splits }
}
