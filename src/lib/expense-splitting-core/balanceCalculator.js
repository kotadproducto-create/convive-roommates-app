import { calculateSplit } from './expenseSplitter.js'

/**
 * Acumula, a partir de una lista de gastos, cuánto pagó y cuánto le
 * corresponde a cada participante, y su balance neto.
 * `netCents > 0` → le deben dinero; `< 0` → debe dinero; `0` → en paz.
 * @param {import('./types.js').Expense[]} expenses
 * @returns {import('./types.js').Balance[]}
 */
export function calculateBalances(expenses) {
  const totals = new Map()

  function entryFor(participantId) {
    if (!totals.has(participantId)) totals.set(participantId, { paidCents: 0, owedCents: 0 })
    return totals.get(participantId)
  }

  for (const expense of expenses) {
    const { splits } = calculateSplit(expense)
    entryFor(expense.paidBy).paidCents += expense.amountCents
    for (const split of splits) {
      entryFor(split.participantId).owedCents += split.amountCents
    }
  }

  return [...totals.entries()].map(([participantId, { paidCents, owedCents }]) => ({
    participantId,
    paidCents,
    owedCents,
    netCents: paidCents - owedCents
  }))
}
