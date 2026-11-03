import { createClient } from 'npm:@supabase/supabase-js@^2.110.8'

interface NotificationPayload { planId: string }
interface PushTicket {
  status: 'ok' | 'error'
  id?: string
  message?: string
  details?: { error?: string }
}
interface OutboxEvent { id: string; attempts: number }

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

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown notification error'
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

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: plan, error: planError } = await admin
    .from('plans')
    .select('id, title, group_id, created_by, group:group_id(name)')
    .eq('id', payload.planId)
    .single()
  if (planError || !plan) return json({ error: 'Plan not found' }, 404)
  if (plan.created_by !== user.id) return json({ error: 'Only the plan creator can notify members' }, 403)

  const { data: claimedRows, error: claimError } = await admin
    .rpc('claim_plan_notification', { target_plan_id: payload.planId })
  if (claimError) return json({ error: 'Could not claim notification event' }, 500)

  const event = (claimedRows?.[0] ?? null) as OutboxEvent | null
  if (!event) {
    const { data: existing } = await admin
      .from('notification_outbox')
      .select('status, attempts, next_attempt_at')
      .eq('event_type', 'plan.created')
      .eq('aggregate_id', payload.planId)
      .maybeSingle()
    const status = existing?.status ?? 'missing'
    if (status === 'failed' || status === 'pending') {
      return json({ error: 'Notification is queued for retry', outbox: status }, 503)
    }
    return json({ sent: 0, idempotent: true, outbox: status }, 202)
  }

  async function markSent() {
    const now = new Date().toISOString()
    const { error } = await admin
      .from('notification_outbox')
      .update({ status: 'sent', sent_at: now, locked_at: null, updated_at: now })
      .eq('id', event!.id)
      .eq('status', 'processing')
    if (error) throw error
  }

  async function markFailed(reason: string) {
    const retryDelaySeconds = Math.min(2 ** Math.max(event!.attempts - 1, 0), 300)
    await admin
      .from('notification_outbox')
      .update({
        status: 'failed',
        last_error: reason.slice(0, 1000),
        locked_at: null,
        next_attempt_at: new Date(Date.now() + retryDelaySeconds * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', event!.id)
      .eq('status', 'processing')
  }

  try {
    const { data: creator } = await admin.from('profiles').select('full_name').eq('id', user.id).single()
    const { data: members, error: membersError } = await admin
      .from('group_members')
      .select('user_id')
      .eq('group_id', plan.group_id)
      .neq('user_id', user.id)
    if (membersError) throw membersError

    const memberIds = (members ?? []).map((member) => member.user_id)
    if (memberIds.length === 0) {
      await markSent()
      return json({ sent: 0, invalid: 0, outbox: 'sent' })
    }

    const { data: tokens, error: tokensError } = await admin
      .from('user_push_tokens')
      .select('token, platform')
      .in('user_id', memberIds)
    if (tokensError) throw tokensError
    if (!tokens?.length) {
      await markSent()
      return json({ sent: 0, invalid: 0, outbox: 'sent' })
    }

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

    const tickets: PushTicket[] = []
    for (let offset = 0; offset < messages.length; offset += 100) {
      const expoResponse = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messages.slice(offset, offset + 100)),
      })
      if (!expoResponse.ok) throw new Error(`Push provider rejected the request (${expoResponse.status})`)

      const result = await expoResponse.json()
      const raw = result.data ?? result
      tickets.push(...(Array.isArray(raw) ? raw : [raw]))
    }

    if (tickets.some((ticket) => ticket.details?.error === 'InvalidCredentials')) {
      throw new Error('Push provider credentials are invalid')
    }

    const invalidTokens = tickets.flatMap((ticket, index) =>
      ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered'
        ? [tokens[index]?.token]
        : []
    ).filter((token): token is string => Boolean(token))

    if (invalidTokens.length) await admin.from('user_push_tokens').delete().in('token', invalidTokens)
    await markSent()

    return json({
      sent: tickets.filter((ticket) => ticket.status === 'ok').length,
      invalid: invalidTokens.length,
      failed: tickets.filter((ticket) => ticket.status === 'error').length - invalidTokens.length,
      outbox: 'sent',
    })
  } catch (error) {
    const message = errorMessage(error)
    await markFailed(message)
    console.error('[notify-new-plan]', { planId: payload.planId, eventId: event.id, error: message })
    return json({ error: 'Notification delivery failed; it remains queued for retry' }, 502)
  }
})
