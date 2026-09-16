import { describe, it, expect } from 'vitest'
import { ExpenseSplitter, toCents } from '../index.js'

function balance(participantId, netEuros) {
  return { participantId, paidCents: 0, owedCents: 0, netCents: toCents(netEuros) }
}

function totalsByPayer(settlements) {
  return settlements.reduce((acc, s) => {
    acc[`${s.payer}->${s.receiver}`] = (acc[`${s.payer}->${s.receiver}`] || 0) + s.amountCents
    return acc
  }, {})
}

describe('Debt simplification', () => {
  it('cadena simple A→B→C se colapsa a A→C', () => {
    // A debe 100 a B, B debe 100 a C → neto: A=-100, B=0, C=+100
    const balances = [balance('A', -100), balance('B', 0), balance('C', 100)]
    const settlements = ExpenseSplitter.simplify(balances)
    expect(settlements).toEqual([{ payer: 'A', receiver: 'C', amountCents: toCents(100) }])
  })

  it('un deudor y varios acreedores', () => {
    const balances = [balance('A', -50), balance('B', 30), balance('C', 20)]
    const settlements = ExpenseSplitter.simplify(balances)
    expect(totalsByPayer(settlements)).toEqual({
      'A->B': toCents(30),
      'A->C': toCents(20)
    })
  })

  it('varios deudores y un acreedor', () => {
    const balances = [balance('A', -30), balance('B', -20), balance('C', 50)]
    const settlements = ExpenseSplitter.simplify(balances)
    expect(totalsByPayer(settlements)).toEqual({
      'A->C': toCents(30),
      'B->C': toCents(20)
    })
  })

  it('balances perfectamente equilibrados no generan settlements', () => {
    const balances = [balance('A', 0), balance('B', 0), balance('C', 0)]
    expect(ExpenseSplitter.simplify(balances)).toEqual([])
  })

  it('múltiples deudores y acreedores (ejemplo del brief)', () => {
    // A debe 20 a B, C debe 50 a B, A debe 30 a C → neto: A=-50, B=+70, C=-20
    const balances = [balance('A', -50), balance('B', 70), balance('C', -20)]
    const settlements = ExpenseSplitter.simplify(balances)
    expect(totalsByPayer(settlements)).toEqual({
      'A->B': toCents(50),
      'C->B': toCents(20)
    })
  })

  it('ignora a quienes ya tienen balance cero dentro de un grupo mixto', () => {
    const balances = [balance('A', -30), balance('B', 0), balance('C', 30), balance('D', 0)]
    const settlements = ExpenseSplitter.simplify(balances)
    expect(settlements).toEqual([{ payer: 'A', receiver: 'C', amountCents: toCents(30) }])
  })

  it('invariante: aplicar todos los settlements deja a todos en cero', () => {
    const balances = [balance('A', -50), balance('B', 70), balance('C', -20)]
    const settlements = ExpenseSplitter.simplify(balances)

    const remaining = Object.fromEntries(balances.map((b) => [b.participantId, b.netCents]))
    for (const s of settlements) {
      remaining[s.payer] += s.amountCents
      remaining[s.receiver] -= s.amountCents
    }
    expect(Object.values(remaining).every((v) => v === 0)).toBe(true)
  })
})
