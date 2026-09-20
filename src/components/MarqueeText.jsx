import { createElement, useEffect, useLayoutEffect, useRef, useState } from 'react'

const HOLD_MS = 1800 // pausa con el texto quieto, al inicio y al final
const SPEED_PX_PER_S = 28 // lento, para poder leerlo cómodamente
const MIN_MOVE_MS = 2400

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

/**
 * Texto de una sola línea que, SOLO si no cabe en su caja, se desplaza despacio
 * hacia un lado para mostrar la parte oculta, espera un momento, vuelve y
 * repite de forma pausada. Si cabe, queda quieto y sin ninguna animación. No
 * cambia el tamaño de la caja: recorta lo que sobra (overflow) y mueve el
 * texto por dentro. Es un reemplazo de las clases `truncate`.
 *
 * Con "reducir movimiento" activado no se anima: se recorta con "…" y el texto
 * completo queda en el atributo title.
 *
 *   <MarqueeText as="p" className="font-display font-semibold">{title}</MarqueeText>
 */
export default function MarqueeText({ as = 'span', className = '', children, ...rest }) {
  const boxRef = useRef(null)
  const textRef = useRef(null)
  const [overflow, setOverflow] = useState(0) // px que sobran (0 = cabe)
  const [reduced] = useState(prefersReducedMotion)

  // Mide si el texto cabe; se re-mide al cambiar el ancho de la caja, el
  // contenido o cuando terminan de cargar las tipografías.
  useLayoutEffect(() => {
    const box = boxRef.current
    const text = textRef.current
    if (!box || !text) return undefined
    const measure = () => {
      const extra = Math.ceil(text.getBoundingClientRect().width - box.clientWidth)
      setOverflow(extra > 1 ? extra : 0)
    }
    measure()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    ro?.observe(box)
    ro?.observe(text)
    document.fonts?.ready?.then(measure)
    window.addEventListener('resize', measure)
    return () => {
      ro?.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [children])

  // Inicio quieto → se desliza hasta el final → pausa → vuelve suave → repite.
  useEffect(() => {
    const text = textRef.current
    if (!text || !overflow || reduced || !text.animate) return undefined
    const move = Math.max(MIN_MOVE_MS, (overflow / SPEED_PX_PER_S) * 1000)
    const total = 2 * HOLD_MS + 2 * move
    const anim = text.animate(
      [
        { transform: 'translateX(0)', offset: 0, easing: 'linear' },
        { transform: 'translateX(0)', offset: HOLD_MS / total, easing: 'ease-in-out' },
        { transform: `translateX(-${overflow}px)`, offset: (HOLD_MS + move) / total, easing: 'linear' },
        { transform: `translateX(-${overflow}px)`, offset: (2 * HOLD_MS + move) / total, easing: 'ease-in-out' },
        { transform: 'translateX(0)', offset: 1 }
      ],
      { duration: total, iterations: Infinity }
    )
    return () => anim.cancel()
  }, [overflow, reduced])

  const animating = overflow > 0 && !reduced
  return createElement(
    as,
    {
      ref: boxRef,
      className: `block overflow-hidden whitespace-nowrap ${reduced ? 'text-ellipsis' : ''} ${className}`,
      title: overflow > 0 && typeof children === 'string' ? children : undefined,
      ...rest
    },
    <span ref={textRef} className={reduced ? '' : 'inline-block will-change-transform'} data-marquee={animating ? 'on' : 'off'}>
      {children}
    </span>
  )
}
