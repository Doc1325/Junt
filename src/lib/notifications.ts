import { supabase } from './supabase'

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds))

export async function requestPlanNotification(planId: string) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '')
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl || !anonKey) return

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/notify-new-plan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
          apikey: anonKey,
        },
        body: JSON.stringify({ planId }),
      })
      if (response.ok || (response.status >= 400 && response.status < 500)) return
    } catch {
      // A later attempt or a future visit to the plan will retry the outbox event.
    }
    await wait(500 * (2 ** attempt))
  }
}

