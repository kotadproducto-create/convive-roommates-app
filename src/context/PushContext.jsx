import { createContext, useContext, useEffect, useState, useCallback } from 'react'

const PushContext = createContext(null)

const IS_IOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent)

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
}

// Toda llamada al SDK de OneSignal pasa por esta cola: el script carga con
// `defer` y puede no estar listo todavía cuando React monta, así que en vez
// de llamar a `window.OneSignal` directamente, se encola un callback que el
// propio SDK ejecuta en cuanto termina de inicializar (patrón oficial de
// OneSignal, ver index.html).
function withOneSignal(callback) {
  window.OneSignalDeferred = window.OneSignalDeferred || []
  window.OneSignalDeferred.push(callback)
}

export function PushProvider({ children }) {
  const [supported] = useState(() => typeof window !== 'undefined' && 'Notification' in window)
  const [subscribed, setSubscribed] = useState(false)

  useEffect(() => {
    if (!supported) return
    const appId = import.meta.env.VITE_ONESIGNAL_APP_ID
    if (!appId) {
      console.warn('Falta VITE_ONESIGNAL_APP_ID: las notificaciones push quedan desactivadas hasta configurarlo.')
      return
    }
    withOneSignal(async (OneSignal) => {
      try {
        await OneSignal.init({
          appId,
          serviceWorkerParam: { scope: '/' },
          serviceWorkerPath: '/OneSignalSDKWorker.js'
        })
        setSubscribed(!!OneSignal.User.PushSubscription.optedIn)
        OneSignal.User.PushSubscription.addEventListener('change', (event) => {
          setSubscribed(!!event.current?.optedIn)
        })
      } catch (err) {
        console.warn('No se pudo inicializar OneSignal:', err)
      }
    })
  }, [supported])

  const optIn = useCallback(() => {
    withOneSignal(async (OneSignal) => {
      try {
        await OneSignal.Notifications.requestPermission()
        await OneSignal.User.PushSubscription.optIn()
      } catch (err) {
        console.warn('No se pudo activar el permiso de notificaciones:', err)
      }
    })
  }, [])

  const optOut = useCallback(() => {
    withOneSignal(async (OneSignal) => {
      try {
        await OneSignal.User.PushSubscription.optOut()
      } catch (err) {
        console.warn('No se pudo desactivar el permiso de notificaciones:', err)
      }
    })
  }, [])

  const needsInstall = IS_IOS && !isStandalone()

  return (
    <PushContext.Provider value={{ supported, subscribed, needsInstall, optIn, optOut }}>
      {children}
    </PushContext.Provider>
  )
}

export function usePush() {
  const ctx = useContext(PushContext)
  if (!ctx) throw new Error('usePush debe usarse dentro de <PushProvider>')
  return ctx
}
