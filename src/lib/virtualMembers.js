/**
 * Perfiles virtuales: una persona del piso que NO usa la app (sin cuenta de
 * acceso). Es una fila normal de `profiles` con `is_virtual = true` más su
 * membresía, así que aparece en la rotación, las asignaciones, las listas y el
 * Pote como cualquier otra persona. Estas utilidades separan lo que solo hacen
 * las personas REALES (votar, recibir notificaciones, tener puntos) de lo demás.
 */

/** Miembros con cuenta real (los únicos que votan, reciben avisos y suman puntos). */
export function realMembers(members) {
  return members.filter((m) => !m.isVirtual)
}

/** Ids de los perfiles virtuales, para preguntar `virtualIds.has(id)` rápido. */
export function virtualIdSet(members) {
  return new Set(members.filter((m) => m.isVirtual).map((m) => m.id))
}

/** Colores para elegir la identidad de un perfil virtual (los mismos tonos de la app). */
export const VIRTUAL_COLORS = ['#6B4FE0', '#FF6B4A', '#F5B942', '#3FAE6A', '#4C7FFF', '#E8503A']
