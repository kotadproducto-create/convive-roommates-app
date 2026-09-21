import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { normalizeInviteCode, inviteLink, savePendingInvite, getPendingInvite, clearPendingInvite } from '../invite'
import es from '../i18n/es'
import en from '../i18n/en'

const get = (dict, key) => key.split('.').reduce((o, k) => (o == null ? o : o[k]), dict)
const vars = (s) => [...s.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort().join(',')

describe('código de invitación', () => {
  it('lo deja en mayúsculas y sin símbolos ni espacios', () => {
    expect(normalizeInviteCode(' v293pe ')).toBe('V293PE')
    expect(normalizeInviteCode('v2-93 pe!')).toBe('V293PE')
    expect(normalizeInviteCode(undefined)).toBe('')
    expect(normalizeInviteCode(null)).toBe('')
  })

  it('corta lo que sea demasiado largo', () => {
    expect(normalizeInviteCode('A'.repeat(50))).toHaveLength(12)
  })
})

describe('link de invitación', () => {
  it('lleva a /unirse/<código> sin barras dobles', () => {
    expect(inviteLink('https://convive.app', 'v293pe')).toBe('https://convive.app/unirse/V293PE')
    expect(inviteLink('https://convive.app/', 'V293PE')).toBe('https://convive.app/unirse/V293PE')
  })

  it('no se puede colar nada raro en la ruta a través del código', () => {
    expect(inviteLink('https://convive.app', '../login?x=1')).toBe('https://convive.app/unirse/LOGINX1')
  })
})

describe('invitación pendiente (por si la persona ya tiene cuenta)', () => {
  let store
  const realStorage = globalThis.localStorage

  beforeEach(() => {
    store = new Map()
    globalThis.localStorage = {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k)
    }
  })

  afterEach(() => {
    if (realStorage === undefined) delete globalThis.localStorage
    else globalThis.localStorage = realStorage
  })

  it('guarda el código y lo devuelve normalizado', () => {
    savePendingInvite('v293pe', 1000)
    expect(getPendingInvite(2000)).toBe('V293PE')
  })

  it('caduca a los 7 días', () => {
    savePendingInvite('V293PE', 0)
    const day = 24 * 60 * 60 * 1000
    expect(getPendingInvite(6 * day)).toBe('V293PE')
    expect(getPendingInvite(8 * day)).toBe('')
  })

  it('se puede borrar y un código vacío no se guarda', () => {
    savePendingInvite('V293PE', 0)
    clearPendingInvite()
    expect(getPendingInvite(1)).toBe('')
    savePendingInvite('---', 0)
    expect(getPendingInvite(1)).toBe('')
  })

  it('un valor guardado corrupto se ignora', () => {
    store.set('convive.pendingInvite', 'no-es-json')
    expect(getPendingInvite()).toBe('')
  })
})

describe('sin almacenamiento', () => {
  it('no falla si localStorage no está disponible', () => {
    expect(() => savePendingInvite('V293PE')).not.toThrow()
    expect(() => clearPendingInvite()).not.toThrow()
    expect(getPendingInvite()).toBe('')
  })
})

describe('textos de la invitación', () => {
  const keys = [
    'auth.register.invitedBanner',
    'auth.register.invitedInvalid',
    'floorSettings.shareInviteTitle',
    'floorSettings.shareInviteText',
    'floorSettings.inviteSubtitle',
    'floorSettings.copyOrShareTitle',
    'floorSettings.inviteCopied'
  ]

  it.each(keys)('%s existe en español e inglés', (key) => {
    expect(typeof get(es, key)).toBe('string')
    expect(typeof get(en, key)).toBe('string')
  })

  it('los textos con {{variables}} usan las mismas en ambos idiomas', () => {
    for (const key of keys) expect(vars(get(en, key))).toBe(vars(get(es, key)))
  })
})
