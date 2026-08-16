import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { AuthShell } from './Login'

/**
 * Pantalla que ve cualquier usuario autenticado sin piso activo: mientras
 * espera respuesta a una solicitud, si se la rechazaron, o si todavía no
 * ha pedido unirse a ninguno (p. ej. lo expulsaron de su piso anterior).
 * Sustituye a las páginas normales en ProtectedRoute hasta que haya un
 * piso activo — así no hace falta repetir esta comprobación en cada una.
 */
export default function NoFloor() {
  const { pendingRequest, withdrawRequest, requestJoinFloor, logout } = useAuth()

  if (pendingRequest?.status === 'pending') {
    return (
      <AuthShell>
        <h1 className="font-display text-xl font-bold tracking-tight mb-1">Solicitud enviada</h1>
        <p className="text-sm text-ink-900/70 dark:text-cream-100/70 mb-5">
          Tu solicitud para unirte a <strong>{pendingRequest.floorName}</strong> está pendiente de aprobación por
          parte de los miembros del piso. Te avisaremos aquí en cuanto alguien decida.
        </p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            className="btn-secondary text-sm"
            onClick={() => withdrawRequest(pendingRequest.id)}
          >
            Cancelar solicitud
          </button>
          <button type="button" className="text-xs font-semibold text-ink-900/50 dark:text-cream-100/50 hover:underline" onClick={logout}>
            Cerrar sesión
          </button>
        </div>
      </AuthShell>
    )
  }

  if (pendingRequest?.status === 'rejected') {
    return (
      <AuthShell>
        <h1 className="font-display text-xl font-bold tracking-tight mb-1">Solicitud rechazada</h1>
        <p className="text-sm text-ink-900/70 dark:text-cream-100/70 mb-5">
          Tu solicitud para unirte a <strong>{pendingRequest.floorName}</strong> fue rechazada. Puedes intentarlo
          con otro código de invitación.
        </p>
        <JoinForm requestJoinFloor={requestJoinFloor} logout={logout} />
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <h1 className="font-display text-xl font-bold tracking-tight mb-1">Únete a un piso</h1>
      <p className="text-sm text-ink-900/70 dark:text-cream-100/70 mb-5">
        Todavía no perteneces a ningún piso activo. Introduce un código de invitación para solicitar tu ingreso.
      </p>
      <JoinForm requestJoinFloor={requestJoinFloor} logout={logout} />
    </AuthShell>
  )
}

function JoinForm({ requestJoinFloor, logout }) {
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await requestJoinFloor(inviteCode)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <input
        className="input uppercase"
        placeholder="Código de invitación"
        value={inviteCode}
        onChange={(e) => setInviteCode(e.target.value)}
        required
      />
      {error && <p className="text-sm font-medium text-clay-500">{error}</p>}
      <button className="btn-primary text-sm" type="submit" disabled={submitting}>
        {submitting ? 'Enviando…' : 'Solicitar unión'}
      </button>
      <button type="button" className="text-xs font-semibold text-ink-900/50 dark:text-cream-100/50 hover:underline" onClick={logout}>
        Cerrar sesión
      </button>
    </form>
  )
}
