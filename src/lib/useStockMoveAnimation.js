import { useEffect, useLayoutEffect, useRef } from 'react'

// clay-500 / gold-500 / sage-500 (tailwind.config.js), como r,g,b
const HALO_RGB = { out: '232,80,58', low: '224,163,44', ok: '63,174,106' }
const TOP_SAFE = 88 // barra superior fija
const BOTTOM_SAFE = 24

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

function readLayout(container) {
  const map = new Map()
  container.querySelectorAll('[data-flip-id]').forEach((el) => {
    // offsetLeft/Top ignoran los transform en curso: dan la posición "de verdad"
    map.set(el.dataset.flipId, { x: el.offsetLeft, y: el.offsetTop })
  })
  return map
}

/**
 * Lista de compras: al cambiar el stock de un producto (Con stock / Por
 * acabarse / Agotado) la lista se reordena sola. Para que no parezca que el
 * producto desapareció, este hook anima el traslado (técnica FLIP: mide la
 * posición antes y después del reordenamiento y desliza cada tarjeta de una
 * a otra), resalta la tarjeta movida con un halo del color de su nuevo
 * estado y, si el destino quedó fuera de pantalla, desplaza la vista
 * suavemente hasta ahí. No toca el estado ni el orden: solo lo anima.
 * Con "reducir movimiento" no hay deslizamientos ni zoom: solo el halo de
 * color y, si hace falta, un salto directo al destino.
 *
 * Requisitos: `containerRef` apunta al contenedor (con `position: relative`)
 * y cada tarjeta va envuelta en un elemento con `data-flip-id={item.id}`.
 * `items` = [{ id, stockLevel }] en el orden en que se dibujan.
 */
export function useStockMoveAnimation({ containerRef, items, active, onMoved }) {
  const snapshot = useRef({ layout: new Map(), levels: new Map(), order: '' })
  const onMovedRef = useRef(onMoved)
  onMovedRef.current = onMoved

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!active || !container) {
      snapshot.current = { layout: new Map(), levels: new Map(), order: '' }
      return
    }

    const layout = readLayout(container)
    const levels = new Map(items.map((i) => [i.id, i.stockLevel]))
    const order = items.map((i) => i.id).join('|')
    const prev = snapshot.current
    snapshot.current = { layout, levels, order }

    if (!prev.order) return // primera vez en pantalla: nada que animar

    const reduce = prefersReducedMotion()
    const movedIds = items.filter((i) => prev.levels.has(i.id) && prev.levels.get(i.id) !== i.stockLevel).map((i) => i.id)
    const nodes = [...container.querySelectorAll('[data-flip-id]')]

    nodes.forEach((el) => {
      const id = el.dataset.flipId
      const before = prev.layout.get(id)
      const after = layout.get(id)
      const isMoved = movedIds.includes(id)
      if (!after) return

      // Destino fuera de pantalla: en vez de deslizar la tarjeta fuera de la
      // vista (parecería que desaparece), se lleva la vista hasta ella.
      let offscreen = false
      if (isMoved) {
        const r = el.getBoundingClientRect()
        offscreen = r.top < TOP_SAFE || r.bottom > window.innerHeight - BOTTOM_SAFE
        if (offscreen) el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' })
      }

      if (!reduce && before && !(isMoved && offscreen)) {
        const dx = before.x - after.x
        const dy = before.y - after.y
        if (dx || dy) {
          el.getAnimations().forEach((a) => a.cancel())
          if (isMoved) {
            el.style.zIndex = '30'
            const anim = el.animate(
              [
                { transform: `translate(${dx}px, ${dy}px) scale(1)` },
                { transform: `translate(${dx / 2}px, ${dy / 2}px) scale(1.05)`, offset: 0.5 },
                { transform: 'translate(0, 0) scale(1)' }
              ],
              { duration: 560, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
            )
            anim.onfinish = anim.oncancel = () => {
              el.style.zIndex = ''
            }
          } else {
            el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }], {
              duration: 420,
              easing: 'cubic-bezier(0.22, 1, 0.36, 1)'
            })
          }
        }
      }

      if (isMoved) {
        const rgb = HALO_RGB[levels.get(id)] || HALO_RGB.ok
        const delay = reduce ? 0 : offscreen ? 350 : 250
        if (!reduce && offscreen) {
          // llegada: pequeño "pop" una vez que la vista ya llegó
          el.animate(
            [{ transform: 'scale(0.96)' }, { transform: 'scale(1.05)', offset: 0.55 }, { transform: 'scale(1)' }],
            { duration: 460, delay, easing: 'ease-out' }
          )
        }
        el.animate(
          [{ boxShadow: `0 0 0 0 rgba(${rgb},0.6)` }, { boxShadow: `0 0 0 12px rgba(${rgb},0)` }],
          { duration: 900, delay, iterations: 2, easing: 'ease-out' }
        )
      }
    })

    if (movedIds.length) onMovedRef.current?.(movedIds)
  })

  // Si cambia el tamaño del contenedor (rotar el móvil, cambiar de columnas),
  // las posiciones guardadas dejan de valer: se vuelven a medir sin animar.
  useEffect(() => {
    const container = containerRef.current
    if (!active || !container || typeof ResizeObserver === 'undefined') return undefined
    const ro = new ResizeObserver(() => {
      snapshot.current.layout = readLayout(container)
    })
    ro.observe(container)
    return () => ro.disconnect()
  }, [active, containerRef])
}
