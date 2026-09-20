import { describe, it, expect } from 'vitest'
import { notificationRoute } from '../notifications.js'

describe('notificationRoute — a qué pantalla lleva cada notificación', () => {
  it('cada tipo va a su apartado', () => {
    expect(notificationRoute('turno')).toBe('/actividades')
    expect(notificationRoute('pote')).toBe('/pote')
    expect(notificationRoute('stock_out')).toBe('/compras')
    expect(notificationRoute('swap')).toBe('/convives')
    expect(notificationRoute('poll_created')).toBe('/votaciones')
    expect(notificationRoute('poll_resolved')).toBe('/votaciones')
    expect(notificationRoute('removal_requested')).toBe('/perfil')
    expect(notificationRoute('lavadora')).toBe('/actividades')
    expect(notificationRoute('shared_space')).toBe('/actividades')
    expect(notificationRoute('account_recovery')).toBe('/ajustes')
    expect(notificationRoute('poll_resolved_pote')).toBe('/pote')
    expect(notificationRoute('poll_resolved_rotation')).toBe('/piso')
  })
  it('un tipo desconocido no lleva a ningún lado', () => {
    expect(notificationRoute('algo_nuevo')).toBeNull()
    expect(notificationRoute(undefined)).toBeNull()
  })
})
