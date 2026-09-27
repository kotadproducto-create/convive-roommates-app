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

/**
 * El color de un miembro, con transparencia — para anillos/resplandores
 * sobre botones y chips "esto es tuyo" (ver ActivityCard/TaskCard/
 * Timeline/CalendarView), donde antes se usaba un coral fijo para todo
 * el mundo. Solo acepta el formato que guarda el selector de Perfil
 * (`<input type="color">`, siempre "#rrggbb"); si el color no viene en
 * ese formato (dato viejo o corrupto), cae a negro con esa opacidad en
 * vez de romper el render.
 */
export function hexToRgba(hex, alpha = 1) {
  const match = /^#([0-9a-f]{6})$/i.exec(hex || '')
  if (!match) return `rgba(0, 0, 0, ${alpha})`
  const n = parseInt(match[1], 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
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
 *
 * `index`/`total` (posición del miembro dentro de `members` y cuántos
 * hay) reparten a cada persona un sector propio del círculo (360°/total)
 * para su recorrido: con pocos miembros, un desplazamiento (dx,dy) por
 * eje totalmente independiente a veces hace que la mayoría "caiga" del
 * mismo lado por puro azar — se nota más cuanta menos gente hay en el
 * piso. Repartiendo sectores que no se superponen, cada punto sigue
 * moviéndose con ángulo y radio aleatorios (dentro de su sector), pero
 * nunca coincide en dirección general con otro — más variado a la vista
 * sin dejar de ser aleatorio.
 */
export function getOrbMotion(memberId, index = 0, total = 1) {
  const rand = mulberry32(hashSeed(memberId))
  const size = 34 + rand() * 26 // 34–60px
  const left = 18 + rand() * 64 // % dentro del círculo, con margen
  const top = 18 + rand() * 64
  const maxRadius = 26 // px máximos de desplazamiento en cada tramo

  // Sector propio de esta persona, centrado en `index * sector`: cada
  // ángulo se sortea dentro de un 90% de ese sector (el 10% restante es
  // colchón contra el sector vecino), así dos personas nunca comparten
  // dirección general aunque cada tramo de su recorrido sí sea al azar.
  const sector = (2 * Math.PI) / Math.max(1, total)
  const center = index * sector
  const waypoint = () => {
    const angle = center + (rand() * 2 - 1) * sector * 0.45
    const radius = maxRadius * (0.5 + rand() * 0.5) // 50%–100% del alcance
    return { dx: Math.cos(angle) * radius, dy: Math.sin(angle) * radius }
  }
  const p1 = waypoint()
  const p2 = waypoint()
  const p3 = waypoint()

  return {
    size,
    left,
    top,
    dx1: p1.dx,
    dy1: p1.dy,
    dx2: p2.dx,
    dy2: p2.dy,
    dx3: p3.dx,
    dy3: p3.dy,
    duration: 9 + rand() * 7, // 9–16s
    delay: rand() * 4 // 0–4s
  }
}
