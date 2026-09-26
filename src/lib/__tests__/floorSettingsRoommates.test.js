import { describe, it, expect } from 'vitest'
import es from '../i18n/es'
import en from '../i18n/en'

/**
 * Lista de "Tu piso" → Roommates: avatar + "Miembro desde" (joinedAt), para
 * poder distinguir cuentas duplicadas de la misma persona (la más nueva
 * suele ser la que sobra). Solo cubre el texto — el avatar y la fecha en sí
 * ya vienen de getFloorMembers (lib/db.js), sin SQL nuevo.
 */
const get = (dict, key) => key.split('.').reduce((o, k) => (o == null ? o : o[k]), dict)
const vars = (s) => [...s.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort().join(',')

describe('floorSettings.memberSince', () => {
  it('existe en español e inglés y usa la misma variable {{date}}', () => {
    expect(typeof get(es, 'floorSettings.memberSince')).toBe('string')
    expect(typeof get(en, 'floorSettings.memberSince')).toBe('string')
    expect(vars(get(es, 'floorSettings.memberSince'))).toBe('date')
    expect(vars(get(en, 'floorSettings.memberSince'))).toBe('date')
  })
})
