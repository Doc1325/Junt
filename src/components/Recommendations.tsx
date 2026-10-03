import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchRecommendations, JUNTE_BUDGETS, JUNTE_CATEGORIES, JUNTE_CITIES, JUNTE_TYPES, type JunteFilters } from '../lib/recommendations'
import './Recommendations.css'

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: readonly string[] }) {
  return (
    <label className="reco__select-wrap">
      <span className="reco__select-label">{label}</span>
      <div className="reco__select">
        <select value={value} onChange={(e) => onChange(e.target.value)}>
          {options.map((o) => (
            <option key={o} value={o}>{o === 'todos' ? 'Todos' : o}</option>
          ))}
        </select>
        <span className="reco__select-arrow">▾</span>
      </div>
    </label>
  )
}

export default function Recommendations({ onSelect, groupId }: { onSelect?: (item: Record<string, unknown>) => void; groupId?: string }) {
  const [filters, setFilters] = useState<JunteFilters>({ city: 'Todas', budget: 'Cualquiera', type: 'todos', category: 'Todas', sort: 'score' })
  const [page, setPage] = useState(1)
  const { data: resp, isLoading, error, isFetching } = useQuery({
    queryKey: ['recommend', filters, page],
    queryFn: () => fetchRecommendations(filters, page),
  })
  const data = resp?.data ?? []
  const total = resp?.total ?? 0
  const hasMore = resp?.hasMore ?? false

  const update = (k: keyof JunteFilters, v: string) => {
    setFilters((f) => ({ ...f, [k]: v }))
    setPage(1)
  }

  return (
    <div className="reco">
      {groupId && (
        <Link to={`/groups/${groupId}`} className="self-start inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--muted)] hover:text-[var(--ink)] transition -mt-1">
          ← Volver al grupo
        </Link>
      )}
      <div className="reco__header">
        <div>
          <h3 className="reco__title">¿Pa dónde vamos?</h3>
          <p className="reco__subtitle">Basado en padonde.do · combina ciudad, presupuesto y tipo</p>
        </div>
        <span className="reco__badge-live"><span className="reco__badge-live-dot" /> EN VIVO</span>
      </div>

      <div className="reco__filters">
        <Select label="Ciudad" value={filters.city} onChange={(v) => update('city', v)} options={JUNTE_CITIES} />
        <Select label="Presupuesto" value={filters.budget} onChange={(v) => update('budget', v)} options={JUNTE_BUDGETS} />
        <Select label="Tipo" value={filters.type} onChange={(v) => update('type', v)} options={JUNTE_TYPES} />
        <Select label="Categoría" value={filters.category} onChange={(v) => update('category', v)} options={JUNTE_CATEGORIES} />
        <Select label="Ordenar por" value={filters.sort ?? 'score'} onChange={(v) => update('sort', v)} options={['score', 'fecha', 'precio'] as const} />
      </div>

      {!isLoading && !error && total > 0 && (
        <p className="text-xs text-[var(--muted)] text-center">{total} resultados · página {page} de {Math.ceil(total / 50)}</p>
      )}

      {error && <p className="form-error">No pudimos cargar recomendaciones: {(error as Error).message}</p>}
      {!isLoading && !error && data.length === 0 && (
        <div className="reco__empty">
          <p style={{ fontWeight:600, color:'var(--ink)', fontSize:14, margin:0 }}>No hay salidas con esos filtros</p>
          <p style={{ fontSize:12, color:'var(--muted)', marginTop:4 }}>Prueba Todas / Cualquiera o cambia de categoría.</p>
        </div>
      )}

      {isLoading && (
        <div className="reco__grid">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="reco__card" style={{ opacity:.6 }}>
              <div className="reco__card-image" style={{ background:'var(--paper)' }} />
              <div style={{ padding:12, display:'flex', flexDirection:'column', gap:8, flex:1 }}>
                <div style={{ height:12, background:'var(--paper)', borderRadius:6, width:'75%', margin:'0 auto' }} />
                <div style={{ height:10, background:'var(--paper)', borderRadius:6, width:'50%', margin:'0 auto' }} />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="reco__grid">
        {data.map((item: Record<string, unknown>) => {
          const isMovie = (item as { kind: string }).kind === 'cine'
          const title = (item as { title: string }).title
          const category = ((item as { category: string }).category || (item as { genres: string[] }).genres?.[0]) as string
          const priceTag = (item as { price_tag: string }).price_tag
          const price = (item as { price: string }).price as string | null
          const displayPrice = price || priceTag
          const image = (item as { image: string }).image as string
          const isGratis = priceTag === 'Gratis' || displayPrice === 'Gratis'
          const href = `/detalle/${isMovie ? 'cine' : 'evento'}/${(item as { slug: string }).slug || (item as { external_id: string }).external_id}`
          return (
            <a
              key={`${(item as { kind: string }).kind}-${(item as { id: string }).id ?? (item as { slug: string }).slug}`}
              href={href}
              onClick={(e) => { if (onSelect) { e.preventDefault(); onSelect(item) } }}
              className="reco__card"
            >
              <div className="reco__card-inner">
                <div className="reco__card-image">
                  {image && image !== 'N/A' ? <img src={image} alt={title} loading="lazy" /> : <div className="reco__card-placeholder">{isMovie ? '🎬' : '📍'}</div>}
                </div>
                <div className="reco__card-body">
                  <h4 className="reco__card-title">{title}</h4>
                  <div className="reco__card-meta">
                    {category && <span className="reco__pill"><span className="reco__pill-dot" /> {category}</span>}
                    <span className={`reco__pill ${isGratis ? 'reco__pill--lime' : 'reco__pill--white'}`}>{displayPrice || (isGratis ? 'Gratis' : 'De pago')}</span>
                  </div>
                  <div className="reco__card-footer"><span>Ver detalle →</span></div>
                </div>
              </div>
            </a>
          )
        })}
      </div>

      {!isLoading && !error && total > 0 && (
        <div className="reco__pagination">
          <button disabled={page <= 1 || isFetching} onClick={() => setPage((p) => Math.max(1, p - 1))} className="reco__page-btn reco__page-btn--prev">
            <span aria-hidden>←</span> Anterior
          </button>
          <span className="reco__page-info">
            <span className="reco__page-dot" /> Página {page} de {Math.ceil(total / 50)}
          </span>
          <button disabled={!hasMore || isFetching} onClick={() => setPage((p) => p + 1)} className="reco__page-btn reco__page-btn--next">
            Siguiente <span aria-hidden>→</span>
          </button>
        </div>
      )}
    </div>
  )
}
