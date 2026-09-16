import { describe, it, expect } from 'vitest'
import { toCents, fromCents, sumCents, allocate } from '../money.js'

describe('toCents / fromCents', () => {
  it('convierte euros a céntimos y de vuelta', () => {
    expect(toCents(40)).toBe(4000)
    expect(toCents(33.33)).toBe(3333)
    expect(toCents(0.01)).toBe(1)
    expect(fromCents(4000)).toBe(40)
    expect(fromCents(3333)).toBe(33.33)
    expect(fromCents(1)).toBe(0.01)
  })
})

describe('allocate — reparto sin perder céntimos', () => {
  it('100€ / 3 no puede dar 33.33+33.33+33.33 (perdería 1 céntimo)', () => {
    const result = allocate(10000, [1, 1, 1])
    expect(result).toEqual([3334, 3333, 3333])
    expect(sumCents(result)).toBe(10000)
  })

  it('10€ / 6', () => {
    const result = allocate(1000, [1, 1, 1, 1, 1, 1])
    expect(sumCents(result)).toBe(1000)
    // 1000/6 = 166.67 → cuatro céntimos sobrantes repartidos entre los primeros 4
    expect(result).toEqual([167, 167, 167, 167, 166, 166])
  })

  it('99.99€ / 3 reparte exacto sin sobrante', () => {
    const result = allocate(9999, [1, 1, 1])
    expect(result).toEqual([3333, 3333, 3333])
    expect(sumCents(result)).toBe(9999)
  })

  it('0.01€ entre varios participantes: solo uno recibe el céntimo, el resto 0', () => {
    const result = allocate(1, [1, 1, 1, 1])
    expect(sumCents(result)).toBe(1)
    expect(result.filter((c) => c > 0)).toHaveLength(1)
    expect(result[0]).toBe(1)
  })

  it('es determinista: mismos inputs, mismo resultado siempre', () => {
    const a = allocate(10000, [1, 1, 1])
    const b = allocate(10000, [1, 1, 1])
    expect(a).toEqual(b)
  })

  it('reparte proporcionalmente a pesos distintos (ej. porcentajes)', () => {
    const result = allocate(10000, [50, 30, 20])
    expect(result).toEqual([5000, 3000, 2000])
  })

  it('reparte proporcionalmente a shares', () => {
    // A: 2 shares, B: 1, C: 1 sobre 100€
    const result = allocate(10000, [2, 1, 1])
    expect(result).toEqual([5000, 2500, 2500])
  })
})
