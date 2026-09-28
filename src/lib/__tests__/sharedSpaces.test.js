import { describe, it, expect } from 'vitest'
import { currentSpaceUse, minutesLeft, splitMinutes, reminderAt, waitlistFor, SHARED_SPACES, REMINDER_MINUTES_BEFORE_END } from '../sharedSpaces.js'

const NOW = Date.parse('2026-09-20T15:00:00Z')
const use = (o) => ({
  spaceKey: 'washer',
  userId: 'A',
  startsAt: '2026-09-20T14:30:00Z',
  endsAt: '2026-09-20T16:30:00Z',
  releasedAt: null,
  ...o
})

describe('currentSpaceUse — quién la está usando ahora', () => {
  it('un uso que no ha terminado deja el espacio "en uso"', () => {
    expect(currentSpaceUse([use({})], 'washer', NOW)?.userId).toBe('A')
  })
  it('sin usos, o con el uso ya vencido, está libre', () => {
    expect(currentSpaceUse([], 'washer', NOW)).toBeNull()
    expect(currentSpaceUse([use({ endsAt: '2026-09-20T14:59:00Z' })], 'washer', NOW)).toBeNull()
  })
  it('"Ya terminé" (releasedAt) lo libera antes de tiempo', () => {
    expect(currentSpaceUse([use({ releasedAt: '2026-09-20T14:45:00Z' })], 'washer', NOW)).toBeNull()
  })
  it('cada espacio es independiente y se toma el uso más reciente', () => {
    const uses = [use({ userId: 'A' }), use({ userId: 'B', startsAt: '2026-09-20T14:50:00Z' }), use({ spaceKey: 'dryer', userId: 'C' })]
    expect(currentSpaceUse(uses, 'washer', NOW)?.userId).toBe('B')
    expect(currentSpaceUse(uses, 'dryer', NOW)?.userId).toBe('C')
    expect(currentSpaceUse(uses, 'terrace', NOW)).toBeNull()
  })
})

describe('minutesLeft / splitMinutes', () => {
  it('cuenta los minutos que faltan, redondeando hacia arriba', () => {
    expect(minutesLeft(use({}), NOW)).toBe(90)
    expect(minutesLeft(use({ endsAt: '2026-09-20T15:00:20Z' }), NOW)).toBe(1)
  })
  it('separa horas y minutos', () => {
    expect(splitMinutes(95)).toEqual({ hours: 1, minutes: 35 })
    expect(splitMinutes(40)).toEqual({ hours: 0, minutes: 40 })
  })
})

describe('SHARED_SPACES', () => {
  it('la lavadora está configurada con su duración por defecto entre las opciones', () => {
    const washer = SHARED_SPACES.find((s) => s.key === 'washer')
    expect(washer.durations).toContain(washer.defaultMinutes)
  })
})

describe('reminderAt — aviso de "ya casi termina"', () => {
  it('cae N minutos antes del fin del uso', () => {
    const expected = Date.parse('2026-09-20T16:30:00Z') - REMINDER_MINUTES_BEFORE_END * 60000
    expect(reminderAt(use({}))).toBe(expected)
  })
})

describe('waitlistFor — lista de espera FIFO', () => {
  const row = (o) => ({ spaceKey: 'washer', userId: 'X', createdAt: '2026-09-20T14:00:00Z', ...o })

  it('ordena por quién se anotó primero', () => {
    const list = [row({ userId: 'B', createdAt: '2026-09-20T14:10:00Z' }), row({ userId: 'A', createdAt: '2026-09-20T14:00:00Z' })]
    expect(waitlistFor(list, 'washer').map((w) => w.userId)).toEqual(['A', 'B'])
  })

  it('filtra por espacio', () => {
    const list = [row({ userId: 'A', spaceKey: 'washer' }), row({ userId: 'B', spaceKey: 'dryer' })]
    expect(waitlistFor(list, 'washer').map((w) => w.userId)).toEqual(['A'])
  })
})
