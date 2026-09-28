import { describe, it, expect } from 'vitest'
import { INCIDENT_DURATION_OPTIONS, incidentExpiresAt, isIncidentActive, incidentExpiryMs, incidentFinishedAtMs } from '../incidents.js'

const NOW = Date.parse('2026-09-20T12:00:00Z')

describe('INCIDENT_DURATION_OPTIONS', () => {
  it('trae las 3 duraciones fijas pedidas (12h, 24h, 1 semana)', () => {
    expect(INCIDENT_DURATION_OPTIONS).toEqual([
      { key: '12h', hours: 12 },
      { key: '24h', hours: 24 },
      { key: '1w', hours: 168 }
    ])
  })
})

describe('incidentExpiresAt', () => {
  it('suma las horas indicadas al instante actual', () => {
    expect(incidentExpiresAt(12, NOW)).toBe(new Date(NOW + 12 * 3600000).toISOString())
    expect(incidentExpiresAt(24, NOW)).toBe(new Date(NOW + 24 * 3600000).toISOString())
  })
})

describe('isIncidentActive', () => {
  it('sin resolvedAt ni expiresAt: activa', () => {
    expect(isIncidentActive({ resolvedAt: null, expiresAt: null }, NOW)).toBe(true)
  })

  it('con expiresAt en el futuro: activa', () => {
    expect(isIncidentActive({ resolvedAt: null, expiresAt: new Date(NOW + 60000).toISOString() }, NOW)).toBe(true)
  })

  it('con expiresAt ya pasado: no activa (pasó al historial sola)', () => {
    expect(isIncidentActive({ resolvedAt: null, expiresAt: new Date(NOW - 60000).toISOString() }, NOW)).toBe(false)
  })

  it('con expiresAt exactamente ahora: no activa (vence en el instante, no un tick después)', () => {
    expect(isIncidentActive({ resolvedAt: null, expiresAt: new Date(NOW).toISOString() }, NOW)).toBe(false)
  })

  it('con resolvedAt: no activa aunque el plazo no haya vencido', () => {
    expect(isIncidentActive({ resolvedAt: new Date(NOW - 1000).toISOString(), expiresAt: new Date(NOW + 60000).toISOString() }, NOW)).toBe(false)
  })
})

describe('incidentExpiryMs', () => {
  it('null si no tiene plazo (solo se archiva a mano)', () => {
    expect(incidentExpiryMs({ expiresAt: null })).toBeNull()
  })

  it('el instante exacto si tiene expiresAt', () => {
    const at = new Date(NOW + 3600000).toISOString()
    expect(incidentExpiryMs({ expiresAt: at })).toBe(new Date(at).getTime())
  })
})

describe('incidentFinishedAtMs — para ordenar el historial', () => {
  it('usa resolvedAt si se marcó solucionada', () => {
    const resolvedAt = new Date(NOW + 1000).toISOString()
    expect(incidentFinishedAtMs({ resolvedAt, expiresAt: new Date(NOW + 5000).toISOString(), createdAt: new Date(NOW).toISOString() })).toBe(
      new Date(resolvedAt).getTime()
    )
  })

  it('si no se resolvió a mano, usa expiresAt (venció sola)', () => {
    const expiresAt = new Date(NOW + 2000).toISOString()
    expect(incidentFinishedAtMs({ resolvedAt: null, expiresAt, createdAt: new Date(NOW).toISOString() })).toBe(new Date(expiresAt).getTime())
  })

  it('sin resolvedAt ni expiresAt, cae a createdAt', () => {
    const createdAt = new Date(NOW).toISOString()
    expect(incidentFinishedAtMs({ resolvedAt: null, expiresAt: null, createdAt })).toBe(new Date(createdAt).getTime())
  })
})
