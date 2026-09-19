import { describe, it, expect } from 'vitest'
import { computeWallets } from '../wallets.js'

const A = { id: 'A', joinedAt: '2026-01-01T00:00:00Z' }
const B = { id: 'B', joinedAt: '2026-01-01T00:00:00Z' }
const C = { id: 'C', joinedAt: '2026-01-01T00:00:00Z' }

let n = 0
const mov = (userId, amount, extra = {}) => ({
  userId,
  amount,
  createdAt: new Date(Date.UTC(2026, 5, 1, 0, n++)).toISOString(),
  ...extra
})

describe('computeWallets', () => {
  it('un aporte suma el monto COMPLETO a quien aporta y no afecta a nadie más', () => {
    const w = computeWallets([A, B, C], [mov('A', 30)])
    expect(w.A.balance).toBe(30)
    expect(w.B.balance).toBe(0)
    expect(w.C.balance).toBe(0)
  })

  it('un gasto se reparte en partes iguales entre todos y se resta de cada wallet', () => {
    const w = computeWallets([A, B, C], [mov('A', 30), mov('B', 30), mov('C', 30), mov('A', -30)])
    // cada uno aportó 30 y le toca 10 del gasto
    expect(w.A).toEqual({ contributed: 30, expenseShare: 10, balance: 20 })
    expect(w.B.balance).toBe(20)
    expect(w.C.balance).toBe(20)
  })

  it('quien registra el gasto no paga más que los demás', () => {
    const w = computeWallets([A, B], [mov('A', -10)])
    expect(w.A.balance).toBe(-5)
    expect(w.B.balance).toBe(-5)
  })

  it('las wallets se pueden ir a negativo si el gasto supera lo aportado', () => {
    const w = computeWallets([A, B], [mov('A', 4), mov('B', -20)])
    expect(w.A.balance).toBe(-6) // 4 - 10
    expect(w.B.balance).toBe(-10)
  })

  it('reparto exacto al céntimo: la suma de las partes es el gasto', () => {
    const members = [A, B, C]
    const w = computeWallets(members, [mov('A', -10)])
    const total = members.reduce((s, m) => s + w[m.id].expenseShare, 0)
    expect(Math.round(total * 100)).toBe(1000)
    const shares = members.map((m) => Math.round(w[m.id].expenseShare * 100)).sort()
    expect(shares).toEqual([333, 333, 334])
  })

  it('el céntimo sobrante rota entre gastos en vez de caer siempre en la misma persona', () => {
    const w = computeWallets([A, B, C], [mov('A', -0.01), mov('A', -0.01), mov('A', -0.01)])
    const shares = [A, B, C].map((m) => Math.round(w[m.id].expenseShare * 100))
    expect(shares).toEqual([1, 1, 1])
  })

  it('un gasto anterior a que alguien se uniera no se le cobra', () => {
    const late = { id: 'L', joinedAt: '2026-12-01T00:00:00Z' }
    const w = computeWallets([A, B, late], [mov('A', -10)])
    expect(w.A.balance).toBe(-5)
    expect(w.B.balance).toBe(-5)
    expect(w.L.balance).toBe(0)
  })

  it('los ajustes manuales del Pote no tocan ninguna wallet', () => {
    const w = computeWallets([A, B], [mov('A', 50, { kind: 'adjustment' }), mov('B', -20, { kind: 'adjustment' })])
    expect(w.A.balance).toBe(0)
    expect(w.B.balance).toBe(0)
  })

  it('sin movimientos, todas en 0', () => {
    const w = computeWallets([A, B], [])
    expect(w).toEqual({
      A: { contributed: 0, expenseShare: 0, balance: 0 },
      B: { contributed: 0, expenseShare: 0, balance: 0 }
    })
  })
})
