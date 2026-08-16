import { NavLink } from 'react-router-dom'
import { StampIcon, CalendarIcon, PinIcon, CoinIcon, JarIcon, HomeIcon, UsersIcon, CartIcon } from './icons'

const NAV_ITEMS = [
  { to: '/', label: 'Inicio', Icon: StampIcon, end: true },
  { to: '/calendario', label: 'Calendario', Icon: CalendarIcon },
  { to: '/compras', label: 'Compras', Icon: CartIcon },
  { to: '/incidencias', label: 'Muro', Icon: PinIcon },
  { to: '/convives', label: 'Convives', Icon: UsersIcon },
  { to: '/recompensas', label: 'Convis', Icon: CoinIcon },
  { to: '/pote', label: 'Pote', Icon: JarIcon },
  { to: '/piso', label: 'Piso', Icon: HomeIcon }
]

export default function Sidebar() {
  return (
    <>
      {/* Escritorio: barra lateral fija */}
      <aside className="hidden md:flex md:flex-col md:w-60 shrink-0 border-r border-ink-900/10 dark:border-cream-100/15 h-screen sticky top-0 p-5">
        <Brand />
        <nav className="mt-8 flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <NavItem key={item.to} {...item} />
          ))}
        </nav>
      </aside>

      {/* Móvil: barra inferior */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 dark:bg-ink-800/95 backdrop-blur border-t border-ink-900/10 dark:border-cream-100/15 flex justify-around py-2">
        {NAV_ITEMS.map(({ to, label, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-xs font-medium transition-transform duration-100 active:scale-90 ${
                isActive ? 'text-violet-500' : 'text-ink-900/60 dark:text-cream-100/60'
              }`
            }
          >
            <Icon className="w-5 h-5" />
            {label}
          </NavLink>
        ))}
      </nav>
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
        `flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-semibold transition-transform duration-100 active:scale-95 ${
          isActive
            ? 'bg-violet-50 text-violet-600 dark:bg-violet-700/25 dark:text-violet-100'
            : 'text-ink-900/70 dark:text-cream-100/70 hover:bg-cream-200 dark:hover:bg-ink-700'
        }`
      }
    >
      <Icon className="w-[18px] h-[18px]" />
      {label}
    </NavLink>
  )
}
