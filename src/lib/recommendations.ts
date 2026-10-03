export type JunteFilters = {
  city: string
  budget: string
  type: string
  category: string
  sort?: 'score' | 'fecha' | 'precio'
}
export type ScoreBreakdown = { category: number; type: number; budget: number; recency: number; quality: number }
export const JUNTE_CITIES = [
  'Todas',
  'Santo Domingo',
  'Santiago',
  'La Altagracia',
  'Puerto Plata',
  'Moca',
  'La Vega',
  'Monte Cristi',
  'San Cristobal',
  'San Cristóbal',
  'Valverde',
  'Los Ríos',
  'Distrito Nacional',
  'Baoruco',
  'Bonao',
  'Duarte',
  'Elías Piña',
  'Espaillat',
  'Mao',
  'Monseñor Nouel',
  'Peravia',
  'Samaná',
] as const
export const JUNTE_BUDGETS = ['Cualquiera', 'Gratis', 'De pago'] as const
export const JUNTE_TYPES = ['todos', 'eventos', 'cine'] as const
export const JUNTE_CATEGORIES = ['Todas', 'Bienestar', 'Comedia', 'Cultura', 'Deporte', 'Educativo', 'Festival', 'Música', 'Otros', 'Teatro'] as const

export function buildRecommendUrl(filters: JunteFilters, page = 1): string | null {
  const base = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '')
  if (!base) return null
  const params = new URLSearchParams()
  if (filters.city !== 'Todas') params.set('city', filters.city)
  if (filters.budget !== 'Cualquiera') params.set('budget', filters.budget)
  if (filters.type !== 'todos') params.set('type', filters.type)
  if (filters.category !== 'Todas') params.set('category', filters.category)
  if (filters.sort && filters.sort !== 'score') params.set('sort', filters.sort)
  params.set('limit', '50')
  params.set('page', String(page))
  return `${base}/functions/v1/recommend?${params.toString()}`
}

export type RecommendResponse = {
  ok: boolean
  total: number
  count: number
  page: number
  limit: number
  hasMore: boolean
  data: Array<Record<string, unknown> & { kind: string; score: number; scoreBreakdown: ScoreBreakdown }>
}

export async function fetchRecommendations(filters: JunteFilters, page = 1): Promise<RecommendResponse> {
  const url = buildRecommendUrl(filters, page)
  if (!url) throw new Error('Supabase no configurado')
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY!
  const res = await fetch(url, { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } })
  if (!res.ok) throw new Error(`recommend ${res.status}: ${await res.text()}`)
  const json = await res.json()
  if (!json.ok) throw new Error(json.error)
  return json as RecommendResponse
}
