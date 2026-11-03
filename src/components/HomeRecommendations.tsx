import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchRecommendations, type JunteFilters } from '../lib/recommendations'
import QueryError from './QueryError'
import './HomeRecommendations.css'

const HOME_FILTERS: JunteFilters = {
  city: 'Todas',
  budget: 'Cualquiera',
  type: 'eventos',
  category: 'Todas',
  sort: 'score',
}

function formatDate(value: unknown) {
  if (typeof value !== 'string' || !value) return 'Fecha por confirmar'
  return new Intl.DateTimeFormat('es-DO', { weekday: 'short', day: 'numeric', month: 'short' })
    .format(new Date(`${value}T12:00:00`))
}

export default function HomeRecommendations({ embedded = false }: { embedded?: boolean }) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [hovered, setHovered] = useState(false)
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ['homeRecommendations'],
    queryFn: () => fetchRecommendations(HOME_FILTERS, 1, 6),
    staleTime: 5 * 60_000,
  })
  const events = data?.data ?? []
  const activeEvent = events[activeIndex]

  useEffect(() => {
    if (activeIndex < events.length) return
    setActiveIndex(0)
  }, [activeIndex, events.length])

  useEffect(() => {
    if (events.length < 2 || hovered || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const interval = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % events.length)
    }, 5000)
    return () => window.clearInterval(interval)
  }, [events.length, hovered])

  const move = (direction: number) => {
    if (events.length < 2) return
    setActiveIndex((index) => (index + direction + events.length) % events.length)
  }

  return (
    <section className={`home-reco${embedded ? ' home-reco--embedded' : ''}`} aria-labelledby="home-reco-title">
      {embedded ? (
        <div className="home-reco__embedded-heading">
          <p className="eyebrow" id="home-reco-title">EVENTO RECOMENDADO</p>
          <Link className="home-reco__more" to="/discover">Ver más →</Link>
        </div>
      ) : (
        <div className="section-heading home-reco__heading">
          <div>
            <p className="eyebrow">DESCUBRE ALGO NUEVO</p>
            <h2 id="home-reco-title">Eventos para el próximo junte</h2>
          </div>
          <Link className="home-reco__more" to="/discover">Ver más →</Link>
        </div>
      )}

      {error && <QueryError error={error} onRetry={() => void refetch()} />}
      {isLoading && (
        <div className="home-reco__card home-reco__skeleton" aria-label="Cargando eventos" />
      )}
      {!isLoading && !error && events.length === 0 && (
        <div className="empty-state">No hay eventos próximos disponibles ahora mismo.</div>
      )}
      {!isLoading && !error && activeEvent && (
        <div
          className="home-reco__slideshow"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          {(() => {
            const slug = String(activeEvent.slug ?? '')
            const title = String(activeEvent.title ?? '')
            const image = String(activeEvent.image ?? '')
            const price = String(activeEvent.price ?? activeEvent.price_tag ?? 'De pago')
            const category = String(activeEvent.category ?? 'Evento')
            return (
              <Link
                className="home-reco__card home-reco__slide"
                key={String(activeEvent.id ?? slug)}
                to={`/detalle/evento/${slug}`}
                state={{ item: activeEvent }}
                aria-label={`Ver ${title}. Evento ${activeIndex + 1} de ${events.length}`}
              >
                <div className="home-reco__image">
                  {image && image !== 'N/A' ? <img src={image} alt="" loading="lazy" /> : <span aria-hidden>📍</span>}
                  <span className="home-reco__category">{category}</span>
                </div>
                <div className="home-reco__body">
                  <strong>{title}</strong>
                  <span>{formatDate(activeEvent.start_date)} · {String(activeEvent.province ?? '')}</span>
                  <small>{price}</small>
                  <b>Ver detalle y elegir grupo →</b>
                </div>
              </Link>
            )
          })()}
          {events.length > 1 && (
            <div className="home-reco__controls">
              <button type="button" onClick={() => move(-1)} aria-label="Evento anterior">←</button>
              <div className="home-reco__dots" aria-label={`Evento ${activeIndex + 1} de ${events.length}`}>
                {events.map((item, index) => (
                  <button
                    type="button"
                    className={index === activeIndex ? 'active' : ''}
                    aria-label={`Mostrar evento ${index + 1}`}
                    aria-current={index === activeIndex ? 'true' : undefined}
                    onClick={() => setActiveIndex(index)}
                    key={String(item.id ?? item.slug ?? index)}
                  />
                ))}
              </div>
              <button type="button" onClick={() => move(1)} aria-label="Siguiente evento">→</button>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
