import { useLanguage } from '../context/LanguageContext'

// Banderas en SVG: los emojis de bandera no se dibujan en Windows (salen como
// "ES"/"GB"), así que se ven igual en cualquier dispositivo.
function SpainFlag() {
  return (
    <svg viewBox="0 0 60 40" className="w-5 h-[14px] rounded-[2px] shrink-0" aria-hidden="true">
      <rect width="60" height="40" fill="#AA151B" />
      <rect y="10" width="60" height="20" fill="#F1BF00" />
    </svg>
  )
}

function UKFlag() {
  return (
    <svg viewBox="0 0 60 40" className="w-5 h-[14px] rounded-[2px] shrink-0" aria-hidden="true">
      <rect width="60" height="40" fill="#012169" />
      <path d="M0 0 60 40M60 0 0 40" stroke="#fff" strokeWidth="8" />
      <path d="M0 0 60 40M60 0 0 40" stroke="#C8102E" strokeWidth="3" />
      <path d="M30 0v40M0 20h60" stroke="#fff" strokeWidth="13" />
      <path d="M30 0v40M0 20h60" stroke="#C8102E" strokeWidth="8" />
    </svg>
  )
}

const LANGUAGES = [
  { code: 'es', Flag: SpainFlag, name: 'Español', short: 'ES' },
  { code: 'en', Flag: UKFlag, name: 'English', short: 'EN' }
]

/**
 * Selector de idioma — el ÚNICO que usa la app (Ajustes y las pantallas de
 * acceso). Cambia el mismo `language` de LanguageContext, que ya se guarda
 * en localStorage, así que lo elegido antes de iniciar sesión o registrarse
 * se mantiene después sin hacer nada más.
 *
 * variant "full": bandera + nombre (pantallas de acceso); "compact": ES / EN.
 */
export default function LanguageSwitcher({ variant = 'full', className = '' }) {
  const { language, setLanguage, t } = useLanguage()
  return (
    <div
      role="group"
      aria-label={t('topbar.language')}
      className={`inline-flex bg-cream-200 dark:bg-ink-700 rounded-xl p-0.5 text-xs font-semibold ${className}`}
    >
      {LANGUAGES.map((l) => (
        <button
          key={l.code}
          type="button"
          onClick={() => setLanguage(l.code)}
          aria-pressed={language === l.code}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg ${language === l.code ? 'bg-white dark:bg-ink-800 shadow-sm' : 'opacity-60'}`}
        >
          {variant === 'full' ? (
            <>
              <l.Flag />
              {l.name}
            </>
          ) : (
            l.short
          )}
        </button>
      ))}
    </div>
  )
}
