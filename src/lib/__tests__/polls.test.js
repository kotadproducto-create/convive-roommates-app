import { describe, it, expect } from 'vitest'
import { resolvePoll, tallyVotes, pollDeadlineAt, pollDeadlineMs, formatCountdown, POLL_DURATION_OPTIONS, DEFAULT_POLL_HOURS, ROTATION_POLL_HOURS } from '../polls.js'
import es from '../i18n/es'
import en from '../i18n/en'

const get = (dict, key) => key.split('.').reduce((o, k) => (o == null ? o : o[k]), dict)
const vars = (s) => [...s.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort().join(',')

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

  it('se resuelve en cuanto se alcanza la mitad + 1 del PADRÓN, sin esperar a que voten todos (6 electores, 4 a favor)', () => {
    const votes = [
      { userId: 'A', option: 'Sí' },
      { userId: 'B', option: 'Sí' },
      { userId: 'C', option: 'Sí' },
      { userId: 'D', option: 'Sí' }
      // E y F todavía no votaron
    ]
    const result = resolvePoll(poll({}), votes, ['A', 'B', 'C', 'D', 'E', 'F'], TODAY)
    expect(result).toEqual({ status: 'resolved', resolvedOption: 'Sí' })
  })

  it('con 10 electores hacen falta 6 a favor, no menos', () => {
    const fiveVotes = Array.from({ length: 5 }, (_, i) => ({ userId: `m${i}`, option: 'Sí' }))
    const electorate10 = Array.from({ length: 10 }, (_, i) => `m${i}`)
    // 5 de 10: todavía no alcanza (hace falta más de la mitad, o sea 6).
    expect(resolvePoll(poll({}), fiveVotes, electorate10, TODAY)).toBeNull()
    const sixVotes = [...fiveVotes, { userId: 'm5', option: 'Sí' }]
    expect(resolvePoll(poll({}), sixVotes, electorate10, TODAY)).toEqual({ status: 'resolved', resolvedOption: 'Sí' })
  })

  it('lo mismo vale para "Rechazar": si junta la mayoría del padrón, tumba la consulta sin esperar a los demás', () => {
    const votes = [
      { userId: 'A', option: 'Rechazar' },
      { userId: 'B', option: 'Rechazar' },
      { userId: 'C', option: 'Rechazar' },
      { userId: 'D', option: 'Rechazar' }
      // E y F no votaron — no cambia el resultado, "Rechazar" ya ganó
    ]
    const result = resolvePoll(poll({}), votes, ['A', 'B', 'C', 'D', 'E', 'F'], TODAY)
    expect(result).toEqual({ status: 'resolved', resolvedOption: 'Rechazar' })
  })

  it('quienes todavía no votaron no cuentan como "en contra": la consulta sigue pendiente hasta que alguna opción llegue a la mayoría real', () => {
    // 3 de 6 a favor: por más que nadie más haya votado "en contra", no
    // alcanza la mayoría del padrón (hacen falta 4) — sigue pendiente.
    const votes = [
      { userId: 'A', option: 'Sí' },
      { userId: 'B', option: 'Sí' },
      { userId: 'C', option: 'Sí' }
    ]
    const result = resolvePoll(poll({}), votes, ['A', 'B', 'C', 'D', 'E', 'F'], TODAY)
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

describe('pollDeadlineAt — duración elegida al crear una consulta (12, 24 o 72 h)', () => {
  const now = Date.UTC(2026, 8, 21, 12, 0, 0)

  it('las opciones son exactamente 12, 24 y 72 horas', () => {
    expect(POLL_DURATION_OPTIONS).toEqual([12, 24, 72])
  })

  it('suma esas horas desde ahora', () => {
    expect(pollDeadlineAt(12, now)).toBe('2026-09-22T00:00:00.000Z')
    expect(pollDeadlineAt(24, now)).toBe('2026-09-22T12:00:00.000Z')
    expect(pollDeadlineAt(72, now)).toBe('2026-09-24T12:00:00.000Z')
  })

  it('por defecto y en la rotación dura 72 horas', () => {
    expect(DEFAULT_POLL_HOURS).toBe(72)
    expect(ROTATION_POLL_HOURS).toBe(72)
    expect(pollDeadlineAt(undefined, now)).toBe('2026-09-24T12:00:00.000Z')
  })

  it('una duración que no está entre las opciones cae en la de por defecto', () => {
    for (const bad of [0, 5, 48, 9999, 'abc', null]) {
      expect(pollDeadlineAt(bad, now)).toBe('2026-09-24T12:00:00.000Z')
    }
  })

  it('una consulta de 72 h sigue abierta a las 71 h y vence a las 72 h', () => {
    const poll = { status: 'pending', resolutionMode: 'majority', deadlineAt: pollDeadlineAt(72, now) }
    const votes = [{ userId: 'a', option: 'Sí' }]
    const members = ['a', 'b']
    expect(resolvePoll(poll, votes, members, '2026-09-24', now + 71 * 3600000)).toBeNull()
    expect(resolvePoll(poll, votes, members, '2026-09-24', now + 72 * 3600000)).toEqual({ status: 'expired', resolvedOption: null })
  })
})

describe('pollDeadlineMs — instante exacto en que vence (para la cuenta atrás)', () => {
  it('con deadlineAt, el timestamp tal cual', () => {
    expect(pollDeadlineMs({ deadlineAt: '2026-09-20T15:00:00.000Z' })).toBe(Date.parse('2026-09-20T15:00:00.000Z'))
  })

  it('con solo deadline (fecha), vence al empezar el día siguiente — igual que resolvePoll', () => {
    const ms = pollDeadlineMs({ deadline: '2026-09-20' })
    // Mismo cálculo hecho a mano, sin depender de la zona horaria de quien corre el test.
    const expectedLocalMidnightNextDay = new Date('2026-09-20T00:00:00')
    expectedLocalMidnightNextDay.setDate(expectedLocalMidnightNextDay.getDate() + 1)
    expect(ms).toBe(expectedLocalMidnightNextDay.getTime())
    // A las 23:59:59 del propio día del plazo, todavía no venció.
    expect(ms).toBeGreaterThan(new Date('2026-09-20T23:59:59').getTime())
  })

  it('deadlineAt tiene prioridad sobre deadline si vienen los dos', () => {
    const ms = pollDeadlineMs({ deadline: '2026-09-25', deadlineAt: '2026-09-20T15:00:00.000Z' })
    expect(ms).toBe(Date.parse('2026-09-20T15:00:00.000Z'))
  })

  it('sin ninguno de los dos, null (sin plazo, sin cuenta atrás)', () => {
    expect(pollDeadlineMs({})).toBeNull()
  })
})

describe('formatCountdown — cuenta atrás legible', () => {
  it('ya vencido (<=0) da null', () => {
    expect(formatCountdown(0)).toBeNull()
    expect(formatCountdown(-1000)).toBeNull()
  })

  it('muestra días+horas cuando faltan días', () => {
    const twoDaysThreeHours = 2 * 86400000 + 3 * 3600000
    expect(formatCountdown(twoDaysThreeHours)).toEqual({ unit: 'days', days: 2, hours: 3 })
  })

  it('muestra horas+minutos cuando falta menos de un día', () => {
    const fiveHoursTwelveMin = 5 * 3600000 + 12 * 60000
    expect(formatCountdown(fiveHoursTwelveMin)).toEqual({ unit: 'hours', hours: 5, minutes: 12 })
  })

  it('muestra minutos+segundos cuando falta menos de una hora', () => {
    const eightMinThirty = 8 * 60000 + 30000
    expect(formatCountdown(eightMinThirty)).toEqual({ unit: 'minutes', minutes: 8, seconds: 30 })
  })

  it('muestra solo segundos cuando falta menos de un minuto', () => {
    expect(formatCountdown(45000)).toEqual({ unit: 'seconds', seconds: 45 })
  })
})

describe('textos de la cuenta atrás (votaciones.countdown*)', () => {
  const keys = ['countdownDays', 'countdownHours', 'countdownMinutes', 'countdownSeconds', 'countdownExpired']

  it('existen en español e inglés con las mismas variables', () => {
    for (const key of keys) {
      const esVal = get(es, `votaciones.${key}`)
      const enVal = get(en, `votaciones.${key}`)
      expect(typeof esVal).toBe('string')
      expect(typeof enVal).toBe('string')
      expect(vars(esVal)).toBe(vars(enVal))
    }
  })
})
