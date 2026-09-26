import { describe, it, expect } from 'vitest'
import es from '../i18n/es'
import en from '../i18n/en'
import { notificationRoute } from '../notifications'

/**
 * Cambio de rotación directo por un admin (sin votación previa, ver
 * updateRotationOrderDirect en DataContext.jsx y RotationOrderNotice.jsx):
 * solo cubre lo que es puro y testeable sin la base — textos y el ruteo de
 * la notificación. La lógica de turnos ya la cubre publicTurns.test.js
 * (buildFloorTurnsPreview), y el flujo de UI se revisó en el navegador.
 */

const get = (dict, key) => key.split('.').reduce((o, k) => (o == null ? o : o[k]), dict)
const vars = (s) => [...s.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort().join(',')

describe('notificationRoute — cambio de rotación directo', () => {
  it('lleva a la previsualización dedicada, no a Votaciones', () => {
    expect(notificationRoute('rotation_order_updated')).toBe('/orden-actualizado')
    expect(notificationRoute('rotation_order_updated')).not.toBe('/votaciones')
  })
})

describe('textos del cambio directo de orden', () => {
  const keys = [
    'floorSettings.adminOnlyReorder',
    'floorSettings.editRotationConfirmTitle',
    'floorSettings.editRotationConfirmBody',
    'floorSettings.saveOrderButton',
    'floorSettings.orderUpdatedToast',
    'floorSettings.orderUpdateError',
    'floorSettings.suggestOrderLink',
    'floorSettings.proposeOrderHint',
    'floorSettings.proposeOrderConfirmTitle',
    'floorSettings.proposeOrderConfirmBody',
    'floorSettings.currentTurnTag',
    'floorSettings.assignTurnButton',
    'floorSettings.assignTurnTitle',
    'floorSettings.assignTurnBody',
    'floorSettings.assignTurnYes',
    'floorSettings.assignTurnWorking',
    'floorSettings.assignTurnToast',
    'rotationNotice.title',
    'rotationNotice.subtitle',
    'rotationNotice.orderTitle',
    'rotationNotice.turnsTitle',
    'rotationNotice.nowLabel',
    'rotationNotice.agree',
    'rotationNotice.agreedToast',
    'rotationNotice.suggestLink'
  ]

  it.each(keys)('%s existe en español e inglés', (key) => {
    expect(typeof get(es, key)).toBe('string')
    expect(typeof get(en, key)).toBe('string')
  })

  it('los textos con {{variables}} usan las mismas en ambos idiomas', () => {
    for (const key of keys) expect(vars(get(en, key))).toBe(vars(get(es, key)))
  })

  it('es y en tienen las mismas claves en rotationNotice', () => {
    expect(Object.keys(en.rotationNotice).sort()).toEqual(Object.keys(es.rotationNotice).sort())
  })

  it('el botón de guardar orden ya no dice siempre "Proponer cambio" (ahora depende de si vota o no)', () => {
    expect(es.floorSettings.saveOrderButton).not.toBe(es.floorSettings.proposeChangeButton)
    expect(en.floorSettings.saveOrderButton).not.toBe(en.floorSettings.proposeChangeButton)
  })
})
