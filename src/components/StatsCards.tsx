import { Users, CalendarClock, HeartHandshake } from 'lucide-react'

type Props = {
  groups: number
  pending: number
  friends: number
}

export default function StatsCards({ groups, pending, friends }: Props) {
  return (
    <div className="stats-row">
      <div className="stat-card">
        <Users size={18} className="stat-icon" />
        <span className="stat-num">{groups}</span>
        <span className="stat-label">Grupos</span>
      </div>
      <div className="stat-card">
        <CalendarClock size={18} className="stat-icon" />
        <span className="stat-num">{pending}</span>
        <span className="stat-label">Pendientes</span>
      </div>
      <div className="stat-card">
        <HeartHandshake size={18} className="stat-icon" />
        <span className="stat-num">{friends}</span>
        <span className="stat-label">Amigos</span>
      </div>
    </div>
  )
}
