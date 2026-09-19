import { describe, it, expect } from 'vitest'
import { occurrenceSlots, occurrencePoints, activeRoutineMarks, getWeekKeyOf } from '../activities.js'

describe('occurrencePoints — puntos por ocasión, para quien la ejecuta', () => {
  it('reparte los puntos enteros sin perder ninguno', () => {
    const parts = [0, 1, 2].map((i) => occurrencePoints(5, i, 3))
    expect(parts).toEqual([2, 2, 1])
    expect(parts.reduce((a, b) => a + b, 0)).toBe(5)
  })
  it('una sola ocasión da todos los puntos', () => {
    expect(occurrencePoints(15, 0, 1)).toBe(15)
  })
  it('sin puntos configurados no da nada', () => {
    expect(occurrencePoints(null, 0, 3)).toBe(0)
    expect(occurrencePoints(0, 1, 3)).toBe(0)
  })
})

describe('activeRoutineMarks — cada deshacer anula la marca más reciente', () => {
  const m = (id, kind, min) => ({ id, kind, completionId: 'c1', createdAt: new Date(Date.UTC(2026, 8, 19, 10, min)).toISOString() })
  it('R1 R2 U R3 deja vigentes R1 y R3 (la de arriba es R3)', () => {
    const stack = activeRoutineMarks([m('R1', 'routine', 0), m('R2', 'routine', 1), m('U', 'undo', 2), m('R3', 'routine', 3)], 'c1')
    expect(stack.map((x) => x.id)).toEqual(['R1', 'R3'])
  })
  it('ignora extras y marcas de otros turnos', () => {
    const stack = activeRoutineMarks([m('E', 'extra', 0), { ...m('X', 'routine', 1), completionId: 'c2' }, m('R1', 'routine', 2)], 'c1')
    expect(stack.map((x) => x.id)).toEqual(['R1'])
  })
})

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
