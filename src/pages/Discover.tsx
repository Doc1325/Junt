import { useNavigate, useParams } from 'react-router-dom'
import Shell from '../components/Shell'
import Recommendations from '../components/Recommendations'

export default function Discover() {
  const { groupId = '' } = useParams()
  const nav = useNavigate()

  function handleSelect(item: Record<string, unknown>) {
    const isMovie = (item as { kind: string }).kind === 'cine'
    const slug = (item as { slug: string }).slug || (item as { external_id: string }).external_id
    nav(`/detalle/${isMovie ? 'cine' : 'evento'}/${slug}`, { state: { item, groupId } })
  }

  return (
    <Shell>
      <section className="form-page" style={{ maxWidth: 900 }}>
        <Recommendations onSelect={handleSelect} groupId={groupId} />
      </section>
    </Shell>
  )
}
