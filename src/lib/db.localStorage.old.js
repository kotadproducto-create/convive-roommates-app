/**
 * db.js — Backend simulado.
 *
 * Esta capa imita, a propósito, la forma en que se usaría Firestore:
 * colecciones de documentos + una función `subscribe` que avisa a la UI
 * cuando cambian los datos. Internamente usa `localStorage`, así que
 * TODO lo que hagas aquí sobrevive a recargar la página, pero vive
 * solo en este navegador (no se sincroniza entre dispositivos).
 *
 * -----------------------------------------------------------------
 * CÓMO MIGRAR A FIREBASE REAL (resumen, detalle en el README):
 * 1. Instala `firebase` y crea `src/lib/firebase.js` con tu config
 *    (usa las variables de VITE_FIREBASE_* del .env).
 * 2. Sustituye las funciones de este archivo por llamadas a
 *    `getFirestore`, `collection`, `onSnapshot`, `addDoc`, etc.
 * 3. Como el resto de la app solo importa funciones de "db.js"
 *    (getAll, create, update, remove, subscribe...), NO tienes que
 *    tocar ni un componente más: cambia solo este archivo.
 * -----------------------------------------------------------------
 */

const NAMESPACE = 'convive_v1'
const listeners = {} // { collectionName: Set<fn> }

function readAll() {
  const raw = localStorage.getItem(NAMESPACE)
  if (!raw) return {}
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

function writeAll(data) {
  localStorage.setItem(NAMESPACE, JSON.stringify(data))
}

function notify(collectionName) {
  const set = listeners[collectionName]
  if (!set) return
  const rows = getAll(collectionName)
  set.forEach((fn) => fn(rows))
}

export function uid(prefix = '') {
  return (
    prefix +
    Math.random().toString(36).slice(2, 10) +
    Date.now().toString(36).slice(-4)
  )
}

export function getAll(collectionName) {
  const all = readAll()
  return all[collectionName] || []
}

export function getById(collectionName, id) {
  return getAll(collectionName).find((r) => r.id === id) || null
}

export function create(collectionName, doc) {
  const all = readAll()
  const rows = all[collectionName] || []
  const newDoc = { id: uid(collectionName[0] + '_'), createdAt: new Date().toISOString(), ...doc }
  rows.push(newDoc)
  all[collectionName] = rows
  writeAll(all)
  notify(collectionName)
  return newDoc
}

export function update(collectionName, id, patch) {
  const all = readAll()
  const rows = all[collectionName] || []
  const idx = rows.findIndex((r) => r.id === id)
  if (idx === -1) return null
  rows[idx] = { ...rows[idx], ...patch }
  all[collectionName] = rows
  writeAll(all)
  notify(collectionName)
  return rows[idx]
}

export function remove(collectionName, id) {
  const all = readAll()
  const rows = all[collectionName] || []
  all[collectionName] = rows.filter((r) => r.id !== id)
  writeAll(all)
  notify(collectionName)
}

export function replaceCollection(collectionName, rows) {
  const all = readAll()
  all[collectionName] = rows
  writeAll(all)
  notify(collectionName)
}

/** Suscribirse a cambios de una colección. Devuelve función de limpieza. */
export function subscribe(collectionName, fn) {
  if (!listeners[collectionName]) listeners[collectionName] = new Set()
  listeners[collectionName].add(fn)
  fn(getAll(collectionName))
  return () => listeners[collectionName].delete(fn)
}

/** Genera un código de invitación de 6 caracteres, fácil de dictar en voz alta. */
export function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // sin caracteres ambiguos (0/O, 1/I)
  let code = ''
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

export function resetDemoData() {
  localStorage.removeItem(NAMESPACE)
  Object.keys(listeners).forEach((k) => notify(k))
}
