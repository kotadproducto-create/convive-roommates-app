import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { isIncidentActive } from '../lib/incidents'
import { formatCountdown } from '../lib/polls'
import { ChatIcon } from './icons'

/** Cuenta atrás hasta `expiresAt` (mismo patrón que PollCountdown en
 * Votaciones.jsx — formatCountdown es genérico, no es solo de consultas). */
function IncidentCountdown({ expiresAt, t }) {
  const targetMs = new Date(expiresAt).getTime()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const parts = formatCountdown(targetMs - now)
  if (!parts) return null
  const label = t(`incidents.countdown${parts.unit[0].toUpperCase()}${parts.unit.slice(1)}`, parts)
  const urgent = parts.unit === 'minutes' || parts.unit === 'seconds'
  return <p className={`text-[11px] font-semibold ${urgent ? 'text-clay-500' : 'text-gold-500'}`}>{label}</p>
}

export default function IncidentCard({ incident, canDelete, onDelete, onOpen, commentCount = 0, t, dateLocale }) {
  const active = isIncidentActive(incident)

  return (
    <div
      className="card overflow-hidden flex flex-col text-left cursor-pointer hover:border-violet-500/50"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
    >
      {incident.photoUrl && (
        <img src={incident.photoUrl} alt={incident.title} className="w-full h-40 object-cover" />
      )}
      <div className="p-4 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display font-semibold min-w-0 break-words">{incident.title}</h3>
          {canDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDelete(incident.id)
              }}
              className="text-xs font-semibold text-clay-500 hover:underline shrink-0"
              aria-label={t('incidents.deleteAria')}
            >
              {t('incidents.delete')}
            </button>
          )}
        </div>
        {incident.description && (
          <p className="text-sm text-ink-900/70 dark:text-cream-100/70 line-clamp-2">{incident.description}</p>
        )}
        <div className="flex items-center justify-between text-xs text-ink-900/40 dark:text-cream-100/40 mt-1">
          <span>{incident.authorName}</span>
          <span>{format(new Date(incident.createdAt), 'd MMM, HH:mm', { locale: dateLocale })}</span>
        </div>

        {incident.resolvedAt ? (
          <p className="text-[11px] font-semibold text-sage-500">
            {t('incidents.resolvedAtLabel', { date: format(new Date(incident.resolvedAt), 'd MMM, HH:mm', { locale: dateLocale }) })}
          </p>
        ) : incident.expiresAt && active ? (
          <IncidentCountdown expiresAt={incident.expiresAt} t={t} />
        ) : incident.expiresAt && !active ? (
          <p className="text-[11px] font-semibold text-ink-900/40 dark:text-cream-100/40">
            {t('incidents.expiredAtLabel', { date: format(new Date(incident.expiresAt), 'd MMM, HH:mm', { locale: dateLocale }) })}
          </p>
        ) : null}

        <p className="flex items-center gap-1 text-[11px] text-ink-900/40 dark:text-cream-100/40">
          <ChatIcon className="w-3 h-3 shrink-0" />
          {t('incidents.commentsCount', { count: commentCount, plural: commentCount === 1 ? '' : 's' })}
        </p>
      </div>
    </div>
  )
}
