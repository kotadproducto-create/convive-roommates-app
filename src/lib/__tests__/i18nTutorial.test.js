import { describe, it, expect } from 'vitest'
import es from '../i18n/es.js'
import en from '../i18n/en.js'

function keysOf(obj, prefix = '') {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? keysOf(v, `${prefix}${k}.`) : [`${prefix}${k}`]
  )
}

// Los pasos del tutorial (AppTutorial.jsx) buscan sus textos por estas claves.
const TUTORIAL_STEP_KEYS = ['inicio', 'calendario', 'compras', 'pote', 'more']

describe('tutorial y pantallas de perfil/configuración: mismas claves en español e inglés', () => {
  it('el tutorial tiene todos sus pasos, con título y texto, en los dos idiomas', () => {
    for (const dict of [es, en]) {
      for (const key of TUTORIAL_STEP_KEYS) {
        expect(dict.tutorial.steps[key].title).toBeTruthy()
        expect(dict.tutorial.steps[key].body).toBeTruthy()
      }
    }
  })

  it('es y en coinciden en "tutorial"', () => {
    expect(keysOf(en.tutorial).sort()).toEqual(keysOf(es.tutorial).sort())
  })

  it('las claves nuevas de Configuración y Mi perfil existen en los dos idiomas', () => {
    const wanted = ['bannerTitle', 'bannerSubtitle', 'bannerLink', 'groupAccount']
    for (const dict of [es, en]) {
      for (const k of wanted) {
        expect(dict.perfil[k], `perfil.${k}`).toBeTruthy()
        expect(dict.ajustes[k], `ajustes.${k}`).toBeTruthy()
      }
      for (const k of ['tutorialTitle', 'tutorialMode', 'tutorialOn', 'tutorialOff', 'groupApp', 'groupInfo']) {
        expect(dict.ajustes[k], `ajustes.${k}`).toBeTruthy()
      }
    }
  })
})
