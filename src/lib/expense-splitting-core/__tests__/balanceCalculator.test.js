import { describe, it, expect } from 'vitest'
import { ExpenseSplitter, toCents } from '../index.js'

describe('Balance', () => {
  it('un solo gasto: quien paga queda a favor, el resto en contra', () => {
    // Expense: A paga 120€, A+B+C participan a partes iguales (ejemplo del brief)
    const expenses = [
      { id: 'e1', amountCents: toCents(120), paidBy: 'A', participantIds: ['A', 'B', 'C'], splitType: 'EQUAL' }
    ]
    const balances = ExpenseSplitter.calculateBalances(expenses)
    const byId = Object.fromEntries(balances.map((b) => [b.participantId, b]))

    expect(byId.A.netCents).toBe(toCents(80)) // adelantó 80€
    expect(byId.B.netCents).toBe(-toCents(40)) // debe 40€
    expect(byId.C.netCents).toBe(-toCents(40)) // debe 40€
  })

  it('múltiples gastos entre los mismos participantes se acumulan', () => {
    const expenses = [
      { id: 'e1', amountCents: toCents(100), paidBy: 'A', participantIds: ['A', 'B'], splitType: 'EQUAL' },
      { id: 'e2', amountCents: toCents(60), paidBy: 'B', participantIds: ['A', 'B'], splitType: 'EQUAL' },
      {
        id: 'e3',
        amountCents: toCents(90),
        paidBy: 'C',
        participantIds: ['A', 'B', 'C'],
        splitType: 'EQUAL'
      }
    ]
    const balances = ExpenseSplitter.calculateBalances(expenses)
    const byId = Object.fromEntries(balances.map((b) => [b.participantId, b]))

    // A: pagó 100, le corresponde 50(e1)+30(e2)+30(e3)=110 → neto -10
    expect(byId.A.netCents).toBe(toCents(100) - toCents(50 + 30 + 30))
    // B: pagó 60, le corresponde 50(e1)+30(e2)+30(e3)=110 → neto -50
    expect(byId.B.netCents).toBe(toCents(60) - toCents(50 + 30 + 30))
    // C: pagó 90, le corresponde 30(e3) → neto +60
    expect(byId.C.netCents).toBe(toCents(90) - toCents(30))
  })

  it('invariante: la suma de todos los balances netos es 0', () => {
    const expenses = [
      { id: 'e1', amountCents: toCents(100), paidBy: 'A', participantIds: ['A', 'B'], splitType: 'EQUAL' },
      { id: 'e2', amountCents: toCents(60), paidBy: 'B', participantIds: ['A', 'B'], splitType: 'EQUAL' },
      {
        id: 'e3',
        amountCents: toCents(90),
        paidBy: 'C',
        participantIds: ['A', 'B', 'C'],
        splitType: 'EQUAL'
      }
    ]
    const balances = ExpenseSplitter.calculateBalances(expenses)
    const sum = balances.reduce((s, b) => s + b.netCents, 0)
    expect(sum).toBe(0)
  })
})
