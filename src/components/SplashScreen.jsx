import Mascot from './Mascot'

/**
 * Pantalla de carga inicial: se ve mientras se resuelve la sesión (ver
 * ProtectedRoute), que hasta ahora era una pantalla en blanco. Reutiliza
 * la misma identidad de marca que AuthShell (Login/Register) — mascota,
 * "rueda de tareas" y tipografía Propilen — para que la transición de
 * abrir la app a ver el login o el Inicio se sienta continua, no como
 * dos apps distintas.
 */
export default function SplashScreen() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-cream-100 dark:bg-ink-900 overflow-hidden">
      <div className="dot-grid absolute inset-0 text-ink-900/[0.06] dark:text-cream-100/[0.05] pointer-events-none" />
      <div className="relative flex flex-col items-center gap-3">
        <Mascot className="w-20 h-20 mb-1" />
        <div className="flex items-center gap-2.5">
          <svg width="32" height="32" viewBox="0 0 32 32" className="chore-wheel">
            <circle cx="16" cy="16" r="13.5" fill="none" stroke="currentColor" className="text-ink-900 dark:text-cream-100" strokeWidth="2" strokeDasharray="1 7" strokeLinecap="round" opacity="0.5" />
            <circle cx="16" cy="7.5" r="4" fill="#6B4FE0" />
            <circle cx="8.5" cy="20.5" r="3" fill="#FF6B4A" />
            <circle cx="23.5" cy="20.5" r="2.6" fill="#F5B942" />
            <path d="M16 11 10.5 18.5M16 11 21.5 18" stroke="#17131C" strokeWidth="1.4" strokeLinecap="round" opacity="0.55" />
          </svg>
          <span className="font-display font-bold text-2xl tracking-tight text-ink-900 dark:text-cream-100">Convive</span>
        </div>
        <div className="flex items-center gap-1.5 mt-1" role="status" aria-label="Cargando">
          <span className="w-2 h-2 rounded-full bg-violet-500 splash-dot" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 rounded-full bg-coral-400 splash-dot" style={{ animationDelay: '160ms' }} />
          <span className="w-2 h-2 rounded-full bg-gold-400 splash-dot" style={{ animationDelay: '320ms' }} />
        </div>
      </div>
    </div>
  )
}
