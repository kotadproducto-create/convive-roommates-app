import { describe, it, expect } from 'vitest'
import { hashSeed, getMemberColor, getOrbMotion, hexToRgba } from '../roomieColors'

/** Diferencia angular mínima con signo entre dos ángulos, siempre en (-π, π]. */
function angleDelta(a, b) {
  let d = (a - b) % (2 * Math.PI)
  if (d > Math.PI) d -= 2 * Math.PI
  if (d <= -Math.PI) d += 2 * Math.PI
  return d
}

const ids = Array.from({ length: 10 }, (_, i) => `member-${i}-${'x'.repeat(i)}`)

describe('getOrbMotion — recorrido del punto de cada roomie en el círculo de Inicio', () => {
  it('es determinista: mismo id/índice/total siempre da el mismo recorrido', () => {
    const a = getOrbMotion('abc-123', 1, 3)
    const b = getOrbMotion('abc-123', 1, 3)
    expect(a).toEqual(b)
  })

  it('tamaño y posición inicial quedan dentro de los márgenes de siempre', () => {
    for (const id of ids) {
      const m = getOrbMotion(id, 0, 1)
      expect(m.size).toBeGreaterThanOrEqual(34)
      expect(m.size).toBeLessThanOrEqual(60)
      expect(m.left).toBeGreaterThanOrEqual(18)
      expect(m.left).toBeLessThanOrEqual(82)
      expect(m.top).toBeGreaterThanOrEqual(18)
      expect(m.top).toBeLessThanOrEqual(82)
    }
  })

  it('cada tramo del recorrido se queda dentro del radio máximo de siempre (26px)', () => {
    for (const id of ids) {
      const m = getOrbMotion(id, 3, 7)
      for (const [dx, dy] of [
        [m.dx1, m.dy1],
        [m.dx2, m.dy2],
        [m.dx3, m.dy3]
      ]) {
        const radius = Math.hypot(dx, dy)
        expect(radius).toBeLessThanOrEqual(26 + 1e-9)
        expect(radius).toBeGreaterThanOrEqual(13 - 1e-9)
      }
    }
  })

  it('cada persona se mueve dentro de su propio sector (nunca invade el de otra)', () => {
    for (const total of [2, 3, 4, 5]) {
      const sector = (2 * Math.PI) / total
      for (let index = 0; index < total; index++) {
        const center = index * sector
        for (const id of ids) {
          const m = getOrbMotion(id, index, total)
          for (const [dx, dy] of [
            [m.dx1, m.dy1],
            [m.dx2, m.dy2],
            [m.dx3, m.dy3]
          ]) {
            const angle = Math.atan2(dy, dx)
            expect(Math.abs(angleDelta(angle, center))).toBeLessThanOrEqual(sector * 0.45 + 1e-9)
          }
        }
      }
    }
  })

  it('con pocos miembros, dos personas nunca terminan apuntando al mismo lado', () => {
    // Antes de repartir sectores, con solo 2 personas podía darse (por puro
    // azar) que ambas se movieran "hacia el mismo lado" la mitad de las
    // veces — ahora sus sectores (0° y 180°) quedan siempre separados.
    for (const id0 of ids) {
      for (const id1 of ids) {
        if (id0 === id1) continue
        const m0 = getOrbMotion(id0, 0, 2)
        const m1 = getOrbMotion(id1, 1, 2)
        const angle0 = Math.atan2(m0.dy1, m0.dx1)
        const angle1 = Math.atan2(m1.dy1, m1.dx1)
        // Separadas por más de 18° (el colchón entre sectores de 180° cada uno).
        expect(Math.abs(angleDelta(angle0, angle1))).toBeGreaterThan((18 * Math.PI) / 180)
      }
    }
  })
})

describe('hexToRgba — color de un miembro con transparencia (anillos/resplandores)', () => {
  it('convierte #rrggbb a rgba con el alpha pedido', () => {
    expect(hexToRgba('#ff0000', 0.4)).toBe('rgba(255, 0, 0, 0.4)')
    expect(hexToRgba('#00FF00', 1)).toBe('rgba(0, 255, 0, 1)')
  })

  it('alpha por defecto es 1', () => {
    expect(hexToRgba('#123456')).toBe('rgba(18, 52, 86, 1)')
  })

  it('un color que no es "#rrggbb" no rompe el render: cae a negro con esa opacidad', () => {
    expect(hexToRgba('not-a-color', 0.5)).toBe('rgba(0, 0, 0, 0.5)')
    expect(hexToRgba(null, 0.5)).toBe('rgba(0, 0, 0, 0.5)')
    expect(hexToRgba(undefined, 0.5)).toBe('rgba(0, 0, 0, 0.5)')
  })
})

describe('getMemberColor / hashSeed — sin cambios de comportamiento', () => {
  it('mismo string siempre da el mismo hash', () => {
    expect(hashSeed('abc')).toBe(hashSeed('abc'))
  })

  it('usa el color elegido si existe, o uno de respaldo estable si no', () => {
    expect(getMemberColor({ id: 'x', color: '#123456' })).toBe('#123456')
    expect(getMemberColor({ id: 'x' })).toBe(getMemberColor({ id: 'x' }))
  })
})
