import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export default function IncidentCard({ incident, canDelete, onDelete }) {
  return (
    <div className="card overflow-hidden flex flex-col">
      {incident.photoUrl && (
        <img src={incident.photoUrl} alt={incident.title} className="w-full h-40 object-cover" />
      )}
      <div className="p-4 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-medium">{incident.title}</h3>
          {canDelete && (
            <button
              onClick={() => onDelete(incident.id)}
              className="text-xs text-clay-500 hover:underline shrink-0"
              aria-label="Eliminar incidencia"
            >
              Eliminar
            </button>
          )}
        </div>
        {incident.description && (
          <p className="text-sm text-charcoal-900/70 dark:text-linen-100/70">{incident.description}</p>
        )}
        <div className="flex items-center justify-between text-xs text-charcoal-900/40 dark:text-linen-100/40 mt-1">
          <span>{incident.authorName}</span>
          <span>{format(new Date(incident.createdAt), "d MMM, HH:mm", { locale: es })}</span>
        </div>
        {incident.expiresAt && (
          <p className="text-[11px] text-mustard-500">
            Expira {format(new Date(incident.expiresAt), "d MMM", { locale: es })}
          </p>
        )}
      </div>
    </div>
  )
}
