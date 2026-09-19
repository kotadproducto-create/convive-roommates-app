/**
 * ¿Hay que comprar este producto? Lo recurrente, cuando le queda poco o
 * se agotó (stock_level distinto de 'ok'); una compra puntual siempre
 * cuenta como pendiente mientras siga en la lista — recordPurchaseSession
 * la borra en cuanto se compra, así que si está ahí es que falta.
 */
export function isPendingToBuy(item) {
  return !item.recurring || item.stockLevel !== 'ok'
}
