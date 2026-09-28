import { describe, it, expect } from 'vitest'
import { RULE_CATEGORIES, RULE_CATEGORY_KEYS, latestAcceptedVersion, needsToAcceptRules, isNewToRules } from '../houseRules.js'

describe('RULE_CATEGORIES', () => {
  it('trae las 8 categorías con clave e ícono', () => {
    expect(RULE_CATEGORIES).toHaveLength(8)
    expect(RULE_CATEGORY_KEYS).toEqual([
      'limpieza',
      'espacios_comunes',
      'compras',
      'pote',
      'basura',
      'convivencia',
      'estado_piso',
      'ausencias'
    ])
    for (const c of RULE_CATEGORIES) {
      expect(typeof c.icon).toBe('string')
      expect(typeof c.labelKey).toBe('string')
    }
  })
})

describe('latestAcceptedVersion', () => {
  it('null si nunca aceptó nada', () => {
    expect(latestAcceptedVersion([], 'u1')).toBeNull()
    expect(latestAcceptedVersion([{ userId: 'u2', rulesVersion: 3 }], 'u1')).toBeNull()
  })

  it('la más alta entre sus propias filas, ignorando las de otros', () => {
    const acceptances = [
      { userId: 'u1', rulesVersion: 1 },
      { userId: 'u1', rulesVersion: 3 },
      { userId: 'u1', rulesVersion: 2 },
      { userId: 'u2', rulesVersion: 5 }
    ]
    expect(latestAcceptedVersion(acceptances, 'u1')).toBe(3)
  })
})

describe('needsToAcceptRules', () => {
  it('sin normas todavía (rulesVersion 0 o sin definir): nunca bloquea', () => {
    expect(needsToAcceptRules([], 'u1', 0)).toBe(false)
    expect(needsToAcceptRules([], 'u1', undefined)).toBe(false)
    expect(needsToAcceptRules([], 'u1', null)).toBe(false)
  })

  it('hay normas y nunca aceptó ninguna: le falta', () => {
    expect(needsToAcceptRules([], 'u1', 2)).toBe(true)
  })

  it('aceptó una versión vieja: le falta la nueva', () => {
    const acceptances = [{ userId: 'u1', rulesVersion: 1 }]
    expect(needsToAcceptRules(acceptances, 'u1', 2)).toBe(true)
  })

  it('ya aceptó la versión vigente: no le falta', () => {
    const acceptances = [{ userId: 'u1', rulesVersion: 2 }]
    expect(needsToAcceptRules(acceptances, 'u1', 2)).toBe(false)
  })
})

describe('isNewToRules — distingue "recién llegado" de "ya las conocía"', () => {
  it('sin ninguna fila de aceptación: es nuevo', () => {
    expect(isNewToRules([], 'u1')).toBe(true)
  })

  it('con al menos una fila (aunque sea de una versión vieja): no es nuevo', () => {
    expect(isNewToRules([{ userId: 'u1', rulesVersion: 1 }], 'u1')).toBe(false)
  })
})
