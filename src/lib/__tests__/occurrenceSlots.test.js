import { describe, it, expect } from 'vitest'
import { occurrenceSlots, getWeekKeyOf } from '../activities.js'

// Semana del lunes 2026-09-14 al domingo 2026-09-20.
const periodKey = getWeekKeyOf(new Date(2026, 8, 14))
const basura = { frequencyType: 'recurring', recurrenceUnit: 'week', weekdays: [0, 2, 4], timesPerWeek: 3 } // L M V
const done = (n) => ({ periodKey, timesDone: n })

describe('occurrenceSlots — ocasiones por día', () => {
  it('lunes: solo la primera ocasión está habilitada', () => {
    const r = occurrenceSlots(basura, done(0), '2026-09-14')
    expect(r.gated).toBe(true)
    expect(r.slots.map((s) => s.dateKey)).toEqual(['2026-09-14', '2026-09-16', '2026-09-18'])
    expect(r.slots.map((s) => s.unlocked)).toEqual([true, false, false])
    expect(r.canMark).toBe(true)
  })

  it('cumplida la del lunes, la siguiente (miércoles) sigue bloqueada hasta su día', () => {
    const r = occurrenceSlots(basura, done(1), '2026-09-15') // martes
    expect(r.canMark).toBe(false)
    expect(r.nextDateKey).toBe('2026-09-16')
  })

  it('el miércoles se habilita la segunda', () => {
    const r = occurrenceSlots(basura, done(1), '2026-09-16')
    expect(r.canMark).toBe(true)
  })

  it('una ocasión atrasada sigue pendiente y marcable (no se pierde)', () => {
    const r = occurrenceSlots(basura, done(0), '2026-09-17') // jueves, ni lunes ni miércoles hechas
    expect(r.canMark).toBe(true)
    expect(r.nextDateKey).toBe('2026-09-14')
  })

  it('con todas cumplidas ya no hay siguiente ocasión', () => {
    const r = occurrenceSlots(basura, done(3), '2026-09-20')
    expect(r.canMark).toBe(false)
    expect(r.nextDateKey).toBeNull()
  })

  it('una semanal con un solo día no se bloquea por fecha', () => {
    const compras = { frequencyType: 'recurring', recurrenceUnit: 'week', weekdays: [0], timesPerWeek: 1 }
    const r = occurrenceSlots(compras, done(0), '2026-09-13')
    expect(r.gated).toBe(false)
    expect(r.canMark).toBe(true)
  })

  it('eventos únicos y mensuales: libres hasta completarse', () => {
    const once = { frequencyType: 'once', timesPerWeek: null }
    expect(occurrenceSlots(once, { periodKey: '2026-09-20', timesDone: 0 }).canMark).toBe(true)
    expect(occurrenceSlots(once, { periodKey: '2026-09-20', timesDone: 1 }).canMark).toBe(false)
  })
})
