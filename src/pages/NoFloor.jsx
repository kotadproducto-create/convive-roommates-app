import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
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
  const { t } = useLanguage()

  if (pendingRequest?.status === 'pending') {
    return (
      <AuthShell>
        <h1 className="font-display text-xl font-bold tracking-tight mb-1">{t('noFloor.requestSentTitle')}</h1>
        <p className="text-sm text-ink-900/70 dark:text-cream-100/70 mb-5">
          {t('noFloor.requestSentBody', { floor: pendingRequest.floorName })}
        </p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            className="btn-secondary text-sm"
            onClick={() => withdrawRequest(pendingRequest.id)}
          >
            {t('noFloor.cancelRequest')}
          </button>
          <button type="button" className="text-xs font-semibold text-ink-900/50 dark:text-cream-100/50 hover:underline" onClick={logout}>
            {t('noFloor.logout')}
          </button>
        </div>
      </AuthShell>
    )
  }

  if (pendingRequest?.status === 'rejected') {
    return (
      <AuthShell>
        <h1 className="font-display text-xl font-bold tracking-tight mb-1">{t('noFloor.requestRejectedTitle')}</h1>
        <p className="text-sm text-ink-900/70 dark:text-cream-100/70 mb-5">
          {t('noFloor.requestRejectedBody', { floor: pendingRequest.floorName })}
        </p>
        <JoinForm requestJoinFloor={requestJoinFloor} logout={logout} t={t} />
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <h1 className="font-display text-xl font-bold tracking-tight mb-1">{t('noFloor.joinFloorTitle')}</h1>
      <p className="text-sm text-ink-900/70 dark:text-cream-100/70 mb-5">{t('noFloor.joinFloorBody')}</p>
      <JoinForm requestJoinFloor={requestJoinFloor} logout={logout} t={t} />
    </AuthShell>
  )
}

function JoinForm({ requestJoinFloor, logout, t }) {
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
        placeholder={t('auth.register.inviteCodePlaceholder')}
        value={inviteCode}
        onChange={(e) => setInviteCode(e.target.value)}
        required
      />
      {error && <p className="text-sm font-medium text-clay-500">{error}</p>}
      <button className="btn-primary text-sm" type="submit" disabled={submitting}>
        {submitting ? t('noFloor.sending') : t('auth.register.submitJoin')}
      </button>
      <button type="button" className="text-xs font-semibold text-ink-900/50 dark:text-cream-100/50 hover:underline" onClick={logout}>
        {t('noFloor.logout')}
      </button>
    </form>
  )
}
