import ExpandableSection from './ExpandableSection'
import { RULE_CATEGORIES } from '../lib/houseRules'

/**
 * Agrupa las normas vigentes por categoría y las dibuja en una
 * ExpandableSection por categoría (colapsada por defecto, mismo patrón
 * que Pote/Recompensas/Incidencias) — la usan tanto Normas.jsx (normas
 * tocables, abre el detalle) como HouseRulesGate.jsx (de solo lectura,
 * para leerlas antes de aceptar). Categorías sin ninguna norma vigente no
 * se muestran.
 */
export default function HouseRuleCategoryList({ rules, t, onSelectRule, emptyLabel }) {
  const byCategory = RULE_CATEGORIES.map((cat) => ({
    ...cat,
    rules: rules.filter((r) => r.category === cat.key)
  })).filter((cat) => cat.rules.length > 0)

  if (byCategory.length === 0) {
    return <p className="text-sm text-center py-8 text-ink-900/50 dark:text-cream-100/50">{emptyLabel}</p>
  }

  return (
    <div className="flex flex-col gap-3">
      {byCategory.map((cat) => (
        <ExpandableSection
          key={cat.key}
          title={`${cat.icon} ${t(cat.labelKey)}`}
          description={t('houseRules.categoryCount', { count: cat.rules.length, plural: cat.rules.length === 1 ? '' : 's' })}
        >
          <ul className="flex flex-col gap-2">
            {cat.rules.map((r) =>
              onSelectRule ? (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => onSelectRule(r)}
                    className="w-full text-left px-3 py-2.5 rounded-xl bg-cream-100 dark:bg-ink-700 hover:bg-cream-200 dark:hover:bg-ink-700/70"
                  >
                    <p className="text-sm font-semibold break-words">{r.title}</p>
                    <p className="text-xs text-ink-900/60 dark:text-cream-100/60 line-clamp-2">{r.description}</p>
                  </button>
                </li>
              ) : (
                <li key={r.id} className="px-3 py-2.5 rounded-xl bg-cream-100 dark:bg-ink-700">
                  <p className="text-sm font-semibold break-words">{r.title}</p>
                  <p className="text-xs text-ink-900/60 dark:text-cream-100/60 break-words">{r.description}</p>
                </li>
              )
            )}
          </ul>
        </ExpandableSection>
      ))}
    </div>
  )
}
