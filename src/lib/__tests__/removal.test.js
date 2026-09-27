import { describe, it, expect } from 'vitest'
import { REMOVAL_HOURS, removalDeadlineAt, isRemovalExpired } from '../removal'
import es from '../i18n/es'
import en from '../i18n/en'

const get = (dict, key) => key.split('.').reduce((o, k) => (o == null ? o : o[k]), dict)
const vars = (s) => [...s.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort().join(',')

describe('removalDeadlineAt / isRemovalExpired — vencimiento de una solicitud de salida (48h)', () => {
  it('la duración configurada es de 48 horas', () => {
    expect(REMOVAL_HOURS).toBe(48)
  })

  it('el vencimiento cae exactamente 48h después de la solicitud', () => {
    const requestedAt = '2026-01-01T10:00:00.000Z'
    expect(removalDeadlineAt(requestedAt)).toBe('2026-01-03T10:00:00.000Z')
  })

  it('no está vencida un instante antes del plazo', () => {
    const requestedAt = '2026-01-01T10:00:00.000Z'
    const justBefore = new Date('2026-01-03T09:59:59.999Z').getTime()
    expect(isRemovalExpired(requestedAt, justBefore)).toBe(false)
  })

  it('está vencida justo al llegar el plazo, y después', () => {
    const requestedAt = '2026-01-01T10:00:00.000Z'
    const atDeadline = new Date('2026-01-03T10:00:00.000Z').getTime()
    const after = new Date('2026-01-05T00:00:00.000Z').getTime()
    expect(isRemovalExpired(requestedAt, atDeadline)).toBe(true)
    expect(isRemovalExpired(requestedAt, after)).toBe(true)
  })

  it('sin solicitud (null/undefined) o sin nowMs numérico, nunca está vencida', () => {
    expect(isRemovalExpired(null, Date.now())).toBe(false)
    expect(isRemovalExpired(undefined, Date.now())).toBe(false)
    expect(isRemovalExpired('2026-01-01T10:00:00.000Z', undefined)).toBe(false)
  })
})

describe('i18n de la solicitud de salida con plazo', () => {
  it('perfil.removalPendingDeadline existe en ambos idiomas y usa {{date}}', () => {
    expect(typeof get(es, 'perfil.removalPendingDeadline')).toBe('string')
    expect(typeof get(en, 'perfil.removalPendingDeadline')).toBe('string')
    expect(vars(get(es, 'perfil.removalPendingDeadline'))).toBe('date')
    expect(vars(get(en, 'perfil.removalPendingDeadline'))).toBe('date')
  })

  it('floorSettings.exitPendingDeadline existe en ambos idiomas y usa {{date}}', () => {
    expect(typeof get(es, 'floorSettings.exitPendingDeadline')).toBe('string')
    expect(typeof get(en, 'floorSettings.exitPendingDeadline')).toBe('string')
    expect(vars(get(es, 'floorSettings.exitPendingDeadline'))).toBe('date')
    expect(vars(get(en, 'floorSettings.exitPendingDeadline'))).toBe('date')
  })
})
