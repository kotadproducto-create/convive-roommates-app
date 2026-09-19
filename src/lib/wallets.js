import { ExpenseSplitter, toCents, fromCents } from './expense-splitting-core/index.js'
import { isPotAdjustment } from './pot.js'

/**
 * Wallet de cada persona del piso, calculada desde el libro del Pote
 * (`pot_contributions`), con dos reglas simples:
 *
 * - Aporte (monto > 0): suma el monto COMPLETO a la wallet de quien
 *   aportó. A nadie más le afecta.
 * - Gasto (monto < 0, venga de la pestaña Pote o de Compras): se reparte
 *   en partes iguales entre TODOS los miembros del piso que ya estaban
 *   cuando se hizo el gasto, y cada parte se resta de su wallet. (El
 *   total del Pote baja por el monto completo — eso lo hace DataContext.)
 *
 * Los ajustes manuales del Pote (`kind: 'adjustment'`) no tocan wallets.
 * Todo se calcula en céntimos enteros (expense-splitting-core), así que
 * la suma de las partes de un gasto es exactamente el gasto.
 *
 * @param {{id:string, joinedAt?:string}[]} members - miembros activos del piso
 * @param {{userId:string, amount:number|string, createdAt:string, kind?:string}[]} potContributions
 * @returns {Record<string, {contributed:number, expenseShare:number, balance:number}>} en euros, por id de miembro
 */
export function computeWallets(members, potContributions) {
  const cents = Object.fromEntries(members.map((m) => [m.id, { contributed: 0, expenseShare: 0 }]))

  const movements = potContributions
    .filter((c) => !isPotAdjustment(c))
    .slice()
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))

  let expenseIndex = 0
  for (const c of movements) {
    const amount = Number(c.amount)
    if (!amount) continue

    if (amount > 0) {
      if (cents[c.userId]) cents[c.userId].contributed += toCents(amount)
      continue
    }

    let participants = members.filter((m) => !m.joinedAt || new Date(m.joinedAt) <= new Date(c.createdAt))
    if (participants.length === 0) participants = members
    if (participants.length === 0) continue

    // Rota quién queda primero en la lista para que el céntimo sobrante de
    // un gasto que no se divide exacto no caiga siempre en la misma persona.
    const shift = expenseIndex % participants.length
    const ordered = [...participants.slice(shift), ...participants.slice(0, shift)]
    expenseIndex++

    const { splits } = ExpenseSplitter.calculate({
      amountCents: toCents(Math.abs(amount)),
      paidBy: c.userId,
      participantIds: ordered.map((m) => m.id),
      splitType: 'EQUAL'
    })
    for (const s of splits) cents[s.participantId].expenseShare += s.amountCents
  }

  return Object.fromEntries(
    Object.entries(cents).map(([id, w]) => [
      id,
      {
        contributed: fromCents(w.contributed),
        expenseShare: fromCents(w.expenseShare),
        balance: fromCents(w.contributed - w.expenseShare)
      }
    ])
  )
}
