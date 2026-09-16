import { describe, it, expect } from 'vitest'
import { resolvePoll, tallyVotes } from '../polls.js'

const TODAY = '2026-09-20'

function poll(overrides) {
  return { status: 'pending', resolutionMode: 'majority', deadline: null, ...overrides }
}

describe('resolvePoll — mayoría simple', () => {
  it('se resuelve en cuanto vota todo el mundo y hay mayoría', () => {
    const votes = [
      { userId: 'A', option: 'Sí' },
      { userId: 'B', option: 'Sí' },
      { userId: 'C', option: 'No' }
    ]
    const result = resolvePoll(poll({}), votes, ['A', 'B', 'C'], TODAY)
    expect(result).toEqual({ status: 'resolved', resolvedOption: 'Sí' })
  })

  it('no se resuelve mientras falte gente por votar', () => {
    const votes = [{ userId: 'A', option: 'Sí' }]
    const result = resolvePoll(poll({}), votes, ['A', 'B', 'C'], TODAY)
    expect(result).toBeNull()
  })

  it('empate: todos votaron pero nadie tiene mayoría → sigue pendiente sin plazo', () => {
    const votes = [
      { userId: 'A', option: 'Sí' },
      { userId: 'B', option: 'No' }
    ]
    const result = resolvePoll(poll({}), votes, ['A', 'B'], TODAY)
    expect(result).toBeNull()
  })
})

describe('resolvePoll — unanimidad', () => {
  it('se resuelve si todos eligen la misma opción', () => {
    const votes = [
      { userId: 'A', option: 'Sí' },
      { userId: 'B', option: 'Sí' }
    ]
    const result = resolvePoll(poll({ resolutionMode: 'unanimity' }), votes, ['A', 'B'], TODAY)
    expect(result).toEqual({ status: 'resolved', resolvedOption: 'Sí' })
  })

  it('un solo disidente bloquea la resolución aunque todos hayan votado', () => {
    const votes = [
      { userId: 'A', option: 'Sí' },
      { userId: 'B', option: 'Sí' },
      { userId: 'C', option: 'No' }
    ]
    const result = resolvePoll(poll({ resolutionMode: 'unanimity' }), votes, ['A', 'B', 'C'], TODAY)
    expect(result).toBeNull()
  })
})

describe('resolvePoll — plazo', () => {
  it('plazo vencido con votos faltantes → expirada', () => {
    const votes = [{ userId: 'A', option: 'Sí' }]
    const result = resolvePoll(poll({ deadline: '2026-09-19' }), votes, ['A', 'B'], TODAY)
    expect(result).toEqual({ status: 'expired', resolvedOption: null })
  })

  it('plazo vencido, todos votaron, pero empate → cerrada (no expirada)', () => {
    const votes = [
      { userId: 'A', option: 'Sí' },
      { userId: 'B', option: 'No' }
    ]
    const result = resolvePoll(poll({ deadline: '2026-09-19' }), votes, ['A', 'B'], TODAY)
    expect(result).toEqual({ status: 'closed', resolvedOption: null })
  })

  it('plazo todavía no vencido: no cambia nada aunque falten votos', () => {
    const votes = []
    const result = resolvePoll(poll({ deadline: '2026-09-21' }), votes, ['A', 'B'], TODAY)
    expect(result).toBeNull()
  })

  it('si se alcanza mayoría antes del plazo, se resuelve aunque el plazo siga vigente', () => {
    const votes = [
      { userId: 'A', option: 'Sí' },
      { userId: 'B', option: 'Sí' }
    ]
    const result = resolvePoll(poll({ deadline: '2026-09-21' }), votes, ['A', 'B'], TODAY)
    expect(result).toEqual({ status: 'resolved', resolvedOption: 'Sí' })
  })
})

describe('resolvePoll — casos generales', () => {
  it('una consulta que ya no está pendiente devuelve null (idempotente)', () => {
    const votes = [{ userId: 'A', option: 'Sí' }]
    expect(resolvePoll(poll({ status: 'resolved' }), votes, ['A'], TODAY)).toBeNull()
    expect(resolvePoll(poll({ status: 'closed' }), votes, ['A'], TODAY)).toBeNull()
    expect(resolvePoll(poll({ status: 'expired' }), votes, ['A'], TODAY)).toBeNull()
  })

  it('ignora votos de gente que ya no es miembro activo (ej. salió del piso)', () => {
    const votes = [
      { userId: 'A', option: 'Sí' },
      { userId: 'ghost', option: 'No' }
    ]
    // Solo A es electorado activo — con un solo voto y mayoría, se resuelve.
    const result = resolvePoll(poll({}), votes, ['A'], TODAY)
    expect(result).toEqual({ status: 'resolved', resolvedOption: 'Sí' })
  })

  it('piso sin miembros activos nunca se resuelve por mayoría (electorado vacío)', () => {
    const result = resolvePoll(poll({}), [], [], TODAY)
    expect(result).toBeNull()
  })
})

describe('tallyVotes', () => {
  it('cuenta votos por opción', () => {
    const votes = [
      { userId: 'A', option: 'Sí' },
      { userId: 'B', option: 'Sí' },
      { userId: 'C', option: 'No' }
    ]
    expect(tallyVotes(votes)).toEqual({ Sí: 2, No: 1 })
  })

  it('lista vacía da un objeto vacío', () => {
    expect(tallyVotes([])).toEqual({})
  })
})
