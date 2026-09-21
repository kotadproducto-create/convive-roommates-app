import { callRpc } from './db'

/**
 * Llamadas a las funciones de la base del link público de turnos (ver
 * supabase/public_turns.sql).
 */

/** Sin sesión: lo que ve quien abre el link. */
export function fetchPublicTurns(token) {
  return callRpc('get_public_turns', { p_token: token })
}

/** Con sesión: estado del link del piso (cualquier miembro). */
export function getFloorPublicLink(floorId) {
  return callRpc('get_floor_public_link', { p_floor_id: floorId })
}

/** Solo admins: action = 'enable' | 'disable' | 'regenerate'. */
export function setFloorPublicLink(floorId, action) {
  return callRpc('set_floor_public_link', { p_floor_id: floorId, p_action: action })
}
