import { createClient } from 'npm:@supabase/supabase-js@^2.110.8'

interface NotificationPayload { planId: string }
interface PushTicket {
  status: 'ok' | 'error'
  id?: string
  message?: string
  details?: { error?: string }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Unauthorized' }, 401)

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: 'Server is not configured' }, 500)

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user }, error: authError } = await userClient.auth.getUser()
  if (authError || !user) return json({ error: 'Unauthorized' }, 401)

  let payload: NotificationPayload
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  if (!payload.planId) return json({ error: 'Missing planId' }, 400)

  const admin = createClient(supabaseUrl, serviceRoleKey)
  const { data: plan, error: planError } = await admin
    .from('plans')
    .select('id, title, group_id, created_by, group:group_id(name)')
    .eq('id', payload.planId)
    .single()
  if (planError || !plan) return json({ error: 'Plan not found' }, 404)
  if (plan.created_by !== user.id) return json({ error: 'Only the plan creator can notify members' }, 403)

  const { data: creator } = await admin.from('profiles').select('full_name').eq('id', user.id).single()
  const { data: members, error: membersError } = await admin
    .from('group_members')
    .select('user_id')
    .eq('group_id', plan.group_id)
    .neq('user_id', user.id)
  if (membersError) return json({ error: 'Failed to fetch members' }, 500)

  const memberIds = (members ?? []).map((member) => member.user_id)
  if (memberIds.length === 0) return json({ sent: 0, invalid: 0 })

  const { data: tokens, error: tokensError } = await admin
    .from('user_push_tokens')
    .select('token, platform')
    .in('user_id', memberIds)
  if (tokensError) return json({ error: 'Failed to fetch tokens' }, 500)
  if (!tokens?.length) return json({ sent: 0, invalid: 0 })

  const groupRelation = plan.group as { name?: string } | { name?: string }[] | null
  const groupName = Array.isArray(groupRelation) ? groupRelation[0]?.name : groupRelation?.name
  const creatorName = creator?.full_name || user.user_metadata?.full_name || 'Alguien'
  const messages = tokens.map((token) => ({
    to: token.token,
    sound: 'default',
    title: `${creatorName} creó un plan en ${groupName || 'tu grupo'}`,
    body: plan.title,
    data: { planId: plan.id, groupId: plan.group_id },
    priority: 'high',
    channelId: 'default',
  }))

  const expoResponse = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(messages),
  })
  if (!expoResponse.ok) return json({ error: 'Push provider rejected the request' }, 502)

  const result = await expoResponse.json()
  const raw = result.data ?? result
  const tickets: PushTicket[] = Array.isArray(raw) ? raw : [raw]
  const invalidTokens = tickets.flatMap((ticket, index) => {
    const reason = ticket.details?.error || ticket.message || ''
    return ticket.status === 'error' && ['DeviceNotRegistered', 'InvalidCredentials'].some((code) => reason.includes(code))
      ? [tokens[index]?.token]
      : []
  }).filter((token): token is string => Boolean(token))

  if (invalidTokens.length) await admin.from('user_push_tokens').delete().in('token', invalidTokens)
  return json({ sent: messages.length, invalid: invalidTokens.length })
})
