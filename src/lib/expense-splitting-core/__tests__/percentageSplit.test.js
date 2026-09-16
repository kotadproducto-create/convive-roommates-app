import { describe, it, expect } from 'vitest'
import { ExpenseSplitter, toCents, SplitValidationError } from '../index.js'

function expense(overrides) {
  return {
    id: 'e1',
    amountCents: toCents(100),
    paidBy: 'A',
    participantIds: ['A', 'B', 'C'],
    splitType: 'PERCENTAGE',
    splitInputs: { A: 50, B: 30, C: 20 },
    ...overrides
  }
}

describe('PERCENTAGE split', () => {
  it('100/0: un participante se lleva todo', () => {
    const { splits } = ExpenseSplitter.calculate(
      expense({ participantIds: ['A', 'B'], splitInputs: { A: 100, B: 0 } })
    )
    expect(splits.map((s) => s.amountCents)).toEqual([10000, 0])
  })

  it('50/30/20 (ejemplo del brief)', () => {
    const { splits } = ExpenseSplitter.calculate(expense())
    expect(splits.map((s) => s.amountCents)).toEqual([5000, 3000, 2000])
  })

  it('porcentajes con decimales (33.33/33.33/33.34) sin perder céntimos', () => {
    const { splits } = ExpenseSplitter.calculate(
      expense({ splitInputs: { A: 33.33, B: 33.33, C: 33.34 } })
    )
    const amounts = splits.map((s) => s.amountCents)
    expect(amounts.reduce((a, b) => a + b, 0)).toBe(toCents(100))
  })

  it('rechaza si los porcentajes no suman 100', () => {
    expect(() => ExpenseSplitter.calculate(expense({ splitInputs: { A: 50, B: 30, C: 10 } }))).toThrow(
      SplitValidationError
    )
  })

  it('redondeos: 100€ a 3 con 1/3 cada uno no pierde céntimos', () => {
    const { splits } = ExpenseSplitter.calculate(
      expense({ splitInputs: { A: 100 / 3, B: 100 / 3, C: 100 / 3 } })
    )
    expect(splits.reduce((s, x) => s + x.amountCents, 0)).toBe(toCents(100))
  })

  it('rechaza porcentajes negativos', () => {
    expect(() =>
      ExpenseSplitter.calculate(expense({ splitInputs: { A: -10, B: 60, C: 50 } }))
    ).toThrow(SplitValidationError)
  })
})
