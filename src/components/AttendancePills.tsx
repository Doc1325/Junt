type User = { user_id: string; profiles?: { id: string; full_name: string | null } | null }

function initials(name: string | null | undefined) {
  if (!name) return '?'
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

type Props = {
  going: User[]
  maybe: User[]
  notGoing: User[]
  pending: User[]
}

function PillGroup({ label, users, color }: { label: string; users: User[]; color: 'green' | 'amber' | 'red' | 'muted' }) {
  if (users.length === 0) return null
  const colorClass = 'pill-group-' + color
  return (
    <div className="pill-group">
      <p className={'pill-group-label ' + colorClass}>{label} ({users.length})</p>
      <div className="pill-row">
        {users.map((u) => (
          <div key={u.user_id} className={'pill ' + colorClass}>
            <span className="pill-avatar">{initials(u.profiles?.full_name)}</span>
            <span>{u.profiles?.full_name || 'Sin nombre'}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function AttendancePills({ going, maybe, notGoing, pending }: Props) {
  return (
    <div className="attendance-pills">
      <PillGroup label="Van" users={going} color="green" />
      <PillGroup label="Tal vez" users={maybe} color="amber" />
      <PillGroup label="No van" users={notGoing} color="red" />
      <PillGroup label="Sin responder" users={pending} color="muted" />
    </div>
  )
}
