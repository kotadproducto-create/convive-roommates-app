// Envía el código de recuperación de contraseña saltándose por completo el
// mailer integrado de Supabase (que en este proyecto no está llegando a
// conectar con el SMTP personalizado — ver conversación de soporte
// SU-459895). En vez de auth.resetPasswordForEmail(), esta función:
//   1. Genera el link/código de recuperación con la API de administrador
//      (no envía nada — solo crea el token en auth.users).
//   2. Manda el correo ella misma, directo por la API de Resend (probado
//      y funcionando de forma aislada).
//
// El cliente sigue verificando el código con supabase.auth.verifyOtp(...)
// exactamente igual que antes — eso nunca estuvo roto, solo el envío.
//
// Secretos requeridos (`supabase secrets set ...`):
//   RESEND_API_KEY   — la misma key que ya se usa en SMTP Settings
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los inyecta la propia
// plataforma de Edge Functions — no hace falta fijarlos a mano.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const SENDER = 'Convive <onboarding@resend.dev>'
const MIN_INTERVAL_SECONDS = 60

const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

// Misma idea que el "Minimum interval per user" de SMTP Settings, pero
// aplicado por nosotros mismos: no revela nada del resultado ni de si el
// email existe, solo evita que la misma dirección dispare envíos en
// ráfaga (protección básica contra abuso de este endpoint, que al no
// pasar por /auth/v1/recover ya no hereda el rate limit de Supabase).
async function isThrottled(email: string) {
  const since = new Date(Date.now() - MIN_INTERVAL_SECONDS * 1000).toISOString()
  const { count } = await supabaseAdmin
    .from('password_reset_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('email', email)
    .gte('requested_at', since)
  return (count || 0) > 0
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  let email = ''
  try {
    const body = await req.json()
    email = String(body?.email || '')
      .trim()
      .toLowerCase()
  } catch {
    return json({ error: 'JSON inválido' }, 400)
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: 'Email inválido' }, 400)
  }

  // Igual que el resetPasswordForEmail original: siempre responde éxito
  // genérico, sin revelar si el email existe o si está limitado por
  // frecuencia — evita que este formulario sirva para averiguar qué
  // cuentas están registradas.
  if (await isThrottled(email)) {
    return json({ ok: true })
  }
  await supabaseAdmin.from('password_reset_attempts').insert({ email })

  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo: req.headers.get('origin') ? `${req.headers.get('origin')}/restablecer-contrasena` : undefined }
  })

  // Email no registrado u otro error de Supabase: no se lo decimos al
  // cliente, simplemente no mandamos nada.
  if (error || !data?.properties?.email_otp) {
    if (error) console.error('generateLink error:', error.message)
    return json({ ok: true })
  }

  const code = data.properties.email_otp
  const actionLink = data.properties.action_link

  const html = `
    <h2>Restablece tu contraseña de Convive</h2>
    <p>Escribe este código en la app para elegir una contraseña nueva:</p>
    <p style="font-size:32px;font-weight:bold;letter-spacing:8px;">${code}</p>
    <p>Este código caduca pronto, así que úsalo en los próximos minutos.</p>
    ${actionLink ? `<p>Si prefieres, también puedes <a href="${actionLink}">usar este enlace</a>.</p>` : ''}
    <p>Si no pediste esto, ignora este correo.</p>
  `

  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: SENDER, to: email, subject: 'Tu código para restablecer tu contraseña', html })
  })

  if (!resendRes.ok) {
    console.error('Resend respondió con error:', resendRes.status, await resendRes.text())
    // El código ya quedó generado en Supabase aunque el correo falle; se
    // sigue respondiendo éxito genérico igualmente.
  }

  return json({ ok: true })
})
