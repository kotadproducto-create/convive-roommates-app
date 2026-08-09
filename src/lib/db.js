/**
 * db.js — Backend REAL con Supabase.
 *
 * Esta es la versión conectada a Supabase (Postgres + Auth + Storage +
 * Realtime). Sustituye a la versión anterior basada en localStorage
 * (que quedó guardada como referencia en db.localStorage.old.js).
 *
 * Convenciones:
 * - Las tablas usan snake_case en la base de datos (floor_id, photo_url...)
 *   pero el resto de la app sigue usando camelCase (floorId, photoUrl...).
 *   Las funciones de aquí hacen esa traducción para no tener que tocar
 *   componentes ni contexts.
 */
import { supabase } from './supabaseClient'

// --- Traducción snake_case <-> camelCase (superficial, un nivel) ---

function toSnake(obj) {
  const out = {}
  for (const [k, v] of Object.entries(obj)) {
    const snake = k.replace(/[A-Z]/g, (m) => '_' + m.toLowerCase())
    out[snake] = v
  }
  return out
}

function toCamel(obj) {
  if (!obj) return obj
  const out = {}
  for (const [k, v] of Object.entries(obj)) {
    const camel = k.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
    out[camel] = v
  }
  return out
}

function toCamelRows(rows) {
  return (rows || []).map(toCamel)
}

// --- CRUD genérico ---

// Columna de orden por defecto para getAll(); solo hay que listarla aquí
// cuando una tabla no tiene "created_at" (floor_memberships usa joined_at).
const ORDER_COLUMN_BY_TABLE = {
  floor_memberships: 'joined_at'
}

export async function getAll(table, filters = {}) {
  let query = supabase.from(table).select('*')
  for (const [key, value] of Object.entries(toSnake(filters))) {
    query = query.eq(key, value)
  }
  const orderColumn = ORDER_COLUMN_BY_TABLE[table] || 'created_at'
  const { data, error } = await query.order(orderColumn, { ascending: true })
  if (error) throw error
  return toCamelRows(data)
}

export async function getById(table, id) {
  if (!id) return null
  const { data, error } = await supabase.from(table).select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return toCamel(data)
}

export async function create(table, doc) {
  const { data, error } = await supabase.from(table).insert(toSnake(doc)).select().single()
  if (error) throw error
  return toCamel(data)
}

export async function update(table, id, patch) {
  const { data, error } = await supabase.from(table).update(toSnake(patch)).eq('id', id).select().single()
  if (error) throw error
  return toCamel(data)
}

export async function remove(table, id) {
  const { error } = await supabase.from(table).delete().eq('id', id)
  if (error) throw error
}

/**
 * Inserta varias filas ignorando las que choquen con `conflictColumns`
 * (constraint UNIQUE en BD). A diferencia de "leer lo que existe y crear
 * lo que falta" desde el cliente, esto es correcto incluso si dos
 * llamadas concurrentes ejecutan esto al mismo tiempo (la propia BD
 * resuelve el conflicto, no hay ventana de carrera).
 */
export async function upsertIgnoreDuplicates(table, docs, conflictColumns) {
  if (!docs.length) return
  const rows = docs.map(toSnake)
  const onConflict = toSnake(Object.fromEntries(conflictColumns.map((c) => [c, true])))
  const { error } = await supabase.from(table).upsert(rows, { onConflict: Object.keys(onConflict).join(','), ignoreDuplicates: true })
  if (error) throw error
}

/**
 * Se suscribe a cambios en tiempo real de una tabla (filtrados por
 * floor_id si se pasa). Llama a `onChange` con la lista completa y
 * actualizada cada vez que algo cambia (incluida la primera carga).
 * Devuelve una función para des-suscribirse.
 */
export function subscribeTable(table, { floorId } = {}, onChange) {
  let active = true

  async function refetch() {
    const filters = floorId ? { floorId } : {}
    const rows = await getAll(table, filters)
    if (active) onChange(rows)
  }

  refetch()

  const channel = supabase
    .channel(`${table}-changes-${floorId || 'all'}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table,
        ...(floorId ? { filter: `floor_id=eq.${floorId}` } : {})
      },
      () => refetch()
    )
    .subscribe()

  return () => {
    active = false
    supabase.removeChannel(channel)
  }
}

/**
 * Devuelve los miembros ACTIVOS de un piso, uniendo floor_memberships
 * con profiles. Ojo: `id` en el resultado es el id de `profiles`
 * (= auth.uid()), no el id de la membresía, porque rotationOrder y
 * tasks.assignedUserId guardan ids de perfil. `membershipId` es el
 * id de la fila de floor_memberships, para acciones de admin
 * (cerrar membresía, cambiar rol).
 */
export async function getFloorMembers(floorId) {
  if (!floorId) return []
  const { data, error } = await supabase
    .from('floor_memberships')
    .select('id, role, joined_at, profile:profiles(*)')
    .eq('floor_id', floorId)
    .eq('status', 'active')
  if (error) throw error
  return (data || [])
    .filter((row) => row.profile)
    .map((row) => ({
      ...toCamel(row.profile),
      membershipId: row.id,
      role: row.role,
      joinedAt: row.joined_at
    }))
}

/**
 * Se suscribe en tiempo real al roster de miembros activos de un
 * piso (join floor_memberships + profiles vía getFloorMembers, no
 * un simple getAll). Devuelve una función para des-suscribirse.
 */
export function subscribeFloorMembers(floorId, onChange) {
  let active = true

  async function refetch() {
    if (!floorId) {
      if (active) onChange([])
      return
    }
    const rows = await getFloorMembers(floorId)
    if (active) onChange(rows)
  }

  refetch()

  const channel = supabase
    .channel(`floor-members-${floorId || 'none'}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'floor_memberships', ...(floorId ? { filter: `floor_id=eq.${floorId}` } : {}) },
      () => refetch()
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'profiles' },
      () => refetch()
    )
    .subscribe()

  return () => {
    active = false
    supabase.removeChannel(channel)
  }
}

export function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

/** Sube una foto de incidencia al bucket de Storage y devuelve su URL pública. */
export async function uploadIncidentPhoto(file, floorId) {
  const ext = file.name.split('.').pop()
  const path = `${floorId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const { error } = await supabase.storage.from('incident-photos').upload(path, file)
  if (error) throw error
  const { data } = supabase.storage.from('incident-photos').getPublicUrl(path)
  return data.publicUrl
}
