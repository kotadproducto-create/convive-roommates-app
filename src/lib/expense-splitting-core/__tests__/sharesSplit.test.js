import { describe, it, expect } from 'vitest'
import { ExpenseSplitter, toCents, SplitValidationError } from '../index.js'

function expense(overrides) {
  return {
    id: 'e1',
    amountCents: toCents(100),
    paidBy: 'A',
    participantIds: ['A', 'B', 'C'],
    splitType: 'SHARES',
    splitInputs: { A: 2, B: 1, C: 1 },
    ...overrides
  }
}

describe('SHARES split', () => {
  it('1/1 (2 participantes, mitad y mitad)', () => {
    const { splits } = ExpenseSplitter.calculate(
      expense({ participantIds: ['A', 'B'], splitInputs: { A: 1, B: 1 } })
    )
    expect(splits.map((s) => s.amountCents)).toEqual([5000, 5000])
  })

  it('2/1/1 (ejemplo del brief: 100€ → 50/25/25)', () => {
    const { splits } = ExpenseSplitter.calculate(expense())
    expect(splits.map((s) => s.amountCents)).toEqual([5000, 2500, 2500])
  })

  it('shares decimales', () => {
    const { splits } = ExpenseSplitter.calculate(
      expense({ splitInputs: { A: 1.5, B: 1, C: 1.5 } })
    )
    expect(splits.reduce((s, x) => s + x.amountCents, 0)).toBe(toCents(100))
  })

  it('rechaza shares negativas', () => {
    expect(() =>
      ExpenseSplitter.calculate(expense({ splitInputs: { A: -1, B: 1, C: 1 } }))
    ).toThrow(SplitValidationError)
  })

  it('rechaza shares en cero para todos (total de shares cero)', () => {
    expect(() =>
      ExpenseSplitter.calculate(
        expense({ participantIds: ['A', 'B'], splitInputs: { A: 0, B: 0 } })
      )
    ).toThrow(SplitValidationError)
  })
})
