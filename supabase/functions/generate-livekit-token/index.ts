import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
}

function b64url(data: string): string {
  return btoa(data).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
}

async function createLiveKitToken(
  apiKey: string,
  apiSecret: string,
  identity: string,
  name: string,
  room: string,
): Promise<string> {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const now = Math.floor(Date.now() / 1000)
  const payload = b64url(JSON.stringify({
    exp: now + 3600,
    iss: apiKey,
    sub: identity,
    name,
    video: { room, roomJoin: true },
  }))
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(apiSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${header}.${payload}`))
  const signature = b64url(String.fromCharCode(...new Uint8Array(sig)))
  return `${header}.${payload}.${signature}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders, status: 204 })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_ANON_KEY') || '',
      { global: { headers: { Authorization: authHeader } } },
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const { room_id } = await req.json()
    if (!room_id) return new Response(JSON.stringify({ error: 'room_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const { data: room, error: roomError } = await supabase
      .from('virtual_rooms')
      .select('*, plan:plan_id(group_id)')
      .eq('id', room_id)
      .single()
    if (roomError || !room) return new Response(JSON.stringify({ error: 'Room not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const { data: membership } = await supabase
      .from('group_members')
      .select('user_id')
      .eq('group_id', room.plan.group_id)
      .eq('user_id', user.id)
      .single()
    if (!membership) return new Response(JSON.stringify({ error: 'Not a member' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const livekitApiKey = Deno.env.get('LIVEKIT_API_KEY') || ''
    const livekitApiSecret = Deno.env.get('LIVEKIT_API_SECRET') || ''
    const livekitUrl = Deno.env.get('LIVEKIT_URL') || ''
    if (!livekitApiKey || !livekitApiSecret || !livekitUrl) {
      return new Response(JSON.stringify({ error: 'LiveKit not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const token = await createLiveKitToken(
      livekitApiKey,
      livekitApiSecret,
      user.id,
      user.user_metadata?.full_name || 'User',
      room.room_name,
    )

    return new Response(JSON.stringify({ token, url: livekitUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Internal error', detail: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
