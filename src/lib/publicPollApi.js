import { callRpc } from './db'
import { getDeviceToken, saveDeviceToken, clearDeviceToken } from './publicPoll'

/**
 * Llamadas a las funciones de la base para votar sin sesión (ver
 * supabase/public_polls.sql). Las de voto devuelven { ok, error? } en vez de
 * lanzar: el error es un código que publicPoll.voteErrorKey traduce a texto.
 */

export function fetchPublicPoll(pollId) {
  return callRpc('get_public_poll', { p_poll_id: pollId, p_device_token: getDeviceToken() })
}

/** Primer voto desde este móvil: nombre + PIN. Si se pide, queda recordado. */
export async function voteWithPin({ pollId, userId, pin, optionIndex, remember }) {
  const result = await callRpc('vote_with_pin', {
    p_poll_id: pollId,
    p_user_id: userId,
    p_pin: pin,
    p_option_index: optionIndex,
    p_remember: remember
  })
  if (result?.ok && result.device_token) saveDeviceToken(result.device_token)
  return result
}

/** Votos siguientes desde un móvil recordado (sin PIN). */
export async function voteWithDevice({ pollId, optionIndex }) {
  const result = await callRpc('vote_with_device', {
    p_poll_id: pollId,
    p_device_token: getDeviceToken(),
    p_option_index: optionIndex
  })
  // El servidor ya no reconoce este móvil (PIN cambiado o reseteado): se olvida el token.
  if (result?.error === 'device_not_recognized') clearDeviceToken()
  return result
}

/** "No soy yo": olvida este móvil (en el servidor y aquí). */
export async function forgetThisDevice() {
  const token = getDeviceToken()
  clearDeviceToken()
  if (token) await callRpc('forget_device', { p_device_token: token })
}

// --- Con sesión (Configuración y Tu piso) ---

export function hasPollPin() {
  return callRpc('has_poll_pin')
}

/** Crea el PIN (solo la primera vez). */
export function setPollPin(pin) {
  return callRpc('set_poll_pin', { p_pin: pin })
}

/** Cambia un PIN que ya existe: exige la contraseña de acceso a Convive (se comprueba en el servidor). */
export function changePollPin(password, pin) {
  return callRpc('change_poll_pin', { p_password: password, p_pin: pin })
}

export function resetMemberPin(userId) {
  return callRpc('reset_member_pin', { p_user_id: userId })
}
