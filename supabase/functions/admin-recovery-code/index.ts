// Recuperación de acceso asistida por un admin del piso — no envía ningún correo.
//
// Contexto: mientras el remitente de Resend no sea un dominio verificado, el
// correo de "Olvidé mi contraseña" (ver send-recovery-code) solo le llega al
// dueño de la cuenta de Resend. Esta función es la alternativa: un ADMIN del
// piso genera un código de un solo uso para un compañero, se lo pasa por el
// WhatsApp del piso, y la persona lo escribe en "Olvidé mi contraseña →
// Ya tengo un código" junto con su email y su contraseña nueva. El cliente lo
// verifica con supabase.auth.verifyOtp({ type: 'recovery' }), igual que el
// código que llega por correo.
//
// Seguridad (un admin podría, con este código, cambiar la contraseña de otra
// persona, así que se protege así):
//   - Solo un admin ACTIVO del piso, y solo para un miembro ACTIVO de ese mismo
//     piso (nunca para sí mismo ni para gente de otros pisos).
//   - El código no se devuelve por correo ni se guarda: solo se le muestra al
//     admin, y caduca según la configuración de OTP de Supabase.
//   - A la persona afectada le llega una notificación ("X generó un código de
//     recuperación para tu cuenta"), así que nunca ocurre a sus espaldas.
//   - Como mínimo pasan 30 s entre códigos para la misma cuenta.
//
// Despliegue (una vez): en Supabase → Edge Functions → "Deploy a new function"
// → nombre `admin-recovery-code` → pegar este archivo. Deja activado "Verify
// JWT". No necesita secretos: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los
// inyecta la plataforma. (Con la CLI: `supabase functions deploy admin-recovery-code`.)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const MIN_INTERVAL_SECONDS = 30

const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  // 1) Quién llama: el JWT de la sesión (el gateway ya exige uno válido, pero se
  //    comprueba y se resuelve el usuario aquí).
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
  const { data: callerData, error: callerError } = token ? await supabaseAdmin.auth.getUser(token) : { data: null, error: true }
  const caller = callerData?.user
  if (callerError || !caller) return json({ error: 'unauthorized' }, 401)

  let targetUserId = ''
  try {
    const body = await req.json()
    targetUserId = String(body?.targetUserId || '')
  } catch {
    return json({ error: 'bad_request' }, 400)
  }
  if (!targetUserId || targetUserId === caller.id) return json({ error: 'bad_request' }, 400)

  // 2) El que llama es admin activo de algún piso…
  const { data: adminRows } = await supabaseAdmin
    .from('floor_memberships')
    .select('floor_id')
    .eq('user_id', caller.id)
    .eq('status', 'active')
    .eq('role', 'admin')
  const adminFloorIds = (adminRows || []).map((r) => r.floor_id)
  if (adminFloorIds.length === 0) return json({ error: 'not_admin' }, 403)

  // 3) …y el objetivo es miembro activo de ese mismo piso.
  const { data: targetMembership } = await supabaseAdmin
    .from('floor_memberships')
    .select('floor_id')
    .eq('user_id', targetUserId)
    .eq('status', 'active')
    .in('floor_id', adminFloorIds)
    .maybeSingle()
  if (!targetMembership) return json({ error: 'not_member' }, 403)

  const { data: targetUser } = await supabaseAdmin.auth.admin.getUserById(targetUserId)
  const email = targetUser?.user?.email?.toLowerCase()
  if (!email) return json({ error: 'not_found' }, 404)

  // 4) Frecuencia mínima por cuenta (misma tabla que send-recovery-code).
  const since = new Date(Date.now() - MIN_INTERVAL_SECONDS * 1000).toISOString()
  const { count } = await supabaseAdmin
    .from('password_reset_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('email', email)
    .gte('requested_at', since)
  if ((count || 0) > 0) return json({ error: 'too_soon' }, 429)
  await supabaseAdmin.from('password_reset_attempts').insert({ email })

  // 5) Genera el código de recuperación (no envía ningún correo).
  const { data: link, error: linkError } = await supabaseAdmin.auth.admin.generateLink({ type: 'recovery', email })
  const code = link?.properties?.email_otp
  if (linkError || !code) {
    console.error('generateLink error:', linkError?.message)
    return json({ error: 'failed' }, 500)
  }

  // 6) Aviso a la persona afectada: nunca debe enterarse por su cuenta.
  const { data: callerProfile } = await supabaseAdmin.from('profiles').select('name').eq('id', caller.id).maybeSingle()
  const { data: targetProfile } = await supabaseAdmin.from('profiles').select('name').eq('id', targetUserId).maybeSingle()
  await supabaseAdmin.from('notifications').insert({
    floor_id: targetMembership.floor_id,
    user_id: targetUserId,
    type: 'account_recovery',
    read: false,
    message: `${callerProfile?.name || 'Un admin del piso'} generó un código de recuperación para tu cuenta. Si no lo pediste, avísalo al piso y cambia tu contraseña.`
  })

  return json({ ok: true, code, targetName: targetProfile?.name || '' })
})
