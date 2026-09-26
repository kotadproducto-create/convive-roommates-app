import { describe, it, expect } from 'vitest'
import { globalPeriodIndex, floorKeeperFor, floorKeeperIndex, assigneeFor, nextOccurrence, rotationPick } from '../activities.js'

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

describe('floorKeeperFor — persona encargada del piso esta semana', () => {
  const order = ['A', 'B', 'C']

  it('en modo normal avanza una persona por semana, en el orden de rotación', () => {
    const w1 = floorKeeperFor({ rotationMode: 'random' }, order, '2026-W37')
    const w2 = floorKeeperFor({ rotationMode: 'random' }, order, '2026-W38')
    expect(order.includes(w1)).toBe(true)
    expect(w2).toBe(order[(order.indexOf(w1) + 1) % 3])
  })

  it('coincide con quien tiene asignada una actividad semanal por rotación', () => {
    const weekly = { frequencyType: 'recurring', recurrenceUnit: 'week', assignmentMode: 'rotation', weekdays: [0], startDate: '2026-09-14' }
    for (const weekKey of ['2026-W37', '2026-W38', '2026-W39']) {
      expect(floorKeeperFor({ rotationMode: 'random' }, order, weekKey)).toBe(assigneeFor(weekly, order, weekKey, { rotationMode: 'random' }))
    }
  })

  it('en modo Determinado (cada 2 semanas) la misma persona sigue al cargo dos semanas', () => {
    const floor = { rotationMode: 'period', rotationPeriodUnit: 'week', rotationPeriodInterval: 2, rotationEpoch: '2026-09-14' }
    const first = floorKeeperFor(floor, order, '2026-W38') // semana del epoch
    expect(floorKeeperFor(floor, order, '2026-W39')).toBe(first)
    expect(floorKeeperFor(floor, order, '2026-W40')).toBe(order[(order.indexOf(first) + 1) % 3])
  })

  it('sin nadie en la rotación no hay persona encargada', () => {
    expect(floorKeeperFor({}, [], '2026-W37')).toBeNull()
  })
})

describe('rotationOffset — asignar el turno actual a mano (setCurrentTurn)', () => {
  const order = ['A', 'B', 'C']

  it('rotationPick sin offset se comporta exactamente igual que antes', () => {
    expect(rotationPick(order, 0)).toBe('A')
    expect(rotationPick(order, 1)).toBe('B')
    expect(rotationPick(order, 4)).toBe('B')
  })

  it('un offset corre el turno esa cantidad de posiciones, sin tocar el orden', () => {
    expect(rotationPick(order, 0, 1)).toBe('B')
    expect(rotationPick(order, 0, 2)).toBe('C')
    expect(rotationPick(order, 1, 1)).toBe('C')
  })

  it('el offset da la vuelta igual de bien con números negativos o mayores que el largo', () => {
    expect(rotationPick(order, 0, -1)).toBe('C')
    expect(rotationPick(order, 0, 3)).toBe('A')
    expect(rotationPick(order, 0, 30)).toBe('A')
  })

  it('floorKeeperIndex es el índice CRUDO (sin offset) que usa floorKeeperFor', () => {
    const floor = { rotationMode: 'random' }
    const raw = floorKeeperIndex(floor, '2026-W38')
    expect(floorKeeperFor(floor, order, '2026-W38')).toBe(rotationPick(order, raw))
    expect(floorKeeperFor({ ...floor, rotationOffset: 1 }, order, '2026-W38')).toBe(rotationPick(order, raw, 1))
  })

  it('el mismo offset se aplica por igual al encargado del piso y a una actividad semanal por rotación (coherencia)', () => {
    const weekly = { frequencyType: 'recurring', recurrenceUnit: 'week', assignmentMode: 'rotation', weekdays: [0], startDate: '2026-09-14' }
    const floor = { rotationMode: 'random', rotationOffset: 2 }
    for (const weekKey of ['2026-W37', '2026-W38', '2026-W39']) {
      expect(floorKeeperFor(floor, order, weekKey)).toBe(assigneeFor(weekly, order, weekKey, floor))
    }
  })

  it('el offset también corre el PRÓXIMO turno (nextOccurrence), no solo el actual', () => {
    const weekly = { frequencyType: 'recurring', recurrenceUnit: 'week', assignmentMode: 'rotation', weekdays: [0], startDate: '2026-09-14' }
    const withoutOffset = nextOccurrence(weekly, order, new Date('2026-09-14T12:00:00'), null, { rotationMode: 'random' })
    const withOffset = nextOccurrence(weekly, order, new Date('2026-09-14T12:00:00'), null, { rotationMode: 'random', rotationOffset: 1 })
    expect(withOffset.assignedUserId).toBe(order[(order.indexOf(withoutOffset.assignedUserId) + 1) % 3])
  })

  it('en modo Determinado, el offset se suma sobre el reloj global (no lo reemplaza)', () => {
    const floor = { rotationMode: 'period', rotationPeriodUnit: 'week', rotationPeriodInterval: 2, rotationEpoch: '2026-09-14', rotationOffset: 1 }
    const first = floorKeeperFor(floor, order, '2026-W38')
    expect(floorKeeperFor(floor, order, '2026-W39')).toBe(first) // sigue las mismas 2 semanas de siempre
    expect(floorKeeperFor({ ...floor, rotationOffset: 0 }, order, '2026-W38')).toBe(order[(order.indexOf(first) + 2) % 3]) // -1 de offset = +2 mod 3
  })

  // Misma cuenta que hace setCurrentTurn en DataContext.jsx: a partir del
  // índice CRUDO (sin offset) y de la posición de la persona elegida, calcula
  // qué offset hace que le toque a ella ahora mismo.
  function offsetToAssign(floor, rotationOrder, weekKey, personId) {
    const raw = floorKeeperIndex(floor, weekKey)
    const pos = rotationOrder.indexOf(personId)
    const len = rotationOrder.length
    return (((pos - raw) % len) + len) % len
  }

  it('setCurrentTurn: el offset calculado hace que le toque exactamente a la persona elegida', () => {
    const floor = { rotationMode: 'random' }
    for (const weekKey of ['2026-W37', '2026-W38', '2026-W39', '2026-W40']) {
      for (const person of order) {
        const offset = offsetToAssign(floor, order, weekKey, person)
        expect(floorKeeperFor({ ...floor, rotationOffset: offset }, order, weekKey)).toBe(person)
      }
    }
  })

  it('setCurrentTurn: también funciona en modo Determinado', () => {
    const floor = { rotationMode: 'period', rotationPeriodUnit: 'month', rotationPeriodInterval: 1, rotationEpoch: '2026-01-01' }
    const offset = offsetToAssign(floor, order, '2026-W38', 'C')
    expect(floorKeeperFor({ ...floor, rotationOffset: offset }, order, '2026-W38')).toBe('C')
  })
})
