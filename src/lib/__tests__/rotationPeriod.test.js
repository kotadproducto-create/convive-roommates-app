import { describe, it, expect } from 'vitest'
import { globalPeriodIndex } from '../activities.js'

describe('globalPeriodIndex — reloj de turno global del piso (modo Determinado)', () => {
  it('semanal (unidad por defecto), intervalo 1: misma semana del epoch → índice 0', () => {
    const floor = { rotationEpoch: '2026-09-14', rotationPeriodUnit: 'week', rotationPeriodInterval: 1 }
    expect(globalPeriodIndex(floor, new Date('2026-09-14T00:00:00'))).toBe(0)
    expect(globalPeriodIndex(floor, new Date('2026-09-20T00:00:00'))).toBe(0) // domingo, misma semana ISO
  })

  it('semanal, intervalo 1: una semana después → índice 1', () => {
    const floor = { rotationEpoch: '2026-09-14', rotationPeriodUnit: 'week', rotationPeriodInterval: 1 }
    expect(globalPeriodIndex(floor, new Date('2026-09-21T00:00:00'))).toBe(1)
  })

  it('semanal, intervalo 2: el turno solo avanza cada 2 semanas', () => {
    const floor = { rotationEpoch: '2026-09-14', rotationPeriodUnit: 'week', rotationPeriodInterval: 2 }
    expect(globalPeriodIndex(floor, new Date('2026-09-21T00:00:00'))).toBe(0) // 1 semana: todavía no alcanza
    expect(globalPeriodIndex(floor, new Date('2026-09-28T00:00:00'))).toBe(1) // 2 semanas: recién ahí avanza
  })

  it('mensual: cuenta meses de calendario, no días', () => {
    const floor = { rotationEpoch: '2026-01-15', rotationPeriodUnit: 'month', rotationPeriodInterval: 1 }
    expect(globalPeriodIndex(floor, new Date('2026-01-31T00:00:00'))).toBe(0)
    expect(globalPeriodIndex(floor, new Date('2026-03-01T00:00:00'))).toBe(2)
  })

  it('diario, intervalo 3: avanza cada 3 días', () => {
    const floor = { rotationEpoch: '2026-09-14', rotationPeriodUnit: 'day', rotationPeriodInterval: 3 }
    expect(globalPeriodIndex(floor, new Date('2026-09-16T00:00:00'))).toBe(0)
    expect(globalPeriodIndex(floor, new Date('2026-09-17T00:00:00'))).toBe(1)
  })

  it('anual: cuenta años de calendario', () => {
    const floor = { rotationEpoch: '2025-01-01', rotationPeriodUnit: 'year', rotationPeriodInterval: 1 }
    expect(globalPeriodIndex(floor, new Date('2026-06-01T00:00:00'))).toBe(1)
  })

  it('sin rotationEpoch configurado, usa la fecha recibida como referencia (índice 0 para esa misma fecha)', () => {
    const floor = { rotationPeriodUnit: 'week', rotationPeriodInterval: 1 }
    const date = new Date('2026-09-14T00:00:00')
    expect(globalPeriodIndex(floor, date)).toBe(0)
  })
})
