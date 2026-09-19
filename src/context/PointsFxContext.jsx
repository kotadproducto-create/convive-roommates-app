import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from './AuthContext'
import { CoinIcon } from '../components/icons'

/**
 * Animación al ganar puntos: unas fichas salen de donde el usuario tocó,
 * vuelan hasta el indicador de puntos de la cabecera (`data-points-target`)
 * y el número sube con un conteo corto. Solo mueve transform/opacity
 * (Web Animations API), así que va fluida en móvil, y se salta por
 * completo con "reducir movimiento".
 *
 *   const { fly } = usePointsFx()
 *   fly(2, { x, y })            // 2 fichas desde ese punto de la pantalla
 *   const shown = useDisplayedPoints()   // número que se pinta en el indicador
 *
 * El número mostrado se queda congelado mientras vuelan las fichas y
 * empieza a subir cuando llega la primera — así "se ve" que los puntos
 * se sumaron al saldo en vez de cambiar de golpe.
 */
const PointsFxContext = createContext(null)

const MAX_COINS = 7
const FLIGHT_MS = 620
const STAGGER_MS = 55
const SAFETY_MS = 3000

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

function Coin({ coin, onLand }) {
  const ref = useRef(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || !el.animate) {
      onLand(coin)
      return undefined
    }
    const { sx, sy, tx, ty, dx, dy } = coin
    const anim = el.animate(
      [
        { transform: `translate(${sx}px, ${sy}px) scale(0.4)`, opacity: 0, offset: 0, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
        { transform: `translate(${sx + dx}px, ${sy + dy}px) scale(1.1)`, opacity: 1, offset: 0.26, easing: 'cubic-bezier(0.5, 0, 0.9, 0.5)' },
        { transform: `translate(${tx}px, ${ty}px) scale(0.55)`, opacity: 0.95, offset: 1 }
      ],
      { duration: FLIGHT_MS, delay: coin.i * STAGGER_MS, fill: 'both' }
    )
    anim.onfinish = () => onLand(coin)
    return () => anim.cancel()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      ref={ref}
      className="absolute left-0 top-0 -ml-3 -mt-3 w-6 h-6 rounded-full bg-gold-400 border-2 border-ink-900 text-ink-900 flex items-center justify-center shadow-[0_2px_0_0_theme(colors.ink.900)] opacity-0"
      style={{ willChange: 'transform, opacity' }}
    >
      <CoinIcon className="w-3.5 h-3.5" />
    </div>
  )
}

function FloatingLabel({ label, onDone }) {
  const ref = useRef(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || !el.animate) {
      onDone(label)
      return undefined
    }
    const { x, y } = label
    const anim = el.animate(
      [
        { transform: `translate(${x}px, ${y + 10}px) scale(0.7)`, opacity: 0 },
        { transform: `translate(${x}px, ${y + 26}px) scale(1)`, opacity: 1, offset: 0.25 },
        { transform: `translate(${x}px, ${y + 44}px) scale(1)`, opacity: 0 }
      ],
      { duration: 900, easing: 'ease-out', fill: 'both' }
    )
    anim.onfinish = () => onDone(label)
    return () => anim.cancel()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      ref={ref}
      className="absolute left-0 top-0 -ml-5 rounded-full bg-gold-400 border-2 border-ink-900 px-2 text-xs font-extrabold text-ink-900 tabular-nums opacity-0"
      style={{ willChange: 'transform, opacity' }}
    >
      +{label.amount}
    </div>
  )
}

export function PointsFxProvider({ children }) {
  const [coins, setCoins] = useState([])
  const [labels, setLabels] = useState([])
  const [holding, setHolding] = useState(0) // vuelos en curso: el número no sube hasta que llega la primera ficha
  const [pulse, setPulse] = useState(0) // +1 por cada ficha que llega: el indicador "late"
  const batches = useRef(new Map())
  const nextBatch = useRef(0)

  const release = useCallback((batchId) => {
    const batch = batches.current.get(batchId)
    if (!batch || batch.released) return
    batch.released = true
    setHolding((h) => Math.max(0, h - 1))
  }, [])

  const fly = useCallback(
    (amount, from) => {
      const target = document.querySelector('[data-points-target]')
      if (!amount || amount < 1 || !from || !target || prefersReducedMotion()) return
      const rect = target.getBoundingClientRect()
      const tx = rect.left + rect.width / 2
      const ty = rect.top + rect.height / 2
      const count = Math.min(Math.round(amount), MAX_COINS)
      const batchId = nextBatch.current++
      batches.current.set(batchId, { remaining: count, amount, released: false })
      setHolding((h) => h + 1)
      setCoins((list) => [
        ...list,
        ...Array.from({ length: count }, (_, i) => ({
          id: `${batchId}-${i}`,
          batchId,
          i,
          sx: from.x,
          sy: from.y,
          tx,
          ty,
          dx: Math.round((Math.random() - 0.5) * 56),
          dy: Math.round(-14 - Math.random() * 26)
        }))
      ])
      // Por si algo impide que las fichas terminen (pestaña en segundo plano…).
      setTimeout(() => {
        release(batchId)
        batches.current.delete(batchId)
        setCoins((list) => list.filter((c) => c.batchId !== batchId))
      }, SAFETY_MS)
    },
    [release]
  )

  const handleLand = useCallback(
    (coin) => {
      setCoins((list) => list.filter((c) => c.id !== coin.id))
      const batch = batches.current.get(coin.batchId)
      if (!batch) return
      setPulse((p) => p + 1)
      release(coin.batchId)
      batch.remaining -= 1
      if (batch.remaining === 0) {
        batches.current.delete(coin.batchId)
        setLabels((l) => [...l, { id: coin.batchId, amount: batch.amount, x: coin.tx, y: coin.ty }])
      }
    },
    [release]
  )

  const handleLabelDone = useCallback((label) => setLabels((l) => l.filter((x) => x.id !== label.id)), [])

  const value = useMemo(() => ({ fly, holding, pulse }), [fly, holding, pulse])

  return (
    <PointsFxContext.Provider value={value}>
      {children}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
        {coins.map((c) => (
          <Coin key={c.id} coin={c} onLand={handleLand} />
        ))}
        {labels.map((l) => (
          <FloatingLabel key={l.id} label={l} onDone={handleLabelDone} />
        ))}
      </div>
    </PointsFxContext.Provider>
  )
}

export function usePointsFx() {
  const ctx = useContext(PointsFxContext)
  if (!ctx) throw new Error('usePointsFx debe usarse dentro de PointsFxProvider')
  return ctx
}

/** "Late" el elemento cada vez que llega una ficha (escala 1 → 1.16 → 1). */
export function usePointsPulse(ref) {
  const { pulse } = usePointsFx()
  const seen = useRef(pulse)
  useEffect(() => {
    if (pulse === seen.current) return
    seen.current = pulse
    ref.current?.animate?.(
      [{ transform: 'scale(1)' }, { transform: 'scale(1.16)', offset: 0.4 }, { transform: 'scale(1)' }],
      { duration: 280, easing: 'ease-out' }
    )
  }, [pulse, ref])
}

/**
 * Puntos del usuario para PINTAR: igual que user.points, pero congelado
 * mientras vuelan fichas y con un conteo corto (ease-out) hacia el
 * valor nuevo cuando llegan.
 */
export function useDisplayedPoints() {
  const { user } = useAuth()
  const { holding } = usePointsFx()
  const target = user?.points || 0
  const [shown, setShown] = useState(target)
  const shownRef = useRef(target)

  useEffect(() => {
    if (holding > 0 || shownRef.current === target) return undefined
    if (prefersReducedMotion()) {
      shownRef.current = target
      setShown(target)
      return undefined
    }
    const from = shownRef.current
    const duration = Math.min(700, 320 + Math.abs(target - from) * 40)
    const startedAt = performance.now()
    let raf
    const step = (now) => {
      const p = Math.min(1, (now - startedAt) / duration)
      const value = Math.round(from + (target - from) * (1 - Math.pow(1 - p, 3)))
      shownRef.current = value
      setShown(value)
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, holding])

  return shown
}
