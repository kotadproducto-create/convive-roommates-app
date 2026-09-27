import { describe, it, expect } from 'vitest'
import { hashSeed, getMemberColor, createOrbWalker, stepOrbWalker, hexToRgba } from '../roomieColors'

/** Diferencia angular mínima con signo entre dos ángulos, siempre en (-π, π]. */
function angleDelta(a, b) {
  let d = (a - b) % (2 * Math.PI)
  if (d > Math.PI) d -= 2 * Math.PI
  if (d <= -Math.PI) d += 2 * Math.PI
  return d
}

const ids = Array.from({ length: 10 }, (_, i) => `member-${i}-${'x'.repeat(i)}`)

describe('createOrbWalker — "casa" (arranque) del punto de cada roomie en el círculo de Inicio', () => {
  it('es determinista: mismo id/índice/total siempre da el mismo arranque', () => {
    const { rand: randA, ...a } = createOrbWalker('abc-123', 1, 3)
    const { rand: randB, ...b } = createOrbWalker('abc-123', 1, 3)
    expect(a).toEqual(b)
    // Dos generadores propios, pero con la misma semilla: dan la misma secuencia.
    expect([randA(), randA(), randA()]).toEqual([randB(), randB(), randB()])
  })

  it('tamaño y posición de casa quedan dentro de los márgenes esperados', () => {
    for (const id of ids) {
      const w = createOrbWalker(id, 0, 1)
      expect(w.size).toBeGreaterThanOrEqual(34)
      expect(w.size).toBeLessThanOrEqual(60)
      expect(w.left).toBeGreaterThanOrEqual(12 - 1e-9)
      expect(w.left).toBeLessThanOrEqual(88 + 1e-9)
      expect(w.top).toBeGreaterThanOrEqual(12 - 1e-9)
      expect(w.top).toBeLessThanOrEqual(88 + 1e-9)
    }
  })

  it('arranca exactamente en su casa (x=0, y=0): el paseo parte de ahí, nunca de otro lado', () => {
    for (const id of ids) {
      const w = createOrbWalker(id, 2, 5)
      expect(w.x).toBe(0)
      expect(w.y).toBe(0)
    }
  })

  it('la casa de cada persona cae dentro de su propio sector (nunca invade el de otra)', () => {
    for (const total of [2, 3, 4, 5]) {
      const sector = (2 * Math.PI) / total
      for (let index = 0; index < total; index++) {
        const center = index * sector
        for (const id of ids) {
          const w = createOrbWalker(id, index, total)
          const angle = Math.atan2(w.top - 50, w.left - 50)
          expect(Math.abs(angleDelta(angle, center))).toBeLessThanOrEqual(sector * 0.4 + 1e-9)
        }
      }
    }
  })

  it('con pocos miembros, dos casas nunca terminan del mismo lado', () => {
    // Antes de repartir sectores, con solo 2 personas podía darse (por puro
    // azar) que las dos cayeran "del mismo lado" — ahora sus sectores (0° y
    // 180°) quedan siempre separados.
    for (const id0 of ids) {
      for (const id1 of ids) {
        if (id0 === id1) continue
        const w0 = createOrbWalker(id0, 0, 2)
        const w1 = createOrbWalker(id1, 1, 2)
        const angle0 = Math.atan2(w0.top - 50, w0.left - 50)
        const angle1 = Math.atan2(w1.top - 50, w1.left - 50)
        // Separadas por más de 18° (el colchón entre sectores de 180° cada uno).
        expect(Math.abs(angleDelta(angle0, angle1))).toBeGreaterThan((18 * Math.PI) / 180)
      }
    }
  })
})

describe('stepOrbWalker — paseo continuo cuadro a cuadro (sin saltos ni bucles)', () => {
  it('es determinista: dos paseos idénticos (mismo id) dan exactamente la misma trayectoria', () => {
    const stepsOf = (id) => {
      let w = createOrbWalker(id, 1, 3)
      const points = []
      for (let i = 0; i < 200; i++) {
        w = stepOrbWalker(w, 1 / 30)
        points.push([w.x, w.y])
      }
      return points
    }
    expect(stepsOf('persona-x')).toEqual(stepsOf('persona-x'))
  })

  it('un paso nunca es un salto: el desplazamiento no supera lo que la velocidad permite en ese tiempo', () => {
    for (const id of ids) {
      let w = createOrbWalker(id, 0, 4)
      for (let i = 0; i < 300; i++) {
        const before = { x: w.x, y: w.y }
        const dt = 1 / 30
        w = stepOrbWalker(w, dt)
        const moved = Math.hypot(w.x - before.x, w.y - before.y)
        // Margen generoso: la velocidad máxima configurable es 9px/s.
        expect(moved).toBeLessThanOrEqual(9 * dt + 1e-6)
      }
    }
  })

  it('recién en casa (sin empujón de vuelta activo), el rumbo solo gira lo que permite turnRate — nunca de golpe', () => {
    for (const id of ids) {
      const w = createOrbWalker(id, 0, 3) // x=0,y=0: todavía no dispara el empujón de "vuelta a casa"
      const dt = 1 / 30
      const next = stepOrbWalker(w, dt)
      const turned = Math.abs(angleDelta(next.angle, w.angle))
      expect(turned).toBeLessThanOrEqual(w.turnRate * dt + 1e-9)
    }
  })

  it('deambula libre pero nunca se aleja de casa indefinidamente (vuelve sola)', () => {
    for (const id of ids) {
      let w = createOrbWalker(id, 0, 3)
      let maxDist = 0
      for (let i = 0; i < 3000; i++) {
        w = stepOrbWalker(w, 1 / 30)
        maxDist = Math.max(maxDist, Math.hypot(w.x, w.y))
      }
      // Nunca se aleja mucho más allá de su propio radio de paseo.
      expect(maxDist).toBeLessThanOrEqual(w.wanderRadius * 1.5)
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
