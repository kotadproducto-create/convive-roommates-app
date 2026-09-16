import { describe, it, expect } from 'vitest'
import { ExpenseSplitter, toCents } from '../index.js'

// PRNG determinista (mulberry32) — mismo seed siempre da la misma
// secuencia, así estos tests "tipo property-based" son reproducibles sin
// añadir una librería externa (el proyecto no usa ninguna de fuzzing).
function mulberry32(seed) {
  let a = seed
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const PARTICIPANT_POOL = ['A', 'B', 'C', 'D', 'E', 'F']

function randomParticipants(rand, min = 1, max = 6) {
  const count = min + Math.floor(rand() * (max - min + 1))
  return PARTICIPANT_POOL.slice(0, count)
}

describe('Invariante: sum(splits) === expense.amountCents', () => {
  const rand = mulberry32(42)

  it('se cumple para EQUAL en 200 escenarios aleatorios', () => {
    for (let i = 0; i < 200; i++) {
      const participantIds = randomParticipants(rand)
      const amountCents = 1 + Math.floor(rand() * 1_000_000) // hasta 10.000€, nunca 0
      const { splits } = ExpenseSplitter.calculate({
        id: `e${i}`,
        amountCents,
        paidBy: participantIds[0],
        participantIds,
        splitType: 'EQUAL'
      })
      const sum = splits.reduce((s, x) => s + x.amountCents, 0)
      expect(sum).toBe(amountCents)
    }
  })

  it('se cumple para SHARES en 200 escenarios aleatorios', () => {
    for (let i = 0; i < 200; i++) {
      const participantIds = randomParticipants(rand)
      const amountCents = 1 + Math.floor(rand() * 1_000_000)
      const splitInputs = Object.fromEntries(participantIds.map((id) => [id, 1 + Math.floor(rand() * 10)]))
      const { splits } = ExpenseSplitter.calculate({
        id: `e${i}`,
        amountCents,
        paidBy: participantIds[0],
        participantIds,
        splitType: 'SHARES',
        splitInputs
      })
      const sum = splits.reduce((s, x) => s + x.amountCents, 0)
      expect(sum).toBe(amountCents)
    }
  })

  it('se cumple para PERCENTAGE en 200 escenarios aleatorios (porcentajes que suman 100)', () => {
    for (let i = 0; i < 200; i++) {
      const participantIds = randomParticipants(rand, 2, 6)
      const amountCents = 1 + Math.floor(rand() * 1_000_000)

      // Genera porcentajes aleatorios que sumen exactamente 100.
      const raw = participantIds.map(() => rand())
      const rawSum = raw.reduce((s, x) => s + x, 0)
      const percentages = raw.map((x) => (x / rawSum) * 100)
      const splitInputs = Object.fromEntries(participantIds.map((id, idx) => [id, percentages[idx]]))

      const { splits } = ExpenseSplitter.calculate({
        id: `e${i}`,
        amountCents,
        paidBy: participantIds[0],
        participantIds,
        splitType: 'PERCENTAGE',
        splitInputs
      })
      const sum = splits.reduce((s, x) => s + x.amountCents, 0)
      expect(sum).toBe(amountCents)
    }
  })
})

describe('Invariante: sum(balances netos) === 0', () => {
  const rand = mulberry32(7)

  it('se cumple para conjuntos aleatorios de gastos EQUAL', () => {
    for (let i = 0; i < 100; i++) {
      const expenseCount = 1 + Math.floor(rand() * 8)
      const expenses = []
      for (let j = 0; j < expenseCount; j++) {
        const participantIds = randomParticipants(rand)
        expenses.push({
          id: `e${i}-${j}`,
          amountCents: 1 + Math.floor(rand() * 100_000),
          paidBy: participantIds[Math.floor(rand() * participantIds.length)],
          participantIds,
          splitType: 'EQUAL'
        })
      }
      const balances = ExpenseSplitter.calculateBalances(expenses)
      const sum = balances.reduce((s, b) => s + b.netCents, 0)
      expect(sum).toBe(0)
    }
  })
})

describe('Invariante: aplicar los settlements deja todos los balances en cero', () => {
  const rand = mulberry32(99)

  it('se cumple para balances aleatorios (que ya de por sí suman 0)', () => {
    for (let i = 0; i < 100; i++) {
      const participantIds = randomParticipants(rand, 2, 6)
      // Genera montos aleatorios para todos menos el último, y que el
      // último balancee la suma a 0 — así siempre es un escenario válido.
      const nets = participantIds.slice(0, -1).map(() => Math.floor(rand() * 20000) - 10000)
      const lastNet = -nets.reduce((s, n) => s + n, 0)
      const allNets = [...nets, lastNet]

      const balances = participantIds.map((id, idx) => ({
        participantId: id,
        paidCents: 0,
        owedCents: 0,
        netCents: allNets[idx]
      }))

      const settlements = ExpenseSplitter.simplify(balances)

      const remaining = Object.fromEntries(balances.map((b) => [b.participantId, b.netCents]))
      for (const s of settlements) {
        remaining[s.payer] += s.amountCents
        remaining[s.receiver] -= s.amountCents
      }
      expect(Object.values(remaining).every((v) => v === 0)).toBe(true)
    }
  })
})
