/**
 * Set de iconos propio de Convive — líneas de 1.6px, esquinas redondeadas.
 * Sustituye a los emoji del sistema para que la app tenga una sola familia
 * visual en vez de depender de cómo cada dispositivo dibuje 🛒🗑️🧺.
 */
function IconBase({ children, className = 'w-5 h-5', ...props }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {children}
    </svg>
  )
}

export function CartIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M3 4h2l1.6 9.2a1.6 1.6 0 0 0 1.58 1.3h6.1a1.6 1.6 0 0 0 1.58-1.35L17 7H5.4" />
      <circle cx="8.5" cy="17" r="1.15" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="17" r="1.15" fill="currentColor" stroke="none" />
    </IconBase>
  )
}

export function TrashIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M4.5 6h11l-.8 10.2a1.6 1.6 0 0 1-1.6 1.5H6.9a1.6 1.6 0 0 1-1.6-1.5L4.5 6Z" />
      <path d="M3 6h14M8 6V4.6A1.1 1.1 0 0 1 9.1 3.5h1.8A1.1 1.1 0 0 1 12 4.6V6" />
      <path d="M8.3 9v5M11.7 9v5" />
    </IconBase>
  )
}

export function WasherIcon(props) {
  return (
    <IconBase {...props}>
      <rect x="3" y="3" width="14" height="14" rx="3.2" />
      <circle cx="10" cy="11.3" r="3.7" />
      <path d="M10 11.3a3.7 2.2 0 0 0 2.6-1.05" />
      <path d="M6.3 5.4h.01M8.6 5.4h.01" />
    </IconBase>
  )
}

/** Símbolo de Convis: una ficha, no un signo de dinero. */
export function CoinIcon(props) {
  return (
    <IconBase {...props}>
      <circle cx="10" cy="10" r="7.4" />
      <path d="M10 6.2v7.6M7.4 10h5.2" />
    </IconBase>
  )
}

export function CalendarIcon(props) {
  return (
    <IconBase {...props}>
      <rect x="3" y="4.3" width="14" height="12.2" rx="2.4" />
      <path d="M3 8.4h14M6.6 2.8v3M13.4 2.8v3" />
      <circle cx="7" cy="11.8" r="0.9" fill="currentColor" stroke="none" />
    </IconBase>
  )
}

export function PinIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M10 17.3S15 12.4 15 8.4a5 5 0 1 0-10 0c0 4 5 8.9 5 8.9Z" />
      <circle cx="10" cy="8.3" r="2" />
    </IconBase>
  )
}

export function HomeIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M3.3 9.6 10 3.7l6.7 5.9" />
      <path d="M5.2 8.3V16a1 1 0 0 0 1 1h7.6a1 1 0 0 0 1-1V8.3" />
      <path d="M8 17v-4.2h4V17" />
    </IconBase>
  )
}

export function BellIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M6 8a4 4 0 1 1 8 0c0 3.4 1.2 4.6 1.6 5.2H4.4C4.8 12.6 6 11.4 6 8Z" />
      <path d="M8.3 15.6a1.8 1.8 0 0 0 3.4 0" />
    </IconBase>
  )
}

export function MoonIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M16.2 12.4A6.6 6.6 0 1 1 7.6 3.8a5.3 5.3 0 0 0 8.6 8.6Z" />
    </IconBase>
  )
}

export function SunIcon(props) {
  return (
    <IconBase {...props}>
      <circle cx="10" cy="10" r="3.4" />
      <path d="M10 2.8v1.9M10 15.3v1.9M17.2 10h-1.9M4.7 10H2.8M15.1 4.9l-1.35 1.35M6.25 13.75 4.9 15.1M15.1 15.1l-1.35-1.35M6.25 6.25 4.9 4.9" />
    </IconBase>
  )
}

export function ShareIcon(props) {
  return (
    <IconBase {...props}>
      <circle cx="15" cy="5" r="2" />
      <circle cx="5" cy="10" r="2" />
      <circle cx="15" cy="15" r="2" />
      <path d="M6.7 9 13.3 6M6.7 11l6.6 3" />
    </IconBase>
  )
}

export function ChevronUpIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M5 12.5 10 7.5 15 12.5" />
    </IconBase>
  )
}

export function ChevronDownIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M5 7.5 10 12.5 15 7.5" />
    </IconBase>
  )
}

/** El sello de racha: un check dentro de un borde festoneado, como una medalla. */
export function StampIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M10 2.6c.55.85 1.5 1.15 2.4.75.8.6 1.25 1.5 1.1 2.45.9.35 1.5 1.15 1.5 2.15s-.6 1.8-1.5 2.15c.15.95-.3 1.85-1.1 2.45-.9-.4-1.85-.1-2.4.75-.55-.85-1.5-1.15-2.4-.75-.8-.6-1.25-1.5-1.1-2.45-.9-.35-1.5-1.15-1.5-2.15s.6-1.8 1.5-2.15c-.15-.95.3-1.85 1.1-2.45.9.4 1.85.1 2.4-.75Z" />
      <path d="M7.4 10.2l1.8 1.8 3.4-3.6" />
      <path d="M8 14.8 7.3 18l2.7-1.4L12.7 18l-.7-3.2" opacity="0.6" />
    </IconBase>
  )
}

export function DropletIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M10 2.8s4.6 5.3 4.6 8.7a4.6 4.6 0 1 1-9.2 0c0-3.4 4.6-8.7 4.6-8.7Z" />
      <path d="M7.6 12.1a2.4 2.4 0 0 0 2.1 2.3" opacity="0.6" />
    </IconBase>
  )
}

export function JarIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M6.6 6.4h6.8l.7 9.1a1.6 1.6 0 0 1-1.6 1.7H7.5a1.6 1.6 0 0 1-1.6-1.7l.7-9.1Z" />
      <path d="M6.3 6.4a1.9 1.9 0 0 1 1.9-1.8h3.6a1.9 1.9 0 0 1 1.9 1.8" />
      <path d="M8.2 4.6V3.4h3.6v1.2" />
      <path d="M7.2 10.6h5.6" opacity="0.6" />
    </IconBase>
  )
}

export function SparkleIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M9.6 3.2c.3 2.5 1 3.2 3.5 3.5-2.5.3-3.2 1-3.5 3.5-.3-2.5-1-3.2-3.5-3.5 2.5-.3 3.2-1 3.5-3.5Z" />
      <path d="M14.8 11c.2 1.5.6 1.9 2.1 2.1-1.5.2-1.9.6-2.1 2.1-.2-1.5-.6-1.9-2.1-2.1 1.5-.2 1.9-.6 2.1-2.1Z" />
    </IconBase>
  )
}

export function PhoneIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M5.3 3.6h2.1l1 3.3-1.6 1.4a9.4 9.4 0 0 0 4 4l1.4-1.6 3.3 1v2.1a1.4 1.4 0 0 1-1.5 1.4A13 13 0 0 1 4 4.1a1.4 1.4 0 0 1 1.3-1.5Z" />
    </IconBase>
  )
}

export function EditIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M12.6 3.4a1.6 1.6 0 0 1 2.3 2.3L6.4 14.2l-3 .7.7-3Z" />
      <path d="M11 5l3 3" />
    </IconBase>
  )
}

export function CloseIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M5 5l10 10M15 5 5 15" />
    </IconBase>
  )
}

export function PlusIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M10 4.5v11M4.5 10h11" />
    </IconBase>
  )
}

export function MinusIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M4.5 10h11" />
    </IconBase>
  )
}

export function UsersIcon(props) {
  return (
    <IconBase {...props}>
      <circle cx="7.3" cy="6.8" r="2.6" />
      <path d="M2.4 16.2a5 5 0 0 1 9.8 0" />
      <path d="M12.6 4.3a2.6 2.6 0 0 1 0 5" />
      <path d="M14.3 11.6a5 4.4 0 0 1 3.3 4.6" />
    </IconBase>
  )
}

export function AlertIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M10 2.8 17.5 16H2.5L10 2.8Z" />
      <path d="M10 8.2v3.4" />
      <circle cx="10" cy="14.1" r="0.9" fill="currentColor" stroke="none" />
    </IconBase>
  )
}

export function StoreIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M3.2 7.4 4.4 3.6h11.2l1.2 3.8" />
      <path d="M3.2 7.4a2 2 0 0 0 4 .3 2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4-.3" />
      <path d="M4.4 8.6V16h11.2V8.6" />
      <path d="M8.2 16v-3.6h3.6V16" />
    </IconBase>
  )
}

export function MoreIcon(props) {
  return (
    <IconBase {...props}>
      <circle cx="4.5" cy="10" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="10" cy="10" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="10" r="1.2" fill="currentColor" stroke="none" />
    </IconBase>
  )
}

export const TASK_ICONS = {
  cart: CartIcon,
  trash: TrashIcon,
  washer: WasherIcon
}
