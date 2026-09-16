import { describe, it, expect } from 'vitest'
import { ExpenseSplitter, toCents, SplitValidationError } from '../index.js'

function expense(overrides) {
  return {
    id: 'e1',
    amountCents: toCents(120),
    paidBy: 'A',
    participantIds: ['A', 'B', 'C'],
    splitType: 'EQUAL',
    ...overrides
  }
}

describe('EQUAL split', () => {
  it('2 participantes', () => {
    const { splits } = ExpenseSplitter.calculate(expense({ amountCents: toCents(50), participantIds: ['A', 'B'] }))
    expect(splits.map((s) => s.amountCents)).toEqual([2500, 2500])
  })

  it('3 participantes (120€ del ejemplo del brief)', () => {
    const { splits } = ExpenseSplitter.calculate(expense())
    expect(splits).toEqual([
      { expenseId: 'e1', participantId: 'A', amountCents: 4000 },
      { expenseId: 'e1', participantId: 'B', amountCents: 4000 },
      { expenseId: 'e1', participantId: 'C', amountCents: 4000 }
    ])
  })

  it('4 participantes', () => {
    const { splits } = ExpenseSplitter.calculate(
      expense({ amountCents: toCents(100), participantIds: ['A', 'B', 'C', 'D'] })
    )
    expect(splits.map((s) => s.amountCents)).toEqual([2500, 2500, 2500, 2500])
  })

  it('cantidad divisible exactamente', () => {
    const { splits } = ExpenseSplitter.calculate(expense({ amountCents: toCents(90) }))
    expect(splits.map((s) => s.amountCents)).toEqual([3000, 3000, 3000])
  })

  it('cantidad con céntimos sobrantes: 100€/3 no pierde ningún céntimo', () => {
    const { splits } = ExpenseSplitter.calculate(expense({ amountCents: toCents(100) }))
    const amounts = splits.map((s) => s.amountCents)
    expect(amounts.reduce((a, b) => a + b, 0)).toBe(toCents(100))
    expect(amounts).toEqual([3334, 3333, 3333])
  })

  it('cantidad pequeña (1 céntimo entre 3)', () => {
    const { splits } = ExpenseSplitter.calculate(expense({ amountCents: 1 }))
    expect(splits.reduce((s, x) => s + x.amountCents, 0)).toBe(1)
  })

  it('un único participante se queda con todo el gasto', () => {
    const { splits } = ExpenseSplitter.calculate(expense({ participantIds: ['A'] }))
    expect(splits).toEqual([{ expenseId: 'e1', participantId: 'A', amountCents: 12000 }])
  })

  it('rechaza participantes duplicados', () => {
    expect(() => ExpenseSplitter.calculate(expense({ participantIds: ['A', 'A', 'B'] }))).toThrow(
      SplitValidationError
    )
  })
})
