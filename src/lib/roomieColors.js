/**
 * Identidad visual de cada roomie: color elegido en Perfil (columna
 * `profiles.color`) + un paseo propio y estable para su punto en el
 * círculo de Inicio (ver components/RoomieOrb.jsx). Sin estado propio del
 * módulo (nada de globals ni mutación oculta) — el único estado es el que
 * cada quien va guardando en su propio objeto "walker" y le pasa de vuelta
 * a `stepOrbWalker` en cada cuadro.
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
 * Paseo continuo del punto de un miembro dentro del círculo de Inicio
 * (ver components/RoomieOrb.jsx): en vez de un recorrido de 3 puntos fijos
 * en bucle (se sentía a saltos, siempre el mismo camino), cada punto
 * deambula libre con `stepOrbWalker` — gira un poco al azar en cada
 * cuadro, nunca de golpe, y solo cuando ya se alejó bastante de su "casa"
 * se le suma un empujoncito suave de vuelta, para que no termine
 * perdiéndose siempre del mismo lado. Todo derivado del id (misma
 * persona → mismo "carácter" de paseo) vía un generador propio que se
 * seguirá llamando cuadro a cuadro mientras dure la animación, así el
 * camino real nunca se repite en bucle como antes.
 *
 * `index`/`total` (posición del miembro dentro de `members` y cuántos
 * hay) reparten a cada persona un sector propio del círculo (360°/total)
 * para su "casa": con pocos miembros, una posición inicial totalmente
 * independiente por persona a veces hacía que la mayoría cayera del mismo
 * lado (ej. la esquina inferior derecha) por puro azar. Repartiendo
 * sectores que no se superponen, y variando además la distancia al
 * centro, entre todos cubren el círculo entero — pero el radio de paseo
 * (`wanderRadius`) es chico frente al tamaño del círculo, así que un
 * punto sí puede acercarse al de un vecino de vez en cuando sin quedar
 * encerrado en su propio gajo para siempre.
 */
export function createOrbWalker(memberId, index = 0, total = 1) {
  const rand = mulberry32(hashSeed(memberId))
  const size = 34 + rand() * 26 // 34–60px
  const sector = (2 * Math.PI) / Math.max(1, total)
  const homeAngle = index * sector + (rand() * 2 - 1) * sector * 0.4
  const homeRadiusPct = 12 + rand() * 26 // 12%–38% del centro hacia el borde
  const left = 50 + Math.cos(homeAngle) * homeRadiusPct
  const top = 50 + Math.sin(homeAngle) * homeRadiusPct
  return {
    rand,
    size,
    left,
    top,
    speed: 5 + rand() * 4, // px/s — lento
    turnRate: 0.6 + rand() * 0.6, // rad/s máximo de giro al azar
    wanderRadius: 22 + rand() * 14, // px máximos de distancia a "casa"
    angle: rand() * Math.PI * 2,
    x: 0,
    y: 0
  }
}

/** Ángulo intermedio entre `a` y `b`, siempre por el camino corto (nunca
 * da la vuelta larga) — `t` en [0,1] es cuánto se acerca a `b`. */
function lerpAngle(a, b, t) {
  const clamped = Math.min(1, Math.max(0, t))
  const diff = (((b - a) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI
  return a + diff * clamped
}

/**
 * Un paso del paseo continuo (llamar en cada cuadro de animación, con
 * `dtSeconds` = tiempo real transcurrido desde el paso anterior): gira un
 * poquito al azar — acotado por `turnRate`, así el cambio de dirección
 * siempre es progresivo, nunca un salto — y avanza a velocidad constante
 * y lenta (`speed`). Si ya se alejó de "casa" (x=0,y=0) más de un 60% de
 * `wanderRadius`, mezcla progresivamente el rumbo hacia "casa" (más fuerte
 * cuanto más lejos), para que el paseo al azar no lo aleje para siempre —
 * nunca es un tirón: es la misma interpolación de ángulo que el giro
 * al azar, así ambos efectos conviven sin producir un cambio brusco.
 */
export function stepOrbWalker(walker, dtSeconds) {
  const { x, y, angle, rand, speed, turnRate, wanderRadius } = walker
  let nextAngle = angle + (rand() * 2 - 1) * turnRate * dtSeconds

  const distFromHome = Math.hypot(x, y)
  const pullThreshold = wanderRadius * 0.6
  if (distFromHome > pullThreshold) {
    const angleToHome = Math.atan2(-y, -x)
    const pull = Math.min(1, (distFromHome - pullThreshold) / (wanderRadius - pullThreshold))
    nextAngle = lerpAngle(nextAngle, angleToHome, pull)
  }

  return {
    ...walker,
    angle: nextAngle,
    x: x + Math.cos(nextAngle) * speed * dtSeconds,
    y: y + Math.sin(nextAngle) * speed * dtSeconds
  }
}
