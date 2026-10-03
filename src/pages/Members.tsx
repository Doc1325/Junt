import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import Shell from '../components/Shell'

function initials(name: string | null | undefined) {
  if (!name) return '?'
  return name.split(' ').filter(Boolean).slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()
}

export default function Members() {
  const { groupId = '' } = useParams()

  const { data: group, isLoading } = useQuery({
    queryKey: ['group', groupId],
    queryFn: async () => {
      const { data: g, error: ge } = await supabase
        .from('groups').select('id, name').eq('id', groupId).single()
      if (ge) throw ge
      const { data: members, error: me } = await supabase
        .from('group_members').select('user_id, role, joined_at, profiles(id, full_name, avatar_url)')
        .eq('group_id', groupId).order('role', { ascending: false })
      if (me) throw me
      return { ...g, members: members || [] }
    },
  })

  if (isLoading) return <Shell><p className="empty-state">Cargando miembros…</p></Shell>
  if (!group) return <Shell><Link className="back" to="/">← Todos los grupos</Link><p className="empty-state">No pudimos cargar los miembros.</p></Shell>

  return (
    <Shell>
      <Link className="back" to={'/groups/' + groupId}>← {group.name}</Link>
      <section className="section-heading" style={{ marginTop: 0 }}>
        <div>
          <p className="eyebrow">MIEMBROS</p>
          <h2>{group.members.length} {group.members.length === 1 ? 'persona' : 'personas'}</h2>
        </div>
      </section>
      <div className="group-list" style={{ marginBottom: 30 }}>
        {group.members.map((m: any) => (
          <div className="group-card" key={m.user_id} style={{ cursor: 'default' }}>
            <span className="group-icon">{initials(m.profiles?.full_name)}</span>
            <div className="group-card-body">
              <strong>{m.profiles?.full_name || 'Usuario'}</strong>
              <div className="group-meta">
                <span>{m.role === 'owner' ? 'Creador' : 'Miembro'}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Shell>
  )
}
