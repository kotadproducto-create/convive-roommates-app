import { NavLink } from 'react-router-dom'

const NAV_ITEMS = [
  { to: '/', label: 'Calendario', icon: '📅', end: true },
  { to: '/incidencias', label: 'Muro', icon: '📌' },
  { to: '/recompensas', label: 'Puntos', icon: '🏆' },
  { to: '/piso', label: 'Piso', icon: '🏠' }
]

export default function Sidebar() {
  return (
    <>
      {/* Escritorio: barra lateral fija */}
      <aside className="hidden md:flex md:flex-col md:w-60 shrink-0 border-r border-linen-200 dark:border-charcoal-700 h-screen sticky top-0 p-5">
        <Brand />
        <nav className="mt-8 flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <NavItem key={item.to} {...item} />
          ))}
        </nav>
      </aside>

      {/* Móvil: barra inferior */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 dark:bg-charcoal-800/95 backdrop-blur border-t border-linen-200 dark:border-charcoal-700 flex justify-around py-2">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-xs ${
                isActive ? 'text-plum-500' : 'text-charcoal-900/60 dark:text-linen-100/60'
              }`
            }
          >
            <span className="text-lg leading-none">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </>
  )
}

function Brand() {
  return (
    <div className="flex items-center gap-2">
      <svg width="30" height="30" viewBox="0 0 30 30" className="chore-wheel">
        <circle cx="15" cy="15" r="13" fill="none" stroke="#5B4B8A" strokeWidth="2.5" />
        <path d="M15 2 A13 13 0 0 1 26.25 8.5" fill="none" stroke="#E8A33D" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="15" cy="15" r="3" fill="#5B4B8A" />
      </svg>
      <span className="font-display font-semibold text-lg">Convive</span>
    </div>
  )
}

function NavItem({ to, label, icon, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
          isActive
            ? 'bg-plum-50 text-plum-600 dark:bg-plum-700/30 dark:text-plum-100'
            : 'text-charcoal-900/70 dark:text-linen-100/70 hover:bg-linen-100 dark:hover:bg-charcoal-700'
        }`
      }
    >
      <span className="text-base">{icon}</span>
      {label}
    </NavLink>
  )
}
