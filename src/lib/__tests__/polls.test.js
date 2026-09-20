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

describe('resolvePoll — deadlineAt (plazo preciso, ej. aprobación de orden de rotación)', () => {
  const NOW = new Date('2026-09-20T15:00:00Z').getTime()

  it('plazo por timestamp vencido, con votos faltantes → expirada', () => {
    const votes = [{ userId: 'A', option: 'Aprobar' }]
    const result = resolvePoll(poll({ deadlineAt: '2026-09-20T14:00:00Z' }), votes, ['A', 'B'], TODAY, NOW)
    expect(result).toEqual({ status: 'expired', resolvedOption: null })
  })

  it('plazo por timestamp todavía no vencido, aunque falten votos: no cambia nada', () => {
    const votes = []
    const result = resolvePoll(poll({ deadlineAt: '2026-09-20T16:00:00Z' }), votes, ['A', 'B'], TODAY, NOW)
    expect(result).toBeNull()
  })

  it('deadlineAt tiene prioridad sobre deadline (fecha) cuando ambos están presentes', () => {
    const votes = [{ userId: 'A', option: 'Aprobar' }]
    // deadline (fecha) todavía no venció hoy, pero deadlineAt (hora exacta) sí.
    const result = resolvePoll(poll({ deadline: '2026-09-21', deadlineAt: '2026-09-20T14:00:00Z' }), votes, ['A', 'B'], TODAY, NOW)
    expect(result).toEqual({ status: 'expired', resolvedOption: null })
  })

  it('mayoría alcanzada antes del plazo se resuelve igual, sin necesitar nowMs', () => {
    const votes = [
      { userId: 'A', option: 'Aprobar' },
      { userId: 'B', option: 'Aprobar' }
    ]
    const result = resolvePoll(poll({ deadlineAt: '2026-09-20T16:00:00Z' }), votes, ['A', 'B'], TODAY, NOW)
    expect(result).toEqual({ status: 'resolved', resolvedOption: 'Aprobar' })
  })
})

describe('resolvePoll — veto (kind pot_adjustment: todos aprueban, un "Rechazar" la tumba)', () => {
  const potPoll = (extra) => poll({ kind: 'pot_adjustment', resolutionMode: 'unanimity', ...extra })

  it('un solo "Rechazar" la resuelve al instante, aunque falten votos', () => {
    const votes = [
      { userId: 'A', option: 'Aprobar' },
      { userId: 'B', option: 'Rechazar' }
    ]
    const result = resolvePoll(potPoll({}), votes, ['A', 'B', 'C'], TODAY)
    expect(result).toEqual({ status: 'resolved', resolvedOption: 'Rechazar' })
  })

  it('con todos aprobando (unanimidad) se resuelve "Aprobar"', () => {
    const votes = [
      { userId: 'A', option: 'Aprobar' },
      { userId: 'B', option: 'Aprobar' }
    ]
    expect(resolvePoll(potPoll({}), votes, ['A', 'B'], TODAY)).toEqual({ status: 'resolved', resolvedOption: 'Aprobar' })
  })

  it('mientras falte alguien por aprobar y nadie rechazó, sigue pendiente', () => {
    const votes = [{ userId: 'A', option: 'Aprobar' }]
    expect(resolvePoll(potPoll({}), votes, ['A', 'B'], TODAY)).toBeNull()
  })

  it('el "Rechazar" de alguien que ya no es miembro activo no cuenta', () => {
    const votes = [
      { userId: 'A', option: 'Aprobar' },
      { userId: 'ghost', option: 'Rechazar' }
    ]
    expect(resolvePoll(potPoll({}), votes, ['A'], TODAY)).toEqual({ status: 'resolved', resolvedOption: 'Aprobar' })
  })

  it('en una consulta normal (kind custom) "Rechazar" no tiene poder de veto', () => {
    const votes = [
      { userId: 'A', option: 'Aprobar' },
      { userId: 'B', option: 'Rechazar' }
    ]
    expect(resolvePoll(poll({ kind: 'custom' }), votes, ['A', 'B', 'C'], TODAY)).toBeNull()
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

describe('resolvePoll — reinicio de saldo para todos (balance_reset)', () => {
  const resetPoll = (o = {}) => poll({ kind: 'balance_reset', ...o })

  it('una mayoría de "Aprobar" NO la resuelve: cada quien decide por sí mismo', () => {
    const votes = [
      { userId: 'A', option: 'Aprobar' },
      { userId: 'B', option: 'Aprobar' }
    ]
    expect(resolvePoll(resetPoll(), votes, ['A', 'B', 'C'], TODAY)).toBeNull()
  })

  it('un "Rechazar" tampoco la tumba (no hay veto): los demás aún pueden aprobar', () => {
    const votes = [{ userId: 'A', option: 'Rechazar' }]
    expect(resolvePoll(resetPoll(), votes, ['A', 'B', 'C'], TODAY)).toBeNull()
  })

  it('termina cuando ya votaron todos, sin ganador', () => {
    const votes = [
      { userId: 'A', option: 'Aprobar' },
      { userId: 'B', option: 'Rechazar' },
      { userId: 'C', option: 'Aprobar' }
    ]
    expect(resolvePoll(resetPoll(), votes, ['A', 'B', 'C'], TODAY)).toEqual({ status: 'resolved', resolvedOption: null })
  })

  it('vence el plazo con gente sin votar → expired', () => {
    const votes = [{ userId: 'A', option: 'Aprobar' }]
    const late = resetPoll({ deadlineAt: '2026-09-20T10:00:00Z' })
    expect(resolvePoll(late, votes, ['A', 'B'], TODAY, Date.parse('2026-09-20T12:00:00Z'))).toEqual({
      status: 'expired',
      resolvedOption: null
    })
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
