import { describe, it, expect } from 'vitest'
import es from '../i18n/es.js'
import en from '../i18n/en.js'

// Guarda de todo el diccionario (no solo "auth"/"tutorial", que ya tenían su
// propio test): agregar una clave nueva a un idioma y olvidarla en el otro
// deja `t()` devolviendo la clave cruda en pantalla — este test lo detecta
// en CI en vez de en producción.
function keysOf(obj, prefix = '') {
  return Object.entries(obj).flatMap(([k, v]) => (v && typeof v === 'object' ? keysOf(v, `${prefix}${k}.`) : [`${prefix}${k}`]))
}

describe('i18n: es.js y en.js tienen exactamente las mismas claves', () => {
  it('ninguna clave falta ni sobra en ninguno de los dos idiomas', () => {
    const esKeys = keysOf(es).sort()
    const enKeys = keysOf(en).sort()
    const missingInEn = esKeys.filter((k) => !enKeys.includes(k))
    const missingInEs = enKeys.filter((k) => !esKeys.includes(k))
    expect(missingInEn, 'claves en es.js que faltan en en.js').toEqual([])
    expect(missingInEs, 'claves en en.js que faltan en es.js').toEqual([])
  })
})
