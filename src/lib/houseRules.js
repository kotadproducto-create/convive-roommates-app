/**
 * Normas del piso: categorías fijas (el texto de cada norma lo decide el
 * piso vía Votaciones — ver DataContext.jsx `proposeHouseRule` y el `kind:
 * 'house_rule'` en la rama de resolución de consultas) y el cálculo puro
 * de si alguien tiene pendiente aceptar la versión vigente.
 */

/** Categorías fijas — `key` es lo que se guarda en `house_rules.category`,
 * `labelKey`/`icon` son solo para la UI (ver Normas.jsx). Agregar una
 * categoría nueva requiere también sumarla al check de la tabla en
 * supabase/schema.sql. */
export const RULE_CATEGORIES = [
  { key: 'limpieza', icon: '🧹', labelKey: 'houseRules.category.limpieza' },
  { key: 'espacios_comunes', icon: '🛁', labelKey: 'houseRules.category.espacios_comunes' },
  { key: 'compras', icon: '🛒', labelKey: 'houseRules.category.compras' },
  { key: 'pote', icon: '💰', labelKey: 'houseRules.category.pote' },
  { key: 'basura', icon: '🗑️', labelKey: 'houseRules.category.basura' },
  { key: 'convivencia', icon: '🤝', labelKey: 'houseRules.category.convivencia' },
  { key: 'estado_piso', icon: '🏠', labelKey: 'houseRules.category.estado_piso' },
  { key: 'ausencias', icon: '📅', labelKey: 'houseRules.category.ausencias' }
]

export const RULE_CATEGORY_KEYS = RULE_CATEGORIES.map((c) => c.key)

/** Última versión de las normas que esta persona aceptó (o null si nunca
 * aceptó ninguna) — de entre sus filas de `house_rule_acceptances`. */
export function latestAcceptedVersion(acceptances, userId) {
  const mine = acceptances.filter((a) => a.userId === userId)
  if (!mine.length) return null
  return Math.max(...mine.map((a) => a.rulesVersion))
}

/**
 * true si a esta persona le falta aceptar la versión vigente de las
 * normas. Si el piso todavía no aprobó ninguna norma (`rulesVersion` 0 o
 * sin definir) no hay nada que aceptar, así que nunca bloquea.
 */
export function needsToAcceptRules(acceptances, userId, rulesVersion) {
  if (!rulesVersion) return false
  return latestAcceptedVersion(acceptances, userId) !== rulesVersion
}

/**
 * true si esta persona nunca aceptó ninguna versión de las normas de este
 * piso — distingue a alguien que se acaba de unir (debe aceptarlas antes
 * de poder usar el resto de la app) de alguien que ya las conocía y ahora
 * solo tiene un aviso no bloqueante porque cambiaron (ver Normas.jsx).
 */
export function isNewToRules(acceptances, userId) {
  return latestAcceptedVersion(acceptances, userId) === null
}
