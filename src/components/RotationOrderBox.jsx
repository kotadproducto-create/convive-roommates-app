import { useData } from '../context/DataContext'
import { useLanguage } from '../context/LanguageContext'

/**
 * "Orden de rotación": la lista numerada de quiénes se turnan en el piso.
 * Vive en Actividades, justo debajo de "Todo lo que hay que hacer en el
 * piso, y quién lo hace" (se cambia desde Tu piso → Orden de rotación).
 */
export default function RotationOrderBox() {
  const { floor, members } = useData()
  const { t } = useLanguage()
  const memberById = Object.fromEntries(members.map((m) => [m.id, m]))

  return (
    <div className="card p-4 mb-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-900/50 dark:text-cream-100/50 mb-2">{t('calendar.rotationOrder')}</p>
      <ol className="flex flex-col gap-2">
        {(floor?.rotationOrder || []).map((id, idx) => {
          const m = memberById[id]
          if (!m) return null
          return (
            <li key={id} className="flex items-center gap-2 text-sm">
              <span className="w-5 h-5 rounded-full bg-violet-100 dark:bg-violet-700/25 text-violet-600 dark:text-violet-200 text-[10px] font-bold flex items-center justify-center shrink-0">
                {idx + 1}
              </span>
              <span className="min-w-0 truncate">{m.name}</span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
