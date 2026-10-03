import { Link, useParams, useNavigate, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import Shell from '../components/Shell'
import './EventDetail.css'

const PLAN_PREFIX: Record<string, string> = {
  'Música': 'Concierto',
  'Festival': 'Festival',
  'Comedia': 'Show',
  'Teatro': 'Obra',
  'Cultura': 'Evento cultural',
  'Deporte': 'Evento deportivo',
  'Educativo': 'Taller',
  'Bienestar': 'Actividad',
  'Otros': 'Salida',
}

export default function EventDetail() {
  const { kind = 'evento', slug = '' } = useParams()
  const nav = useNavigate()
  const location = useLocation() as { state?: { item?: Record<string, unknown> } }

  const { data: item, isLoading } = useQuery({
    queryKey: ['event-detail', kind, slug],
    queryFn: async () => {
      if (location.state?.item && (location.state.item as { slug: string }).slug === slug) return location.state.item
      const table = kind === 'cine' ? 'movies' : 'events'
      const col = kind === 'cine' ? 'external_id' : 'slug'
      const { data, error } = await supabase.from(table).select('*').eq(col, slug).single()
      if (error) throw error
      return { kind, ...data } as Record<string, unknown>
    },
  })

  if (isLoading) return <Shell><p className="empty-state">Cargando…</p></Shell>
  if (!item) return <Shell><p className="empty-state">No encontramos este evento.</p><Link className="back" to={-1 as unknown as string}>← Volver</Link></Shell>

  const isMovie = (item as { kind: string }).kind === 'cine' || kind === 'cine'
  const title = (item as { title: string }).title
  const image = (item as { image: string }).image
  const category = (item as { category: string }).category || (item as { genres: string[] }).genres?.join(', ')
  const priceTag = (item as { price_tag: string }).price_tag
  const price = ((item as { price: string }).price as string) || priceTag
  const province = (item as { province: string }).province || (item as { city: string }).city
  const venue = (item as { venue: string }).venue
  const date = (item as { start_date: string }).start_date
  const hour = (item as { hour_start: string }).hour_start
  const desc = (item as { description: string }).description || (item as { synopsis: string }).synopsis
  const source = (item as { source_url: string }).source_url

  // Prefijo del plan según categoría (ej. evento musical → "Concierto: X").
  // Evita duplicar si el título ya empieza con el prefijo.
  const planPrefix = isMovie ? 'Película' : (PLAN_PREFIX[category ?? ''] ?? 'Salida')
  const planTitle = title.toLowerCase().startsWith(planPrefix.toLowerCase()) ? title : `${planPrefix}: ${title}`

  const useForPlan = () => {
    const startDate = (item as { start_date: string }).start_date
    const hourStart = (item as { hour_start: string }).hour_start
    const scheduledAt = startDate ? (hourStart ? `${startDate}T${hourStart.slice(0,5)}` : `${startDate}T19:00`) : undefined
    sessionStorage.setItem('junte_prefill', JSON.stringify({ title: planTitle, description: source || desc || '', scheduledAt }))
    const groupId = (location.state as { groupId?: string })?.groupId
    if (groupId) nav(`/groups/${groupId}/plans/new`)
    else nav(-1 as unknown as string)
  }

  return (
    <Shell>
      <Link className="back" to={-1 as unknown as string}>← Volver</Link>
      <div className="detail">
        <div className="detail__grid">
          <div className="detail__media">
            {image && image !== 'N/A' ? <img src={image} alt={title} /> : <div className="detail__placeholder">{isMovie ? '🎬' : '📍'}</div>}
            <span className="detail__badge detail__badge--left">{category || (isMovie ? 'Cine' : 'Evento')}</span>
            <span className={`detail__badge detail__badge--right ${priceTag === 'Gratis' ? 'detail__badge--lime' : ''}`}>{price || 'De pago'}</span>
          </div>
          <div className="detail__body">
            <h1 className="detail__title">{title}</h1>
            <div className="detail__meta">
              <span className="detail__meta-row"><span className="detail__meta-icon">📍</span> <span><strong>{province}</strong>{venue ? ` · ${venue}` : ''}</span></span>
              {date && <span className="detail__meta-row"><span className="detail__meta-icon">📅</span> <strong>{date}{hour ? ` · ${hour.slice(0,5)}` : ''}</strong></span>}
              {category && <span className="detail__meta-row"><span className="detail__meta-icon">✨</span> {category}</span>}
              <span className="detail__meta-row"><span className="detail__meta-icon">💸</span> <strong className={priceTag==='Gratis'?'text-[#1a7a3a]':''}>{price}</strong></span>
            </div>
            {desc && <div className="detail__desc"><p className="eyebrow">SOBRE EL EVENTO</p><p>{desc}</p></div>}
            <div className="detail__actions">
              <button onClick={useForPlan} className="primary-action">Usar para plan</button>
              {source && <a href={source} target="_blank" rel="noopener noreferrer">Ver fuente</a>}
            </div>
          </div>
        </div>
      </div>
    </Shell>
  )
}
