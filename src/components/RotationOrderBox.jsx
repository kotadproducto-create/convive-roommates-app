import { VirtualTag } from './VirtualMembers'
import MarqueeText from './MarqueeText'
import { useData } from '../context/DataContext'
import { useLanguage } from '../context/LanguageContext'
import { floorKeeperFor, getWeekKeyOf } from '../lib/activities'

/**
 * "Orden de rotación": la lista numerada de quiénes se turnan en el piso.
 * Vive en Actividades, justo debajo de "Todo lo que hay que hacer en el
 * piso, y quién lo hace" (se cambia desde Tu piso → Orden de rotación).
 * Destaca a quién le toca esta semana y, más discreto, a quién le toca
 * después — misma lógica y mismos textos que el link público de turnos y
 * la caja de Inicio (floorKeeperFor + publicTurns.keeperNowTag/keeperNextTag),
 * para no duplicar el criterio en tres lugares.
 */
export default function RotationOrderBox() {
  const { floor, members, weekKey, awayUserIds } = useData()
  const { t } = useLanguage()
  const memberById = Object.fromEntries(members.map((m) => [m.id, m]))

  const order = (floor?.rotationOrder || []).filter((id) => !awayUserIds.has(id))
  const keeperNowId = floorKeeperFor(floor, order, weekKey)
  const nextWeekDate = new Date()
  nextWeekDate.setDate(nextWeekDate.getDate() + 7)
  const keeperNextId = floorKeeperFor(floor, order, getWeekKeyOf(nextWeekDate))

  return (
    <div className="card p-4 mb-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-900/50 dark:text-cream-100/50 mb-2">{t('calendar.rotationOrder')}</p>
      <ol className="flex flex-col gap-2">
        {(floor?.rotationOrder || []).map((id, idx) => {
          const m = memberById[id]
          if (!m) return null
          const isKeeperNow = id === keeperNowId
          const isKeeperNext = !isKeeperNow && id === keeperNextId
          return (
            <li
              key={id}
              className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-sm rounded-lg px-2 py-1.5 ${
                isKeeperNow
                  ? 'bg-violet-50 dark:bg-violet-700/25 border-2 border-violet-500/40'
                  : isKeeperNext
                    ? 'bg-violet-50/60 dark:bg-violet-700/10'
                    : ''
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 ${
                  isKeeperNow ? 'bg-violet-500 text-white' : 'bg-violet-100 dark:bg-violet-700/25 text-violet-600 dark:text-violet-200'
                }`}
              >
                {idx + 1}
              </span>
              <MarqueeText className={`min-w-0 ${isKeeperNow ? 'font-bold' : ''}`}>{m.name}</MarqueeText>
              {isKeeperNow && (
                <span className="text-[10px] uppercase font-bold text-violet-600 dark:text-violet-200 bg-violet-100 dark:bg-violet-700/30 px-1.5 py-0.5 rounded-md shrink-0">
                  {t('publicTurns.keeperNowTag')}
                </span>
              )}
              {isKeeperNext && (
                <span className="text-[10px] uppercase font-semibold text-violet-500/70 dark:text-violet-300/70 shrink-0">
                  {t('publicTurns.keeperNextTag')}
                </span>
              )}
              {m.isVirtual && <VirtualTag className="shrink-0" />}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
