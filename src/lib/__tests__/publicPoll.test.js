import { describe, it, expect } from 'vitest'
import {
  isValidPin,
  cleanPinInput,
  publicPollLink,
  canSharePoll,
  voteErrorKey,
  pinChangeErrorKey,
  getDeviceToken,
  saveDeviceToken,
  clearDeviceToken
} from '../publicPoll'
import es from '../i18n/es'
import en from '../i18n/en'

const get = (dict, key) => key.split('.').reduce((o, k) => (o == null ? o : o[k]), dict)
const vars = (s) => [...s.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort().join(',')

describe('PIN de 6 dígitos', () => {
  it('acepta exactamente 6 dígitos', () => {
    expect(isValidPin('123456')).toBe(true)
    expect(isValidPin('000000')).toBe(true)
  })

  it('rechaza otra longitud, letras o valores que no son texto', () => {
    for (const bad of ['12345', '1234567', '12a456', '12 456', '', null, undefined, 123456]) {
      expect(isValidPin(bad)).toBe(false)
    }
  })

  it('el campo solo deja pasar dígitos y corta a 6', () => {
    expect(cleanPinInput('12a3-4 5678')).toBe('123456')
    expect(cleanPinInput(null)).toBe('')
  })
})

describe('link de la consulta', () => {
  it('arma /votar/<id> sin barras dobles', () => {
    expect(publicPollLink('abc', 'https://convive.app')).toBe('https://convive.app/votar/abc')
    expect(publicPollLink('abc', 'https://convive.app/')).toBe('https://convive.app/votar/abc')
  })

  it('solo se comparte una consulta normal y abierta', () => {
    expect(canSharePoll({ kind: 'custom', status: 'pending' })).toBe(true)
    expect(canSharePoll({ kind: 'custom', status: 'resolved' })).toBe(false)
    expect(canSharePoll({ kind: 'pot_adjustment', status: 'pending' })).toBe(false)
    expect(canSharePoll({ kind: 'rotation_order', status: 'pending' })).toBe(false)
    expect(canSharePoll({ kind: 'balance_reset', status: 'pending' })).toBe(false)
    expect(canSharePoll(null)).toBe(false)
  })
})

describe('errores de voto', () => {
  it('cada código conocido tiene su texto y lo desconocido cae en el genérico', () => {
    expect(voteErrorKey('wrong_pin')).toBe('publicPoll.errWrongPin')
    expect(voteErrorKey('locked')).toBe('publicPoll.errLocked')
    expect(voteErrorKey('device_not_recognized')).toBe('publicPoll.errDevice')
    expect(voteErrorKey('algo_raro')).toBe('publicPoll.errGeneric')
    expect(voteErrorKey(undefined)).toBe('publicPoll.errGeneric')
  })

  it('todos los mensajes existen en español e inglés', () => {
    for (const code of ['wrong_pin', 'locked', 'no_pin', 'poll_closed', 'not_member', 'device_not_recognized', 'poll_not_found', 'x']) {
      const key = voteErrorKey(code)
      expect(typeof get(es, key)).toBe('string')
      expect(typeof get(en, key)).toBe('string')
    }
  })
})

describe('errores al cambiar el PIN', () => {
  it('cada código tiene su mensaje y lo desconocido cae en el genérico', () => {
    expect(pinChangeErrorKey('wrong_password')).toBe('ajustes.pin.errWrongPassword')
    expect(pinChangeErrorKey('locked')).toBe('ajustes.pin.errLocked')
    expect(pinChangeErrorKey('invalid_format')).toBe('ajustes.pin.errFormat')
    expect(pinChangeErrorKey('no_pin')).toBe('ajustes.pin.errGeneric')
    expect(pinChangeErrorKey(undefined)).toBe('ajustes.pin.errGeneric')
  })
})

describe('móvil recordado sin almacenamiento', () => {
  it('no falla si localStorage no está disponible', () => {
    expect(() => saveDeviceToken('t')).not.toThrow()
    expect(() => clearDeviceToken()).not.toThrow()
    expect(getDeviceToken()).toBeNull()
  })
})

describe('textos de votar sin sesión', () => {
  const keys = [
    'publicPoll.loading',
    'publicPoll.fromFloor',
    'publicPoll.votedCount',
    'publicPoll.notFoundTitle',
    'publicPoll.notFoundBody',
    'publicPoll.errorTitle',
    'publicPoll.errorBody',
    'publicPoll.retry',
    'publicPoll.closedTitle',
    'publicPoll.hello',
    'publicPoll.notMe',
    'publicPoll.whoAreYou',
    'publicPoll.pickName',
    'publicPoll.noPinSuffix',
    'publicPoll.nobodyHasPin',
    'publicPoll.noPinHint',
    'publicPoll.pinLabel',
    'publicPoll.chooseOption',
    'publicPoll.canChange',
    'publicPoll.remember',
    'publicPoll.vote',
    'publicPoll.voting',
    'publicPoll.voted',
    'publicPoll.goVotaciones',
    'publicPoll.openApp',
    'ajustes.pin.title',
    'ajustes.pin.body',
    'ajustes.pin.hasPin',
    'ajustes.pin.placeholder',
    'ajustes.pin.newPlaceholder',
    'ajustes.pin.confirmPlaceholder',
    'ajustes.pin.changeNote',
    'ajustes.pin.save',
    'ajustes.pin.change',
    'ajustes.pin.saving',
    'ajustes.pin.savedToast',
    'ajustes.pin.errFormat',
    'ajustes.pin.errMismatch',
    'ajustes.pin.errGeneric',
    'ajustes.pin.passwordPlaceholder',
    'ajustes.pin.requiredTitle',
    'ajustes.pin.requiredBody',
    'ajustes.pin.requiredNote',
    'ajustes.pin.errWrongPassword',
    'ajustes.pin.errLocked',
    'votaciones.shareLink',
    'votaciones.shareText',
    'votaciones.linkCopied',
    'floorSettings.resetPin',
    'floorSettings.resetPinTitle',
    'floorSettings.resetPinBody',
    'floorSettings.resetPinYes',
    'floorSettings.resetPinWorking',
    'floorSettings.resetPinDone'
  ]

  it.each(keys)('%s existe en español e inglés', (key) => {
    expect(typeof get(es, key)).toBe('string')
    expect(typeof get(en, key)).toBe('string')
  })

  it('los textos con {{variables}} usan las mismas en ambos idiomas', () => {
    for (const key of keys) expect(vars(get(en, key))).toBe(vars(get(es, key)))
  })
})
