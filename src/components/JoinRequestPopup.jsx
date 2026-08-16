import { useEffect, useRef, useState } from 'react'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'

/**
 * Pop-up de admisión: al entrar a la app, intenta "reclamar" las
 * solicitudes pendientes del piso (ver claimPendingJoinRequests en
 * db.js). Solo se muestra a quien gana esa carrera — el resto de
 * miembros puede seguir viéndolas y decidiéndolas desde Piso →
 * Solicitudes pendientes, así ninguna solicitud queda huérfana si esta
 * persona no vuelve a abrir la app.
 */
export default function JoinRequestPopup() {
  const { floor, claimJoinRequests, approveJoinRequest, rejectJoinRequest } = useData()
  const { showToast } = useToast()
  const [queue, setQueue] = useState([])
  const [deciding, setDeciding] = useState(false)
  const claimedFloorRef = useRef(null)

  useEffect(() => {
    if (!floor) return
    // React.StrictMode invoca este efecto dos veces en desarrollo (monta,
    // limpia, vuelve a montar en el mismo ciclo). Esta guarda evita
    // disparar el reclamo dos veces; a propósito no se aborta con un
    // flag de "cancelled" ligado al cleanup, porque ese cleanup fantasma
    // de StrictMode se dispara ANTES de que la promesa resuelva y
    // descartaría el resultado aunque el componente siga montado de verdad.
    if (claimedFloorRef.current === floor.id) return
    claimedFloorRef.current = floor.id
    claimJoinRequests().then((rows) => {
      if (rows.length) setQueue(rows)
    })
  }, [floor?.id])

  if (!queue.length) return null

  const current = queue[0]

  async function handleDecision(accept) {
    setDeciding(true)
    try {
      if (accept) {
        await approveJoinRequest(current.membershipId, current.requesterId, current.requesterName)
        showToast(`${current.requesterName} se unió al piso`, 'success')
      } else {
        await rejectJoinRequest(current.membershipId)
        showToast(`Rechazaste la solicitud de ${current.requesterName}`, 'default')
      }
      setQueue((q) => q.slice(1))
    } finally {
      setDeciding(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-ink-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="card p-6 w-full max-w-sm flex flex-col gap-4 text-center">
        <div className="w-14 h-14 rounded-full bg-violet-500 border-2 border-ink-900 text-cream-100 flex items-center justify-center text-xl font-bold mx-auto">
          {current.requesterName[0]?.toUpperCase()}
        </div>
        <div>
          <h3 className="font-display font-bold text-lg">Nueva solicitud</h3>
          <p className="text-sm text-ink-900/70 dark:text-cream-100/70 mt-1">
            <strong>{current.requesterName}</strong> quiere unirse al piso <strong>{floor?.name}</strong>.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={deciding}
            onClick={() => handleDecision(false)}
            className="btn-danger text-sm flex-1"
          >
            Rechazar
          </button>
          <button
            type="button"
            disabled={deciding}
            onClick={() => handleDecision(true)}
            className="btn-primary text-sm flex-1"
          >
            Aceptar
          </button>
        </div>
        {queue.length > 1 && (
          <p className="text-xs text-ink-900/40 dark:text-cream-100/40">
            +{queue.length - 1} solicitud{queue.length - 1 > 1 ? 'es' : ''} más en espera
          </p>
        )}
      </div>
    </div>
  )
}
