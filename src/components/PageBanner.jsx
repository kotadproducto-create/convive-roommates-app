import { Link } from 'react-router-dom'

const TONES = {
  // Mi perfil: lo personal — violeta
  violet: {
    box: 'bg-violet-100 dark:bg-violet-700/20 border-violet-500/40',
    badge: 'bg-violet-500 text-white',
    link: 'text-violet-600 dark:text-violet-200'
  },
  // Configuración: la aplicación — dorado
  gold: {
    box: 'bg-gold-100 dark:bg-gold-400/15 border-gold-500/50',
    badge: 'bg-gold-500 text-ink-900',
    link: 'text-ink-900 dark:text-gold-400'
  }
}

/**
 * Cabecera de "Mi perfil" y "Configuración": cada una con su propio color e
 * icono para que se distingan a simple vista, y un enlace a la otra por si
 * la opción que se busca está allí.
 */
export default function PageBanner({ tone, Icon, title, subtitle, linkTo, linkLabel }) {
  const c = TONES[tone]
  return (
    <div className={`card p-4 flex items-center gap-3 border-2 ${c.box}`}>
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${c.badge}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="font-display font-bold text-lg leading-tight">{title}</h2>
        <p className="text-xs text-ink-900/60 dark:text-cream-100/60">{subtitle}</p>
        <Link to={linkTo} className={`text-xs font-semibold hover:underline ${c.link}`}>
          {linkLabel} →
        </Link>
      </div>
    </div>
  )
}

/** Título de un grupo de tarjetas dentro de una de estas pantallas. */
export function SectionLabel({ children }) {
  return (
    <h3 className="text-xs font-bold uppercase tracking-wider text-ink-900/45 dark:text-cream-100/45 px-1 -mb-2 mt-1">{children}</h3>
  )
}
