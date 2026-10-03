import { Link } from 'react-router-dom'
import { Home, Plus, Users, User } from 'lucide-react'

type Props = { active: 'home' | 'create' | 'join' | 'profile' }

export default function BottomNav({ active }: Props) {
  const links = [
    { to: '/', label: 'Inicio', icon: Home, key: 'home' },
    { to: '/groups/new', label: 'Crear', icon: Plus, key: 'create' },
    { to: '/join', label: 'Unirse', icon: Users, key: 'join' },
    { to: '/profile', label: 'Perfil', icon: User, key: 'profile' },
  ] as const

  return (
    <nav className="bottom-nav">
      {links.map(({ to, label, icon: Icon, key }) => (
        <Link key={key} to={to} className={active === key ? 'nav-item active' : 'nav-item'}>
          <Icon size={20} />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  )
}
