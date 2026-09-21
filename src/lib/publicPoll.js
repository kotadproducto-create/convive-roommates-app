/**
 * Votar una consulta sin iniciar sesión (link de WhatsApp + PIN personal).
 * Aquí vive lo puro (formato del PIN, link, mensajes de error, móvil recordado);
 * las llamadas a la base están en publicPollApi.js. Ver supabase/public_polls.sql.
 */

const DEVICE_TOKEN_KEY = 'convive.pollDeviceToken'

export const PIN_LENGTH = 6

/** El PIN son exactamente 6 dígitos. */
export function isValidPin(pin) {
  return typeof pin === 'string' && /^\d{6}$/.test(pin)
}

/** Deja solo dígitos (máx. 6): para el campo de PIN, que no acepta letras. */
export function cleanPinInput(value) {
  return String(value ?? '')
    .replace(/\D/g, '')
    .slice(0, PIN_LENGTH)
}

/** Link público de una consulta: lo que se comparte por WhatsApp. */
export function publicPollLink(pollId, origin) {
  return `${origin.replace(/\/$/, '')}/votar/${pollId}`
}

/** Solo las consultas normales, todavía abiertas, se pueden compartir por link. */
export function canSharePoll(poll) {
  return Boolean(poll) && poll.kind === 'custom' && poll.status === 'pending'
}

const ERROR_KEYS = {
  wrong_pin: 'publicPoll.errWrongPin',
  locked: 'publicPoll.errLocked',
  no_pin: 'publicPoll.errNoPin',
  poll_closed: 'publicPoll.errClosed',
  not_member: 'publicPoll.errNotMember',
  device_not_recognized: 'publicPoll.errDevice',
  poll_not_found: 'publicPoll.errNotFound'
}

/** Clave i18n del mensaje para un código de error de las funciones de voto. */
export function voteErrorKey(code) {
  return ERROR_KEYS[code] || 'publicPoll.errGeneric'
}

const PIN_CHANGE_ERROR_KEYS = {
  wrong_password: 'ajustes.pin.errWrongPassword',
  locked: 'ajustes.pin.errLocked',
  invalid_format: 'ajustes.pin.errFormat'
}

/** Clave i18n del mensaje para un código de error al cambiar el PIN. */
export function pinChangeErrorKey(code) {
  return PIN_CHANGE_ERROR_KEYS[code] || 'ajustes.pin.errGeneric'
}

// El token del móvil recordado vive en localStorage; en navegación privada o con
// el almacenamiento bloqueado puede fallar: entonces simplemente no se recuerda.
export function getDeviceToken() {
  try {
    return localStorage.getItem(DEVICE_TOKEN_KEY)
  } catch {
    return null
  }
}

export function saveDeviceToken(token) {
  try {
    localStorage.setItem(DEVICE_TOKEN_KEY, token)
  } catch {
    // sin almacenamiento: no se puede recordar este móvil
  }
}

export function clearDeviceToken() {
  try {
    localStorage.removeItem(DEVICE_TOKEN_KEY)
  } catch {
    // nada que borrar
  }
}
