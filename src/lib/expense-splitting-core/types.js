/**
 * Definiciones de tipos (JSDoc, sin código en runtime) del motor de
 * reparto de gastos. Un `Participant` no tiene un tipo propio: en todo
 * el módulo un participante es directamente su `id` (string) — el mismo
 * `profile.id` que ya usa el resto de la app, sin capa de indirección.
 *
 * Todos los montos son enteros en céntimos (ver money.js) — nunca euros
 * en coma flotante — para que las sumas sean siempre exactas.
 */

/**
 * @typedef {Object} Expense
 * @property {string} id
 * @property {number} amountCents - entero positivo, céntimos totales del gasto
 * @property {string} paidBy - participantId de quien pagó
 * @property {string[]} participantIds - a quiénes afecta el gasto (sin duplicados)
 * @property {'EQUAL'|'EXACT'|'PERCENTAGE'|'SHARES'} splitType
 * @property {Object<string, number>} [splitInputs] - requerido salvo en EQUAL;
 *   EXACT: participantId → céntimos exactos: PERCENTAGE: participantId → % (0-100);
 *   SHARES: participantId → nº de partes (> 0)
 * @property {string} [description]
 */

/**
 * @typedef {Object} ExpenseSplit
 * @property {string} expenseId
 * @property {string} participantId
 * @property {number} amountCents
 */

/**
 * @typedef {Object} SplitResult
 * @property {Expense} expense
 * @property {ExpenseSplit[]} splits
 */

/**
 * @typedef {Object} Balance
 * @property {string} participantId
 * @property {number} paidCents
 * @property {number} owedCents
 * @property {number} netCents - paidCents - owedCents; > 0 le deben, < 0 debe, 0 en paz
 */

/**
 * @typedef {Object} Settlement
 * @property {string} payer
 * @property {string} receiver
 * @property {number} amountCents
 */

export {}
