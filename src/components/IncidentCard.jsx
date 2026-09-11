import { format } from 'date-fns'

export default function IncidentCard({ incident, canDelete, onDelete, t, dateLocale }) {
  return (
    <div className="card overflow-hidden flex flex-col">
      {incident.photoUrl && (
        <img src={incident.photoUrl} alt={incident.title} className="w-full h-40 object-cover" />
      )}
      <div className="p-4 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display font-semibold">{incident.title}</h3>
          {canDelete && (
            <button
              onClick={() => onDelete(incident.id)}
              className="text-xs font-semibold text-clay-500 hover:underline shrink-0"
              aria-label={t('incidents.deleteAria')}
            >
              {t('incidents.delete')}
            </button>
          )}
        </div>
        {incident.description && (
          <p className="text-sm text-ink-900/70 dark:text-cream-100/70">{incident.description}</p>
        )}
        <div className="flex items-center justify-between text-xs text-ink-900/40 dark:text-cream-100/40 mt-1">
          <span>{incident.authorName}</span>
          <span>{format(new Date(incident.createdAt), 'd MMM, HH:mm', { locale: dateLocale })}</span>
        </div>
        {incident.expiresAt && (
          <p className="text-[11px] font-semibold text-gold-500">
            {t('incidents.expiresLabel', { date: format(new Date(incident.expiresAt), 'd MMM', { locale: dateLocale }) })}
          </p>
        )}
      </div>
    </div>
  )
}
