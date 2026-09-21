/**
 * Link de invitación al piso: /unirse/<código> lleva a quien lo abre directo al
 * registro de ese piso (con el código ya puesto). No da acceso por sí solo: la
 * persona queda como solicitud pendiente y un miembro del piso debe aprobarla,
 * igual que al escribir el código a mano.
 */

const PENDING_KEY = 'convive.pendingInvite'
const PENDING_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

/** Deja el código en mayúsculas y sin símbolos ni espacios (los códigos son de 6 letras/números). */
export function normalizeInviteCode(value) {
  return String(value ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 12)
}

/** Link que se comparte: lleva al registro del piso con el código puesto. */
export function inviteLink(origin, code) {
  return `${String(origin).replace(/\/$/, '')}/unirse/${normalizeInviteCode(code)}`
}

// Si la persona ya tiene cuenta, entra por "Inicia sesión" y el código se pierde
// por el camino: se guarda unos días para dejarlo puesto en la pantalla de unirse
// a un piso. Sin almacenamiento (navegación privada) simplemente no se recuerda.
export function savePendingInvite(code, now = Date.now()) {
  const clean = normalizeInviteCode(code)
  if (!clean) return
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify({ code: clean, at: now }))
  } catch {
    // sin almacenamiento: no se recuerda
  }
}

export function getPendingInvite(now = Date.now()) {
  try {
    const raw = localStorage.getItem(PENDING_KEY)
    if (!raw) return ''
    const { code, at } = JSON.parse(raw)
    if (!code || typeof at !== 'number' || now - at > PENDING_MAX_AGE_MS) return ''
    return normalizeInviteCode(code)
  } catch {
    return ''
  }
}

export function clearPendingInvite() {
  try {
    localStorage.removeItem(PENDING_KEY)
  } catch {
    // nada que borrar
  }
}
