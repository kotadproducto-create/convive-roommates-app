/**
 * expense-splitting-core: motor de dominio para repartir gastos y
 * simplificar deudas entre participantes — independiente de la app
 * (sin React, sin Supabase, sin conocer grupos/usuarios). La aplicación
 * le da participantIds y expenses; este módulo solo calcula.
 *
 * Ver types.js para las formas de datos (Expense/ExpenseSplit/Balance/
 * Settlement) y el resto de archivos del módulo para el porqué de cada
 * decisión (money.js: reparto sin errores de redondeo; debtSimplifier.js:
 * algoritmo y sus límites).
 */
import { calculateSplit } from './expenseSplitter.js'
import { calculateBalances } from './balanceCalculator.js'
import { simplifyDebts } from './debtSimplifier.js'
import { toCents, fromCents } from './money.js'
import { SplitValidationError } from './errors.js'

export const ExpenseSplitter = {
  calculate: calculateSplit,
  calculateBalances,
  simplify: simplifyDebts
}

export { toCents, fromCents, SplitValidationError }
