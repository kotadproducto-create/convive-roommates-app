import { describe, it, expect } from 'vitest'
import { realMembers, virtualIdSet, VIRTUAL_COLORS } from '../virtualMembers'
import { canUserMark } from '../activities'
import { computeWallets } from '../wallets'
import es from '../i18n/es'
import en from '../i18n/en'

const ana = { id: 'ana', name: 'Ana' }
const luis = { id: 'luis', name: 'Luis', isVirtual: true }
const members = [ana, luis]

describe('perfiles virtuales: helpers', () => {
  it('realMembers deja fuera a los perfiles virtuales', () => {
    expect(realMembers(members).map((m) => m.id)).toEqual(['ana'])
  })

  it('virtualIdSet reúne solo los ids virtuales', () => {
    const set = virtualIdSet(members)
    expect(set.has('luis')).toBe(true)
    expect(set.has('ana')).toBe(false)
  })

  it('ofrece colores para elegir', () => {
    expect(VIRTUAL_COLORS.length).toBeGreaterThan(3)
  })
})

describe('canUserMark con perfiles virtuales', () => {
  const activity = { assignedUserId: 'luis' }
  const virtualIds = virtualIdSet(members)

  it('sin perfiles virtuales, solo marca quien tiene el turno', () => {
    expect(canUserMark(activity, null, 'ana')).toBe(false)
    expect(canUserMark(activity, null, 'luis')).toBe(true)
  })

  it('cualquier miembro puede marcar lo de un perfil virtual', () => {
    expect(canUserMark(activity, null, 'ana', virtualIds)).toBe(true)
  })

  it('la asignación de la ocurrencia manda sobre la de la actividad', () => {
    const completion = { assignedUserId: 'ana' }
    expect(canUserMark(activity, completion, 'luis', virtualIds)).toBe(false)
  })

  it('una persona real sigue sin poder marcar lo de otra persona real', () => {
    expect(canUserMark({ assignedUserId: 'ana' }, null, 'bea', virtualIds)).toBe(false)
  })
})

describe('Pote con perfiles virtuales', () => {
  it('el aporte registrado en nombre de un virtual suma a su saldo', () => {
    const contributions = [
      { id: 'c1', userId: 'luis', amount: 10, kind: 'contribution', createdAt: '2026-01-01T10:00:00Z' },
      { id: 'c2', userId: 'ana', amount: -10, kind: 'contribution', createdAt: '2026-01-02T10:00:00Z' }
    ]
    const wallets = computeWallets(members, contributions, [])
    expect(wallets.luis.contributed).toBeCloseTo(10)
    // El gasto se reparte entre las dos personas del piso (el virtual incluido).
    expect(wallets.luis.expenseShare).toBeCloseTo(5)
    expect(wallets.ana.expenseShare).toBeCloseTo(5)
  })
})

describe('textos de perfiles virtuales', () => {
  const keys = [
    'virtual.tag',
    'activities.virtualTurn',
    'activities.confirmMarkBodyBehalf',
    'calendar.markedDoneBehalf',
    'convives.virtualAway',
    'wallet.actingAs',
    'wallet.actingAsMe',
    'wallet.recordedBy',
    'wallet.confirmContributeBodyBehalf',
    'wallet.confirmExpenseBodyBehalf',
    'shopping.paidBy',
    'shopping.paidByMe',
    'floorSettings.virtual.add',
    'floorSettings.virtual.edit',
    'floorSettings.virtual.link',
    'floorSettings.virtual.remove',
    'floorSettings.virtual.removeConfirm',
    'floorSettings.virtual.createTitle',
    'floorSettings.virtual.editTitle',
    'floorSettings.virtual.createBody',
    'floorSettings.virtual.nameLabel',
    'floorSettings.virtual.colorLabel',
    'floorSettings.virtual.create',
    'floorSettings.virtual.save',
    'floorSettings.virtual.error',
    'floorSettings.virtual.linkTitle',
    'floorSettings.virtual.linkNone',
    'floorSettings.virtual.linkBody',
    'floorSettings.virtual.linkPick',
    'floorSettings.virtual.linkConfirm',
    'floorSettings.virtual.linking',
    'floorSettings.virtual.close',
    'floorSettings.virtual.createdToast',
    'floorSettings.virtual.updatedToast',
    'floorSettings.virtual.linkedToast',
    'floorSettings.virtual.removedToast',
    'floorSettings.cancel'
  ]
  const get = (dict, key) => key.split('.').reduce((o, k) => (o == null ? o : o[k]), dict)

  it.each(keys)('%s existe en español e inglés', (key) => {
    expect(typeof get(es, key)).toBe('string')
    expect(typeof get(en, key)).toBe('string')
  })

  it('los textos con {{variables}} usan las mismas en ambos idiomas', () => {
    const vars = (s) => [...s.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort().join(',')
    for (const key of keys) expect(vars(get(en, key))).toBe(vars(get(es, key)))
  })
})
