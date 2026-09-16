import { describe, it, expect } from 'vitest'
import { ExpenseSplitter, toCents, SplitValidationError } from '../index.js'

function expense(overrides) {
  return {
    id: 'e1',
    amountCents: toCents(100),
    paidBy: 'A',
    participantIds: ['A', 'B', 'C'],
    splitType: 'EXACT',
    splitInputs: { A: toCents(20), B: toCents(35), C: toCents(45) },
    ...overrides
  }
}

describe('EXACT split', () => {
  it('reparto correcto (ejemplo del brief: 20/35/45 = 100)', () => {
    const { splits } = ExpenseSplitter.calculate(expense())
    expect(splits.map((s) => s.amountCents)).toEqual([2000, 3500, 4500])
  })

  it('rechaza si la suma no coincide con el total', () => {
    expect(() =>
      ExpenseSplitter.calculate(expense({ splitInputs: { A: toCents(20), B: toCents(35), C: toCents(40) } }))
    ).toThrow(SplitValidationError)
  })

  it('rechaza cantidades negativas', () => {
    expect(() =>
      ExpenseSplitter.calculate(
        expense({ splitInputs: { A: toCents(-10), B: toCents(60), C: toCents(50) } })
      )
    ).toThrow(SplitValidationError)
  })

  it('rechaza participantes duplicados', () => {
    expect(() =>
      ExpenseSplitter.calculate(
        expense({ participantIds: ['A', 'A', 'C'], splitInputs: { A: toCents(50), C: toCents(50) } })
      )
    ).toThrow(SplitValidationError)
  })

  it('rechaza si falta el monto de algún participante', () => {
    expect(() => ExpenseSplitter.calculate(expense({ splitInputs: { A: toCents(20), B: toCents(80) } }))).toThrow(
      SplitValidationError
    )
  })
})
