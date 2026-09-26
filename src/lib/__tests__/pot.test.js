import { describe, it, expect } from 'vitest'
import { formatMoney, formatEuros, potAmountColorClass, isPotAdjustment } from '../pot'

describe('formatMoney — todo importe del Pote se muestra con exactamente 2 decimales', () => {
  it('los ejemplos del pedido, tal cual', () => {
    expect(formatMoney(0)).toBe('0,00')
    expect(formatMoney(5)).toBe('5,00')
    expect(formatMoney(12.5)).toBe('12,50')
    expect(formatMoney(25.75)).toBe('25,75')
  })

  it('nunca más de 2 decimales, aunque el número interno tenga más', () => {
    expect(formatMoney(12.3456789)).toBe('12,35')
    expect(formatMoney(0.005)).toBe('0,01')
    expect(formatMoney(1 / 3)).toBe('0,33')
  })

  it('en español usa coma; en inglés, punto', () => {
    expect(formatMoney(12.5, 'es')).toBe('12,50')
    expect(formatMoney(12.5, 'en')).toBe('12.50')
    expect(formatMoney(0, 'en')).toBe('0.00')
  })

  it('español por defecto si no se indica idioma', () => {
    expect(formatMoney(3)).toBe('3,00')
  })

  it('negativos conservan el signo, pero nunca un "-0,00"', () => {
    expect(formatMoney(-12.5)).toBe('-12,50')
    expect(formatMoney(-0.001)).toBe('0,00')
    expect(formatMoney(-0)).toBe('0,00')
  })

  it('un valor no numérico (undefined, NaN, texto) se muestra como 0,00, nunca "NaN" ni más de 2 decimales', () => {
    expect(formatMoney(undefined)).toBe('0,00')
    expect(formatMoney(null)).toBe('0,00')
    expect(formatMoney('')).toBe('0,00')
    expect(formatMoney('abc')).toBe('0,00')
    expect(formatMoney(NaN)).toBe('0,00')
  })

  it('acepta un número en texto (p.ej. lo que llega de un <input>)', () => {
    expect(formatMoney('12.5')).toBe('12,50')
    expect(formatMoney('0')).toBe('0,00')
  })

  it('no altera el número que se le pasa (es solo para mostrar)', () => {
    const original = 12.3456789
    formatMoney(original)
    expect(original).toBe(12.3456789)
  })
})

describe('formatEuros — formatMoney + símbolo, con espacio', () => {
  it('arma "importe €" para los ejemplos del pedido', () => {
    expect(formatEuros(0)).toBe('0,00 €')
    expect(formatEuros(5)).toBe('5,00 €')
    expect(formatEuros(12.5)).toBe('12,50 €')
    expect(formatEuros(25.75)).toBe('25,75 €')
  })

  it('respeta el idioma', () => {
    expect(formatEuros(12.5, 'en')).toBe('12.50 €')
  })
})

describe('potAmountColorClass e isPotAdjustment siguen igual (no se tocó la lógica, solo el texto)', () => {
  it('semáforo de color', () => {
    expect(potAmountColorClass(-5)).toBe('text-clay-500')
    expect(potAmountColorClass(2)).toBe('text-gold-500')
    expect(potAmountColorClass(20)).toBe('text-sage-500')
  })

  it('un ajuste manual se distingue de un aporte/gasto normal', () => {
    expect(isPotAdjustment({ kind: 'adjustment' })).toBe(true)
    expect(isPotAdjustment({ kind: 'contribution' })).toBe(false)
  })
})
