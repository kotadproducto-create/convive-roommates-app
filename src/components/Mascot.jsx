/**
 * Mascota de Convive: una llave simple, sin cara — cada roommate es una
 * llave más del piso. Mismo trazo grueso que el resto del set de iconos.
 * Se usa como toque de bienvenida en pantallas de auth y estados vacíos —
 * nunca como icono funcional.
 */
export default function Mascot({ className = 'w-24 h-24', wobble = true }) {
  return (
    <svg
      viewBox="0 0 140 140"
      fill="none"
      className={`text-ink-900 dark:text-cream-100 ${className}`}
      role="img"
      aria-label="Mascota de Convive: una llave"
    >
      <g className={wobble ? 'mascot-wobble' : ''} style={{ transformOrigin: '50% 20%' }}>
        <ellipse cx="70" cy="122" rx="24" ry="6" fill="currentColor" opacity="0.1" />

        {/* Paletón (el cuerpo) — se dibuja antes que el ojal para que este
            lo tape y no se note la costura entre ambos. */}
        <rect
          x="59"
          y="56"
          width="22"
          height="54"
          rx="7"
          className="fill-gold-100 dark:fill-gold-400/25"
          stroke="currentColor"
          strokeWidth="3.5"
        />
        {/* Dientes */}
        <rect x="81" y="80" width="14" height="9" rx="3" className="fill-gold-100 dark:fill-gold-400/25" stroke="currentColor" strokeWidth="3" />
        <rect x="81" y="95" width="18" height="9" rx="3" className="fill-gold-100 dark:fill-gold-400/25" stroke="currentColor" strokeWidth="3" />

        {/* Ojal, con el agujero real (fill-rule evenodd) para que se vea
            el fondo detrás, sin depender de un color fijo. */}
        <path
          fillRule="evenodd"
          d="M70,14 a22,22 0 1,0 0.01,0 Z M70,27 a9,9 0 1,0 0.01,0 Z"
          className="fill-gold-100 dark:fill-gold-400/25"
          stroke="currentColor"
          strokeWidth="3.5"
        />
      </g>
    </svg>
  )
}
