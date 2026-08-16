import { createContext, useCallback, useContext, useRef, useState } from 'react'

const ToastContext = createContext(null)
let idCounter = 0

const TONE_CLASSES = {
  default: 'bg-white dark:bg-ink-800 border-ink-900/15 dark:border-cream-100/20 text-ink-900 dark:text-cream-100',
  success: 'bg-gold-400 border-ink-900 text-ink-900',
  info: 'bg-violet-500 border-ink-900 text-white'
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef({})

  const dismissToast = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id))
    clearTimeout(timers.current[id])
    delete timers.current[id]
  }, [])

  const showToast = useCallback(
    (message, tone = 'default', duration = 4000) => {
      const id = ++idCounter
      setToasts((t) => [...t, { id, message, tone }])
      timers.current[id] = setTimeout(() => dismissToast(id), duration)
    },
    [dismissToast]
  )

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 w-[calc(100%-2rem)] max-w-sm">
        {toasts.map((t) => (
          <div
            key={t.id}
            onClick={() => dismissToast(t.id)}
            role="status"
            className={`toast-pop rounded-xl2 border-2 shadow-lg px-4 py-3 text-sm font-semibold cursor-pointer ${
              TONE_CLASSES[t.tone] || TONE_CLASSES.default
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast debe usarse dentro de <ToastProvider>')
  return ctx
}
