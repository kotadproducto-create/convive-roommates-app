// Elimina (banea) la cuenta del usuario que llama a esta función.
//
// Por qué banear en vez de borrar de verdad: profiles.id referencia a
// auth.users(id) on delete cascade, y el propio schema.sql documenta la
// decisión de NUNCA borrar una fila de "profiles" (arrastraría en
// cascada tareas, aportes al pote y canjes compartidos que otros
// miembros del piso todavía necesitan en su historial). El cliente ya
// se encarga de dejar el piso y anonimizar los campos personales de su
// propio perfil (usando el update propio que ya permite RLS) ANTES de
// llamar a esta función — acá solo se hace la parte que sí requiere
// permisos de administrador: bloquear el login para siempre.
//
// Nunca confía en un id mandado por el cliente: siempre saca el userId
// real verificando el JWT que llega en el header Authorization (el
// propio supabase.functions.invoke() ya lo manda solo con la sesión
// activa).
//
// Despliegue: `supabase functions deploy delete-account`
// (no necesita secrets propios — SUPABASE_URL y
// SUPABASE_SERVICE_ROLE_KEY los inyecta la plataforma).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

// ~100 años: efectivamente "para siempre" sin depender de un valor
// mágico como -1 que la librería no documenta como soportado.
const BAN_DURATION = '876000h'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const authHeader = req.headers.get('Authorization') || ''
  const jwt = authHeader.replace(/^Bearer\s+/i, '')
  if (!jwt) return json({ error: 'No autenticado.' }, 401)

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(jwt)
  if (userError || !userData?.user) return json({ error: 'Sesión inválida.' }, 401)

  const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(userData.user.id, {
    ban_duration: BAN_DURATION
  })
  if (banError) {
    console.error('No se pudo banear la cuenta:', banError.message)
    return json({ error: 'No se pudo eliminar la cuenta. Inténtalo de nuevo en un momento.' }, 500)
  }

  return json({ ok: true })
})
