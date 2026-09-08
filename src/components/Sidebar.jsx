import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext'
import { StampIcon, CalendarIcon, PinIcon, CoinIcon, JarIcon, HomeIcon, UsersIcon, CartIcon, SparkleIcon, MoreIcon, CloseIcon, PersonIcon } from './icons'

// `labelKey` en vez de texto fijo — se traduce con t() en el propio
// componente (ver src/lib/i18n/{es,en}.js, namespace `nav`).
const NAV_ITEMS = [
  { to: '/', labelKey: 'nav.inicio', Icon: StampIcon, end: true },
  { to: '/actividades', labelKey: 'nav.actividades', Icon: SparkleIcon },
  { to: '/calendario', labelKey: 'nav.calendario', Icon: CalendarIcon },
  { to: '/compras', labelKey: 'nav.compras', Icon: CartIcon },
  { to: '/incidencias', labelKey: 'nav.muro', Icon: PinIcon },
  { to: '/convives', labelKey: 'nav.convives', Icon: UsersIcon },
  { to: '/recompensas', labelKey: 'nav.recompensas', Icon: CoinIcon },
  { to: '/pote', labelKey: 'nav.pote', Icon: JarIcon },
  { to: '/piso', labelKey: 'nav.piso', Icon: HomeIcon },
  { to: '/perfil', labelKey: 'nav.perfil', Icon: PersonIcon }
]

// En móvil solo hay sitio cómodo para 4 pestañas + el botón "Más"; el
// resto vive en una hoja inferior. El escritorio sigue mostrando todas.
const MOBILE_PRIMARY_PATHS = ['/', '/calendario', '/compras', '/pote']

export default function Sidebar() {
  const [showMore, setShowMore] = useState(false)
  const location = useLocation()
  const { t } = useLanguage()

  const primaryItems = NAV_ITEMS.filter((item) => MOBILE_PRIMARY_PATHS.includes(item.to))
  const moreItems = NAV_ITEMS.filter((item) => !MOBILE_PRIMARY_PATHS.includes(item.to))
  const isMoreActive = moreItems.some((item) => item.to === location.pathname)

  return (
    <>
      {/* Escritorio: barra lateral fija (también aparece en celular
          horizontal ancho, ya que "md" es por ancho — con overflow-y-auto
          por si la pantalla queda muy baja y no entran las 9 pestañas) */}
      <aside className="hidden md:flex md:flex-col md:w-60 shrink-0 border-r border-ink-900/10 dark:border-cream-100/15 h-screen sticky top-0 overflow-y-auto p-5 landscape-sm:p-3">
        <Brand />
        <nav className="mt-8 landscape-sm:mt-3 flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <NavItem key={item.to} {...item} label={t(item.labelKey)} />
          ))}
        </nav>
      </aside>

      {/* Móvil: barra inferior con 4 fijas + "Más" — más compacta en
          celular horizontal bajo, para no comerse media pantalla */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 dark:bg-ink-800/95 backdrop-blur border-t-[2.5px] border-ink-900 dark:border-cream-100/40 flex justify-around py-2 landscape-sm:py-1">
        {primaryItems.map(({ to, labelKey, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-3 py-1 landscape-sm:px-2 landscape-sm:py-0.5 rounded-lg text-xs font-medium transition-transform duration-100 active:scale-90 ${
                isActive ? 'text-ink-900 dark:text-cream-100' : 'text-ink-900/60 dark:text-cream-100/60'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={`w-8 h-8 landscape-sm:w-6 landscape-sm:h-6 rounded-xl flex items-center justify-center ${
                    isActive ? 'bg-gold-100 dark:bg-gold-400/25 border-2 border-ink-900 dark:border-cream-100/50' : ''
                  }`}
                >
                  <Icon className="w-5 h-5 landscape-sm:w-4 landscape-sm:h-4" />
                </span>
                <span className="landscape-sm:hidden">{t(labelKey)}</span>
              </>
            )}
          </NavLink>
        ))}
        <button
          type="button"
          onClick={() => setShowMore(true)}
          className={`flex flex-col items-center gap-0.5 px-3 py-1 landscape-sm:px-2 landscape-sm:py-0.5 rounded-lg text-xs font-medium transition-transform duration-100 active:scale-90 ${
            isMoreActive ? 'text-ink-900 dark:text-cream-100' : 'text-ink-900/60 dark:text-cream-100/60'
          }`}
        >
          <span
            className={`w-8 h-8 landscape-sm:w-6 landscape-sm:h-6 rounded-xl flex items-center justify-center ${
              isMoreActive ? 'bg-gold-100 dark:bg-gold-400/25 border-2 border-ink-900 dark:border-cream-100/50' : ''
            }`}
          >
            <MoreIcon className="w-5 h-5 landscape-sm:w-4 landscape-sm:h-4" />
          </span>
          <span className="landscape-sm:hidden">{t('nav.more')}</span>
        </button>
      </nav>

      {showMore && (
        <div className="md:hidden fixed inset-0 z-40 bg-ink-900/40 backdrop-blur-sm flex items-end" onClick={() => setShowMore(false)}>
          <div
            className="w-full bg-cream-100 dark:bg-ink-800 border-t-[2.5px] border-ink-900 dark:border-cream-100/40 rounded-t-2xl p-5 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <p className="font-display font-bold text-lg">{t('nav.more')}</p>
              <button
                type="button"
                onClick={() => setShowMore(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-cream-200 dark:hover:bg-ink-700"
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {moreItems.map(({ to, labelKey, Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  onClick={() => setShowMore(false)}
                  className={({ isActive }) =>
                    `flex flex-col items-center gap-1.5 py-3 rounded-xl text-xs font-semibold border-2 ${
                      isActive
                        ? 'bg-gold-100 dark:bg-gold-400/25 border-ink-900 dark:border-cream-100/50 text-ink-900 dark:text-cream-100'
                        : 'border-transparent text-ink-900/70 dark:text-cream-100/70 hover:bg-cream-200 dark:hover:bg-ink-700'
                    }`
                  }
                >
                  <Icon className="w-5 h-5" />
                  {t(labelKey)}
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <svg width="32" height="32" viewBox="0 0 32 32" className="chore-wheel shrink-0">
        <circle cx="16" cy="16" r="13.5" fill="none" stroke="currentColor" className="text-ink-900 dark:text-cream-100" strokeWidth="2" strokeDasharray="1 7" strokeLinecap="round" opacity="0.5" />
        <circle cx="16" cy="7.5" r="4" fill="#6B4FE0" />
        <circle cx="8.5" cy="20.5" r="3" fill="#FF6B4A" />
        <circle cx="23.5" cy="20.5" r="2.6" fill="#F5B942" />
        <path d="M16 11 10.5 18.5M16 11 21.5 18" stroke="#17131C" strokeWidth="1.4" strokeLinecap="round" opacity="0.55" />
      </svg>
      <span className="font-display font-bold text-lg tracking-tight">Convive</span>
    </div>
  )
}

function NavItem({ to, label, Icon, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-semibold border-2 transition-transform duration-100 active:scale-95 ${
          isActive
            ? 'bg-gold-100 dark:bg-gold-400/25 border-ink-900 dark:border-cream-100/50 text-ink-900 dark:text-cream-100'
            : 'border-transparent text-ink-900/70 dark:text-cream-100/70 hover:bg-cream-200 dark:hover:bg-ink-700'
        }`
      }
    >
      <Icon className="w-[18px] h-[18px]" />
      {label}
    </NavLink>
  )
}
