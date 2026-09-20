import { describe, it, expect } from 'vitest'
import es from '../i18n/es.js'
import en from '../i18n/en.js'
import { authError, authErrorMessage, AUTH_ERROR_CODES } from '../authErrors.js'

// Misma función que LanguageContext.t(), sin React: lee un diccionario.
const tFor = (dict) => (key) => key.split('.').reduce((o, k) => (o == null ? o : o[k]), dict) ?? key

function keysOf(obj, prefix = '') {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? keysOf(v, `${prefix}${k}.`) : [`${prefix}${k}`]
  )
}

describe('pantallas de acceso: una sola fuente de traducciones', () => {
  it('es y en tienen exactamente las mismas claves en "auth" (login, registro, recuperar)', () => {
    expect(keysOf(en.auth).sort()).toEqual(keysOf(es.auth).sort())
  })

  it('cada código de error de acceso tiene texto en los dos idiomas', () => {
    for (const code of AUTH_ERROR_CODES) {
      expect(es.auth.errors[code], `es ${code}`).toBeTruthy()
      expect(en.auth.errors[code], `en ${code}`).toBeTruthy()
    }
  })
})

describe('authErrorMessage', () => {
  const err = authError('invalidCredentials', 'Email o contraseña incorrectos.')

  it('muestra el error en el idioma activo', () => {
    expect(authErrorMessage(err, tFor(es))).toBe('Email o contraseña incorrectos.')
    expect(authErrorMessage(err, tFor(en))).toBe('Wrong email or password.')
  })

  it('un error sin código conocido se muestra tal cual', () => {
    expect(authErrorMessage(new Error('boom'), tFor(en))).toBe('boom')
  })

  it('sin mensaje ni código cae al error genérico traducido', () => {
    expect(authErrorMessage(undefined, tFor(en))).toBe('Something went wrong.')
  })
})
