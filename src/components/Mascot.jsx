/**
 * Blob redondo de Convive: mismo trazo grueso y cara simple que el resto
 * del set de iconos, con la moneda de las recompensas como marca propia (para no
 * repetir el mascota de ninguna otra app). Se usa como toque de bienvenida
 * en pantallas de auth y estados vacíos — nunca como icono funcional.
 */
export default function Mascot({ className = 'w-24 h-24', wobble = true }) {
  return (
    <svg
      viewBox="0 0 140 140"
      fill="none"
      className={`text-ink-900 dark:text-cream-100 ${className}`}
      role="img"
      aria-label="Mascota de Convive"
    >
      <g className={wobble ? 'mascot-wobble' : ''} style={{ transformOrigin: '50% 92%' }}>
        <ellipse cx="70" cy="118" rx="30" ry="6" fill="currentColor" opacity="0.1" />
        <path
          d="M70 22c26 0 42 19 42 46 0 30-19 48-42 48S28 98 28 68c0-27 16-46 42-46Z"
          className="fill-gold-100 dark:fill-gold-400/25"
          stroke="currentColor"
          strokeWidth="3.5"
        />
        <circle cx="56" cy="66" r="5.5" fill="currentColor" />
        <circle cx="86" cy="66" r="5.5" fill="currentColor" />
        <path d="M55 84c6 7 24 7 30 0" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" fill="none" />
        <path d="M40 52c-8-6-9-16-4-20" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" fill="none" />
        <path d="M100 52c8-6 9-16 4-20" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" fill="none" />
        <circle cx="30" cy="20" r="9" className="fill-coral-100 dark:fill-coral-500/25" stroke="currentColor" strokeWidth="3" />
        <text x="30" y="24" fontFamily="Baloo 2, sans-serif" fontWeight="800" fontSize="10" textAnchor="middle" fill="currentColor">
          ₡
        </text>
      </g>
    </svg>
  )
}
