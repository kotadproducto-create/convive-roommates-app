import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { useLanguage } from '../context/LanguageContext'

/**
 * Tutorial guiado (primera visita y "Modo tutorial" en Configuración): un
 * foco sobre cada botón principal de la navegación con una explicación
 * breve y una flecha que lo señala. Cada paso apunta a un elemento con
 * `data-tour="<id>"` (ver Sidebar.jsx); en móvil son las pestañas de abajo
 * y "Más", en escritorio la barra lateral. Un paso cuyo botón no está en
 * pantalla (p. ej. "Más" en escritorio) se salta solo.
 *
 * Se muestra mientras `user.tutorialEnabled` sea true (se pone en true al
 * registrarse y desde Configuración). Al terminar o cerrarlo se apaga solo,
 * así que no vuelve a salir hasta que la persona lo active otra vez.
 */
const STEPS = [
  { key: 'inicio', target: 'nav-/' },
  { key: 'calendario', target: 'nav-/calendario' },
  { key: 'compras', target: 'nav-/compras' },
  { key: 'pote', target: 'nav-/pote' },
  { key: 'more', target: 'nav-more' }
]

function findTarget(id) {
  return (
    [...document.querySelectorAll(`[data-tour="${id}"]`)].find((el) => {
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0
    }) || null
  )
}

const PAD = 6 // aire del foco alrededor del botón
const ARROW = 8
const GAP = 16 // separación entre el botón y la tarjeta

export default function AppTutorial() {
  const { user, refresh } = useAuth()
  const { updateProfile } = useData()
  const { t } = useLanguage()
  const enabled = Boolean(user?.tutorialEnabled)
  const [dismissed, setDismissed] = useState(false)
  const [ready, setReady] = useState(false)
  const [index, setIndex] = useState(0)
  const [layout, setLayout] = useState({ steps: [], rect: null, vw: 0, vh: 0 })
  // Alto real de la tarjeta, para no salirse de la pantalla al ponerla al lado de un botón.
  const cardRef = useRef(null)
  const [cardH, setCardH] = useState(200)
  useLayoutEffect(() => {
    const h = cardRef.current?.offsetHeight
    if (h && Math.abs(h - cardH) > 1) setCardH(h)
  })

  // Al apagarse (terminó, o se desactivó en Configuración) se reinicia para
  // que una nueva activación empiece desde el primer paso.
  useEffect(() => {
    if (!enabled) {
      setDismissed(false)
      setReady(false)
      setIndex(0)
    }
  }, [enabled])

  // Pequeña espera para que la pantalla termine de armarse antes de señalar.
  useEffect(() => {
    if (!enabled || dismissed) return undefined
    const id = setTimeout(() => setReady(true), 500)
    return () => clearTimeout(id)
  }, [enabled, dismissed])

  const active = enabled && !dismissed && ready

  const measure = useCallback(() => {
    const steps = STEPS.filter((s) => findTarget(s.target))
    const step = steps[Math.min(index, steps.length - 1)]
    const el = step ? findTarget(step.target) : null
    setLayout({ steps, rect: el ? el.getBoundingClientRect() : null, vw: window.innerWidth, vh: window.innerHeight })
  }, [index])

  useLayoutEffect(() => {
    if (!active) return undefined
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [active, measure])

  const finish = useCallback(async () => {
    setDismissed(true)
    if (!user) return
    try {
      await updateProfile(user.id, { tutorialEnabled: false })
      await refresh()
    } catch (err) {
      console.error('tutorial: no se pudo guardar', err)
    }
  }, [user, updateProfile, refresh])

  const total = layout.steps.length
  const current = layout.steps[Math.min(index, Math.max(total - 1, 0))]
  const isLast = index >= total - 1

  const next = useCallback(() => {
    if (isLast) finish()
    else setIndex((i) => i + 1)
  }, [isLast, finish])
  const prev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), [])

  useEffect(() => {
    if (!active) return undefined
    function onKey(e) {
      if (e.key === 'Escape') finish()
      else if (e.key === 'ArrowRight') next()
      else if (e.key === 'ArrowLeft') prev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, finish, next, prev])

  // Si no hay ningún botón que señalar (pantalla sin navegación), no se muestra.
  if (!active || !layout.rect || !current) return null

  const { rect, vw, vh } = layout
  // El foco no se sale de la pantalla (los botones de los extremos de la barra están al borde).
  const spotLeft = Math.max(rect.left - PAD, 3)
  const spotRight = Math.min(rect.right + PAD, vw - 3)
  const spot = { left: spotLeft, top: rect.top - PAD, width: spotRight - spotLeft, height: rect.height + PAD * 2 }
  const cardW = Math.min(320, vw - 32)
  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height / 2

  // Barra lateral (escritorio): la tarjeta va a la derecha del botón; barra
  // inferior (móvil): arriba del botón (o debajo si el botón está en la mitad de arriba).
  const side = vw >= 768 && rect.right < vw * 0.4
  let cardStyle
  let arrowStyle
  let arrowClass
  if (side) {
    const top = Math.min(Math.max(centerY - cardH / 2, 12), Math.max(vh - cardH - 12, 12))
    const arrowY = Math.min(Math.max(centerY - top, 24), cardH - 24)
    cardStyle = { left: rect.right + PAD + GAP, top, width: cardW }
    arrowStyle = { left: -ARROW - 1, top: arrowY - ARROW }
    arrowClass = 'border-l-[2.5px] border-b-[2.5px]'
  } else {
    const left = Math.min(Math.max(centerX - cardW / 2, 16), vw - cardW - 16)
    const arrowX = Math.min(Math.max(centerX - left, 24), cardW - 24)
    if (rect.top > vh / 2) {
      cardStyle = { left, bottom: vh - rect.top + PAD + GAP, width: cardW }
      arrowStyle = { left: arrowX - ARROW, bottom: -ARROW - 1 }
      arrowClass = 'border-r-[2.5px] border-b-[2.5px]'
    } else {
      cardStyle = { left, top: rect.bottom + PAD + GAP, width: cardW }
      arrowStyle = { left: arrowX - ARROW, top: -ARROW - 1 }
      arrowClass = 'border-l-[2.5px] border-t-[2.5px]'
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label={t('tutorial.ariaLabel')}>
      {/* Bloquea los toques sobre la app mientras dura el tutorial */}
      <div className="absolute inset-0" />
      {/* Foco: oscurece todo menos el botón señalado */}
      <div
        className="tour-spot fixed rounded-2xl border-[3px] border-gold-400 pointer-events-none"
        style={{ ...spot, transition: 'left .25s ease, top .25s ease, width .25s ease, height .25s ease' }}
      />
      <div
        ref={cardRef}
        className="fixed rounded-2xl bg-cream-100 dark:bg-ink-800 border-[2.5px] border-ink-900 dark:border-cream-100/40 p-4 shadow-[0_6px_0_0_theme(colors.ink.900/25%)]"
        style={cardStyle}
      >
        <div
          className={`absolute w-4 h-4 rotate-45 bg-cream-100 dark:bg-ink-800 border-ink-900 dark:border-cream-100/40 ${arrowClass}`}
          style={arrowStyle}
          aria-hidden="true"
        />
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-2 min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wide text-violet-500 whitespace-nowrap">{t('tutorial.stepOf', { n: index + 1, total })}</p>
            <div className="flex gap-1" aria-hidden="true">
              {layout.steps.map((s, i) => (
                <span key={s.key} className={`w-1.5 h-1.5 rounded-full ${i === index ? 'bg-violet-500' : 'bg-ink-900/20 dark:bg-cream-100/25'}`} />
              ))}
            </div>
          </div>
          <button type="button" onClick={finish} className="text-xs font-semibold text-ink-900/50 dark:text-cream-100/50 hover:underline shrink-0">
            {t('tutorial.skip')}
          </button>
        </div>
        <h3 className="font-display text-lg font-bold mb-1">{t(`tutorial.steps.${current.key}.title`)}</h3>
        <p className="text-sm text-ink-900/75 dark:text-cream-100/75 mb-4">{t(`tutorial.steps.${current.key}.body`)}</p>
        <div className="flex justify-end gap-2">
          {index > 0 && (
            <button type="button" onClick={prev} className="btn-secondary text-sm px-3 py-1.5">
              {t('tutorial.back')}
            </button>
          )}
          <button type="button" onClick={next} className="btn-primary text-sm px-4 py-1.5">
            {isLast ? t('tutorial.done') : t('tutorial.next')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
