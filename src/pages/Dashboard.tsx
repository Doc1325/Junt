import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useGroups, useCurrentUser } from '../lib/queries'
import Shell from '../components/Shell'
import BottomNav from '../components/BottomNav'
import StatsCards from '../components/StatsCards'
import HeroIllustration from '../components/HeroIllustration'

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

export default function Dashboard() {
  const { data: groups = [], isLoading, isError } = useGroups()
  const { data: user } = useCurrentUser()

  const { data: pendingCount = 0 } = useQuery({
    queryKey: ['pendingPlansCount'],
    queryFn: async () => {
      const { data: groupIds } = await supabase
        .from('group_members').select('group_id').eq('user_id', user!.id)
      if (!groupIds || groupIds.length === 0) return 0
      const ids = groupIds.map((g: any) => g.group_id)
      const { count } = await supabase
        .from('plans').select('*', { count: 'exact', head: true })
        .in('group_id', ids)
        .gte('scheduled_at', new Date().toISOString())
      return count || 0
    },
    enabled: !!user,
    staleTime: 30000,
  })

  const { data: friendsCount = 0 } = useQuery({
    queryKey: ['friendsCount'],
    queryFn: async () => {
      const { data: groupIds } = await supabase
        .from('group_members').select('group_id').eq('user_id', user!.id)
      if (!groupIds || groupIds.length === 0) return 0
      const ids = groupIds.map((g: any) => g.group_id)
      const { data: members } = await supabase
        .from('group_members').select('user_id').in('group_id', ids).neq('user_id', user!.id)
      if (!members) return 0
      return new Set(members.map((m: any) => m.user_id)).size
    },
    enabled: !!user,
    staleTime: 30000,
  })

  return (
    <Shell>
      <div className="hero-section">
        <div className="hero-copy">
          <p className="eyebrow">TUS PLANES</p>
          <h1>¿Qué hacemos<br />esta vez?</h1>
          <p>Decidan sin el eterno "¿qué quieren hacer?".</p>
        </div>
        <HeroIllustration />
      </div>

      <StatsCards groups={groups.length} pending={pendingCount} friends={friendsCount} />

      <div className="btn-row">
        <Link className="primary-action" to="/groups/new">+ Crear grupo</Link>
        <Link className="primary-action btn-outline" to="/join">Unirse</Link>
      </div>

      <section className="section-heading">
        <div>
          <p className="eyebrow">TUS GRUPOS</p>
          <h2>Donde ocurre el plan</h2>
        </div>
      </section>

      {isLoading && <p className="empty-state">Cargando tus grupos…</p>}
      {isError && <p className="empty-state">No pudimos cargar los grupos. Reinténtalo en un momento.</p>}
      {!isLoading && !isError && groups.length === 0 && (
        <div className="empty-state">
          <strong>Aún no tienes grupos.</strong>
          <span>Crea uno para empezar a decidir planes.</span>
        </div>
      )}
      <div className="group-list">
        {groups.map((group) => (
          <Link className="group-card" to={`/groups/${group.id}`} key={group.id}>
            <span className="group-icon">{initials(group.name)}</span>
            <div className="group-card-body">
              <strong>{group.name}</strong>
              <small>Abre el grupo para crear su primer plan</small>
            </div>
            <span className="group-card-arrow">›</span>
          </Link>
        ))}
      </div>

      <BottomNav active="home" />
    </Shell>
  )
}
