/**
 * Reduce un conjunto de balances netos al menor número razonable de
 * transacciones ("settlements"). Algoritmo: se ordenan deudores y
 * acreedores de mayor a menor monto (una sola vez, orden estable por
 * id para desempatar) y se consumen con dos punteros — en cada paso se
 * liquida el mínimo entre el deudor y el acreedor actuales, y se avanza
 * el puntero de quien llegó a 0.
 *
 * Es el algoritmo greedy estándar para este problema (genérico y
 * conocido — no proviene de ningún repositorio de referencia).
 * Es determinista y siempre correcto (todas las deudas quedan saldadas),
 * pero NO garantiza matemáticamente el mínimo absoluto de transacciones
 * en todos los casos posibles: encontrar el mínimo exacto es un problema
 * NP-difícil en general. En la práctica, para un grupo del tamaño de un
 * piso compartido, el resultado es igual o muy cercano al óptimo.
 * @param {import('./types.js').Balance[]} balances
 * @returns {import('./types.js').Settlement[]}
 */
export function simplifyDebts(balances) {
  const byAmountDesc = (a, b) => b.amountCents - a.amountCents || a.participantId.localeCompare(b.participantId)

  const creditors = balances
    .filter((b) => b.netCents > 0)
    .map((b) => ({ participantId: b.participantId, amountCents: b.netCents }))
    .sort(byAmountDesc)
  const debtors = balances
    .filter((b) => b.netCents < 0)
    .map((b) => ({ participantId: b.participantId, amountCents: -b.netCents }))
    .sort(byAmountDesc)

  const settlements = []
  let i = 0
  let j = 0
  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i]
    const creditor = creditors[j]
    const amount = Math.min(debtor.amountCents, creditor.amountCents)

    if (amount > 0) {
      settlements.push({ payer: debtor.participantId, receiver: creditor.participantId, amountCents: amount })
    }

    debtor.amountCents -= amount
    creditor.amountCents -= amount
    if (debtor.amountCents === 0) i++
    if (creditor.amountCents === 0) j++
  }

  return settlements
}
