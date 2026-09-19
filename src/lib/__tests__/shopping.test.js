import { describe, it, expect } from 'vitest'
import { isPendingToBuy } from '../shopping.js'

describe('isPendingToBuy', () => {
  it('lo recurrente con stock ok no está pendiente', () => {
    expect(isPendingToBuy({ recurring: true, stockLevel: 'ok' })).toBe(false)
  })
  it('lo recurrente por acabarse o agotado sí', () => {
    expect(isPendingToBuy({ recurring: true, stockLevel: 'low' })).toBe(true)
    expect(isPendingToBuy({ recurring: true, stockLevel: 'out' })).toBe(true)
  })
  it('una compra puntual siempre está pendiente mientras esté en la lista', () => {
    expect(isPendingToBuy({ recurring: false, stockLevel: 'ok' })).toBe(true)
  })
})
