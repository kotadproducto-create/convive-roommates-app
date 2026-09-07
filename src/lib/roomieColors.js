/**
 * Identidad visual de cada roomie: color elegido en Perfil (columna
 * `profiles.color`) + un movimiento propio y estable para su punto en
 * el círculo de Inicio (ver components/RoomieOrb.jsx). Todo puro y
 * sin estado, para poder usarse tanto en Perfil como en el círculo.
 */

// Solo para quien todavía no eligió color — nunca se muestra como
// paleta, son los mismos tonos ya usados en toda la app (ver
// tailwind.config.js) para que el respaldo no desentone.
const FALLBACK_PALETTE = ['#6B4FE0', '#FF6B4A', '#F5B942', '#3FAE6A', '#4C7FFF', '#E8503A']

/** Hash numérico simple y determinista de un string (mismo id → mismo número siempre). */
export function hashSeed(str) {
  let hash = 0
  for (let i = 0; i < String(str).length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

/** Color efectivo de un miembro: el que eligió, o uno de respaldo derivado de su id. */
export function getMemberColor(member) {
  if (member?.color) return member.color
  const seed = hashSeed(member?.id || '')
  return FALLBACK_PALETTE[seed % FALLBACK_PALETTE.length]
}

// PRNG chiquito (mulberry32) para derivar varios números "al azar" a
// partir de una sola semilla entera — así el recorrido de cada punto
// es distinto por persona pero siempre igual entre cargas.
function mulberry32(seed) {
  let a = seed
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Parámetros de movimiento del punto de un miembro dentro del círculo
 * (ver .orb-dot / @keyframes orb-float en index.css): tamaño, posición
 * inicial y 3 desplazamientos de un recorrido en bucle, más duración y
 * delay — todo derivado del id, así que "es de esa persona" sin pedirle
 * que configure nada (queda para más adelante).
 */
export function getOrbMotion(memberId) {
  const rand = mulberry32(hashSeed(memberId))
  const size = 34 + rand() * 26 // 34–60px
  const left = 18 + rand() * 64 // % dentro del círculo, con margen
  const top = 18 + rand() * 64
  const spread = 26 // px máximos de desplazamiento en cada tramo
  const offset = () => (rand() * 2 - 1) * spread
  return {
    size,
    left,
    top,
    dx1: offset(),
    dy1: offset(),
    dx2: offset(),
    dy2: offset(),
    dx3: offset(),
    dy3: offset(),
    duration: 9 + rand() * 7, // 9–16s
    delay: rand() * 4 // 0–4s
  }
}
