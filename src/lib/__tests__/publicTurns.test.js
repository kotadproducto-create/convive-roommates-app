import { describe, it, expect } from 'vitest'
import { buildPublicTurns, buildFloorTurnsPreview, publicTurnsLink, isPublicTurnsToken } from '../publicTurns'
import { getWeekKeyOf, assigneeFor, floorKeeperFor } from '../activities'
import es from '../i18n/es'
import en from '../i18n/en'

const get = (dict, key) => key.split('.').reduce((o, k) => (o == null ? o : o[k]), dict)
const vars = (s) => [...s.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort().join(',')

// Miércoles 23 sep 2026, mediodía (hora local): semana ISO 2026-W39.
const NOW = new Date(2026, 8, 23, 12, 0, 0)
const WEEK = getWeekKeyOf(NOW)

const members = [
  { id: 'a', name: 'Ana', isVirtual: false, away: false },
  { id: 'b', name: 'Beto', isVirtual: false, away: false },
  { id: 'c', name: 'Carla', isVirtual: true, away: false }
]

const weekly = (over = {}) => ({
  id: 'act1',
  title: 'Sacar la basura',
  fixedKey: 'basura',
  frequencyType: 'recurring',
  recurrenceUnit: 'week',
  recurrenceInterval: 1,
  weekdays: [1, 4],
  startDate: '2026-01-05',
  untilDate: null,
  timesPerWeek: 1,
  assignmentMode: 'rotation',
  assignedUserId: null,
  ...over
})

const baseData = (over = {}) => ({
  ok: true,
  floor: { name: 'Piso 3B', rotationOrder: ['a', 'b', 'c'], rotationMode: 'random', rotationPeriodUnit: null, rotationPeriodInterval: 1, rotationEpoch: null },
  members,
  activities: [weekly()],
  completions: [],
  ...over
})

describe('link y token', () => {
  it('arma /turnos/<token> sin barras dobles', () => {
    expect(publicTurnsLink('https://convive.app', 'abc123')).toBe('https://convive.app/turnos/abc123')
    expect(publicTurnsLink('https://convive.app/', 'abc123')).toBe('https://convive.app/turnos/abc123')
  })

  it('solo acepta tokens hexadecimales largos', () => {
    expect(isPublicTurnsToken('a'.repeat(48))).toBe(true)
    expect(isPublicTurnsToken('abc')).toBe(false)
    expect(isPublicTurnsToken('../login')).toBe(false)
    expect(isPublicTurnsToken(undefined)).toBe(false)
  })
})

describe('buildPublicTurns — encargado/a del piso', () => {
  it('coincide con floorKeeperFor y la siguiente semana avanza una posición', () => {
    const view = buildPublicTurns(baseData(), NOW)
    const order = ['a', 'b', 'c']
    const expectedNow = floorKeeperFor({ rotationMode: 'random' }, order, WEEK)
    expect(view.keeper.now.id).toBe(expectedNow)
    expect(view.keeper.next.id).toBe(order[(order.indexOf(expectedNow) + 1) % 3])
  })

  it('quien está fuera se salta en la rotación', () => {
    const away = members.map((m) => (m.id === 'b' ? { ...m, away: true } : m))
    const view = buildPublicTurns(baseData({ members: away }), NOW)
    expect(view.keeper.now.id).not.toBe('b')
    expect(view.keeper.next.id).not.toBe('b')
    expect(view.away).toEqual(['Beto'])
    expect(view.rotation.find((m) => m.id === 'b').away).toBe(true)
  })

  it('sin nadie en la rotación no hay encargado', () => {
    const view = buildPublicTurns(baseData({ floor: { name: 'X', rotationOrder: [] } }), NOW)
    expect(view.keeper.now).toBeNull()
  })
})

describe('buildPublicTurns — actividades', () => {
  it('el turno actual usa lo guardado en la base si ya existe', () => {
    const data = baseData({ completions: [{ activityId: 'act1', periodKey: WEEK, assignedUserId: 'c', timesDone: 0, completed: true }] })
    const [row] = buildPublicTurns(data, NOW).activities
    expect(row.now.person.id).toBe('c')
    expect(row.now.done).toBe(true)
  })

  it('sin turno guardado se calcula como lo haría la app', () => {
    const [row] = buildPublicTurns(baseData(), NOW).activities
    const expected = assigneeFor(weekly(), ['a', 'b', 'c'], WEEK, { rotationMode: 'random' })
    expect(row.now.person.id).toBe(expected)
    expect(row.now.done).toBe(false)
  })

  it('el siguiente turno es de otra semana, con fecha, y rota a otra persona', () => {
    const [row] = buildPublicTurns(baseData(), NOW).activities
    expect(row.next.date > NOW).toBe(true)
    expect(getWeekKeyOf(row.next.date)).not.toBe(WEEK)
    expect(row.next.person.id).not.toBe(row.now.person.id)
  })

  it('una actividad manual sin persona es de "Todos"', () => {
    const manual = weekly({ id: 'm1', assignmentMode: 'manual', assignedUserId: null, fixedKey: null, title: 'Regar plantas' })
    const [row] = buildPublicTurns(baseData({ activities: [manual] }), NOW).activities
    expect(row.now.person).toBeNull()
    expect(row.now.everyone).toBe(true)
  })

  it('una actividad manual con persona muestra a esa persona', () => {
    const manual = weekly({ id: 'm2', assignmentMode: 'manual', assignedUserId: 'b', fixedKey: null })
    const [row] = buildPublicTurns(baseData({ activities: [manual] }), NOW).activities
    expect(row.now.person.name).toBe('Beto')
  })

  it('"N veces por semana" muestra el progreso', () => {
    const three = weekly({ timesPerWeek: 3, weekdays: [0, 2, 4] })
    const data = baseData({ activities: [three], completions: [{ activityId: 'act1', periodKey: WEEK, assignedUserId: 'a', timesDone: 1, completed: false }] })
    const [row] = buildPublicTurns(data, NOW).activities
    expect(row.now.target).toBe(3)
    expect(row.now.timesDone).toBe(1)
    expect(row.now.done).toBe(false)
  })

  it('una actividad quincenal que no toca esta semana no tiene turno actual pero sí siguiente', () => {
    // Empieza la semana anterior (W38) y se repite cada 2 semanas: W39 no toca.
    const biweekly = weekly({ id: 'q1', recurrenceInterval: 2, startDate: '2026-09-14', fixedKey: null })
    const [row] = buildPublicTurns(baseData({ activities: [biweekly] }), NOW).activities
    expect(row.thisPeriod).toBe(false)
    expect(row.now).toBeNull()
    expect(row.next).not.toBeNull()
  })

  it('no filtra datos que no hacen falta (solo nombres y turnos)', () => {
    const view = buildPublicTurns(baseData(), NOW)
    expect(Object.keys(view).sort()).toEqual(['activities', 'away', 'floorName', 'keeper', 'rotation'])
    expect(Object.keys(view.rotation[0]).sort()).toEqual(['away', 'id', 'isVirtual', 'name'])
  })
})

describe('textos del link de turnos', () => {
  const keys = [
    'publicTurns.notFoundTitle',
    'publicTurns.notFoundBody',
    'publicTurns.keeperTitle',
    'publicTurns.keeperNext',
    'publicTurns.progress',
    'publicTurns.updatedAt',
    'floorSettings.turnsLink.title',
    'floorSettings.turnsLink.subtitle',
    'floorSettings.turnsLink.shareText',
    'floorSettings.turnsLink.regenerateBody',
    'floorSettings.turnsLink.disableBody',
    'floorSettings.turnsLink.qrAlt'
  ]

  it.each(keys)('%s existe en español e inglés', (key) => {
    expect(typeof get(es, key)).toBe('string')
    expect(typeof get(en, key)).toBe('string')
  })

  it('los textos con {{variables}} usan las mismas en ambos idiomas', () => {
    for (const key of keys) expect(vars(get(en, key))).toBe(vars(get(es, key)))
  })

  it('es y en tienen las mismas claves en publicTurns y turnsLink', () => {
    const keysOf = (obj, prefix = '') => Object.entries(obj).flatMap(([k, v]) => (v && typeof v === 'object' ? keysOf(v, `${prefix}${k}.`) : [`${prefix}${k}`]))
    expect(keysOf(en.publicTurns).sort()).toEqual(keysOf(es.publicTurns).sort())
    expect(keysOf(en.floorSettings.turnsLink).sort()).toEqual(keysOf(es.floorSettings.turnsLink).sort())
  })
})

describe('buildFloorTurnsPreview — misma lógica, a partir de los datos ya cargados en la app (con sesión)', () => {
  // Miembros "con sesión" (DataContext.jsx), sin el campo `away`: eso lo
  // decide aparte awayUserIds, igual que el resto de la app.
  const liveMembers = [
    { id: 'a', name: 'Ana', isVirtual: false, points: 12 },
    { id: 'b', name: 'Beto', isVirtual: false, points: 0 },
    { id: 'c', name: 'Carla', isVirtual: true, points: 0 }
  ]
  const liveFloor = { name: 'Piso 3B', rotationOrder: ['a', 'b', 'c'], rotationMode: 'random', rotationPeriodUnit: null, rotationPeriodInterval: 1, rotationEpoch: null }

  it('da el mismo resultado que buildPublicTurns con los datos equivalentes', () => {
    const awayUserIds = new Set()
    const viaAdapter = buildFloorTurnsPreview(liveFloor, liveMembers, awayUserIds, [weekly()], [], NOW)
    const viaRaw = buildPublicTurns(baseData(), NOW)
    expect(viaAdapter).toEqual(viaRaw)
  })

  it('awayUserIds (un Set, como en DataContext) decide quién está fuera', () => {
    const view = buildFloorTurnsPreview(liveFloor, liveMembers, new Set(['b']), [weekly()], [], NOW)
    expect(view.away).toEqual(['Beto'])
    expect(view.keeper.now.id).not.toBe('b')
  })

  it('sin awayUserIds no revienta (nadie está fuera)', () => {
    const view = buildFloorTurnsPreview(liveFloor, liveMembers, undefined, [weekly()], [], NOW)
    expect(view.away).toEqual([])
  })

  it('rotationOffset (asignar el turno a mano) se refleja en el encargado del piso y en los turnos', () => {
    const withoutOffset = buildFloorTurnsPreview(liveFloor, liveMembers, new Set(), [weekly()], [], NOW)
    const withOffset = buildFloorTurnsPreview({ ...liveFloor, rotationOffset: 1 }, liveMembers, new Set(), [weekly()], [], NOW)
    const order = ['a', 'b', 'c']
    expect(withOffset.keeper.now.id).toBe(order[(order.indexOf(withoutOffset.keeper.now.id) + 1) % 3])
    expect(withOffset.activities[0].now.person.id).toBe(withOffset.keeper.now.id)
  })
})
