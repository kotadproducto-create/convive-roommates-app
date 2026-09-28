import { createPortal } from 'react-dom'
import { format } from 'date-fns'
import { RULE_CATEGORIES } from '../lib/houseRules'
import { CloseIcon } from './icons'

/**
 * Detalle de una norma vigente: descripción completa, quién la propuso,
 * cuándo se aprobó, y su historial de cambios (house_rule_history,
 * filtrado a esta norma). Desde acá se puede proponer modificarla o
 * eliminarla — cualquier compañero puede hacerlo, no solo quien la
 * propuso originalmente. Mismo patrón de pop-up que IncidentDetailDialog.
 */
export default function HouseRuleDetailDialog({ rule, history, onClose, onProposeEdit, onProposeDelete, t, dateLocale }) {
  const category = RULE_CATEGORIES.find((c) => c.key === rule.category)

  return createPortal(
    <div
      className="fixed inset-0 z-40 bg-ink-900/40 backdrop-blur-sm flex items-end sm:items-center sm:justify-center"
      onClick={onClose}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md sm:rounded-2xl bg-cream-100 dark:bg-ink-800 border-t-[2.5px] sm:border-2 border-ink-900 dark:border-cream-100/40 rounded-t-2xl p-5 pb-8 sm:pb-5 relative max-h-[90vh] overflow-y-auto"
      >
        <div className="w-9 h-1.5 rounded-full bg-ink-900/15 dark:bg-cream-100/15 mx-auto mb-4 sm:hidden" />
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center hover:bg-cream-200 dark:hover:bg-ink-700"
        >
          <CloseIcon className="w-4 h-4" />
        </button>

        {category && (
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-200 mb-1">
            {category.icon} {t(category.labelKey)}
          </p>
        )}
        <h3 className="font-display text-lg font-bold pr-8 break-words">{rule.title}</h3>
        <p className="text-sm text-ink-900/70 dark:text-cream-100/70 mt-2 break-words">{rule.description}</p>
        <p className="text-xs text-ink-900/40 dark:text-cream-100/40 mt-3">
          {t('houseRules.approvedLine', {
            name: rule.proposedByName,
            date: format(new Date(rule.createdAt), 'd MMM, HH:mm', { locale: dateLocale })
          })}
        </p>

        {history.length > 0 && (
          <div className="mt-4 pt-4 border-t border-ink-900/10 dark:border-cream-100/15">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-900/50 dark:text-cream-100/50 mb-2">
              {t('houseRules.historyTitle')}
            </h4>
            <ul className="flex flex-col gap-1.5">
              {history.map((h) => (
                <li key={h.id} className="text-xs text-ink-900/60 dark:text-cream-100/60 break-words">
                  {t(`houseRules.historyAction.${h.action}`, {
                    name: h.changedByName,
                    date: format(new Date(h.createdAt), 'd MMM, HH:mm', { locale: dateLocale })
                  })}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap gap-x-3 gap-y-2 mt-4 pt-4 border-t border-ink-900/10 dark:border-cream-100/15">
          <button type="button" className="btn-secondary text-sm" onClick={onProposeEdit}>
            {t('houseRules.proposeEditButton')}
          </button>
          <button type="button" className="text-sm font-semibold text-clay-500 hover:underline" onClick={onProposeDelete}>
            {t('houseRules.proposeDeleteButton')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
