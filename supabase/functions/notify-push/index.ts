// Edge Function disparada por un Database Webhook (Supabase Dashboard →
// Database → Webhooks, INSERT en la tabla `notifications`, NO por SQL).
// Traduce cada notificación interna de Convive en un push real vía
// OneSignal, apuntando por `external_id` (= profiles.id = auth.uid()) sin
// necesitar guardar ningún token de dispositivo en nuestra propia base.
//
// Secretos requeridos (`supabase secrets set ...`):
//   ONESIGNAL_APP_ID          — igual al VITE_ONESIGNAL_APP_ID del cliente
//   ONESIGNAL_REST_API_KEY    — secreto, nunca debe salir de aquí
//   WEBHOOK_SECRET            — string al azar; debe coincidir con el
//                                header `x-webhook-secret` configurado en
//                                el Database Webhook del Dashboard
//   ONESIGNAL_AUTH_SCHEME     — opcional, "Basic" por defecto. OneSignal ha
//                                usado distintos esquemas ("Basic" vs
//                                "Key") según la versión de la REST API
//                                Key; si el envío falla con 401, probar
//                                cambiando esto a "Key" sin tocar código.
//
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los inyecta la propia
// plataforma de Edge Functions — no hace falta fijarlos a mano.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ONESIGNAL_APP_ID = Deno.env.get('ONESIGNAL_APP_ID')
const ONESIGNAL_REST_API_KEY = Deno.env.get('ONESIGNAL_REST_API_KEY')
const WEBHOOK_SECRET = Deno.env.get('WEBHOOK_SECRET')
const ONESIGNAL_AUTH_SCHEME = Deno.env.get('ONESIGNAL_AUTH_SCHEME') || 'Basic'

const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

Deno.serve(async (req) => {
  if (req.headers.get('x-webhook-secret') !== WEBHOOK_SECRET) {
    return new Response('Unauthorized', { status: 401 })
  }

  const payload = await req.json()
  const record = payload?.record
  if (!record) return new Response('Sin record', { status: 400 })

  const { user_id: userId, floor_id: floorId, message } = record

  let externalIds: string[] = []
  if (userId) {
    externalIds = [userId]
  } else if (floorId) {
    const { data, error } = await supabaseAdmin
      .from('floor_memberships')
      .select('user_id')
      .eq('floor_id', floorId)
      .eq('status', 'active')
    if (error) {
      console.error('Error consultando floor_memberships:', error)
      return new Response('Error de base de datos', { status: 500 })
    }
    externalIds = (data || []).map((r) => r.user_id)
  }

  if (externalIds.length === 0) {
    return new Response(JSON.stringify({ sent: 0, reason: 'sin destinatarios' }), { status: 200 })
  }

  const oneSignalRes = await fetch('https://onesignal.com/api/v1/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `${ONESIGNAL_AUTH_SCHEME} ${ONESIGNAL_REST_API_KEY}`
    },
    body: JSON.stringify({
      app_id: ONESIGNAL_APP_ID,
      include_aliases: { external_id: externalIds },
      target_channel: 'push',
      headings: { en: 'Convive', es: 'Convive' },
      contents: { en: message, es: message }
    })
  })

  const oneSignalBody = await oneSignalRes.json()
  if (!oneSignalRes.ok) {
    console.error('OneSignal respondió con error:', oneSignalRes.status, oneSignalBody)
    return new Response(JSON.stringify(oneSignalBody), { status: 502 })
  }

  return new Response(JSON.stringify({ sent: externalIds.length, oneSignalId: oneSignalBody.id }), { status: 200 })
})
