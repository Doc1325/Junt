import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useProfile } from '../lib/queries'

function initials(name: string | null | undefined) {
  if (!name) return '?'
  return name.split(' ').filter(Boolean).slice(0, 2).map((word) => word[0]).join('').toUpperCase()
}

export default function Shell({ children }: { children: ReactNode }) {
  const { data: profile } = useProfile()

  return (
    <main className="app-shell">
      <header>
        <Link className="brand" to="/">junt<span>·</span></Link>
        <Link to="/profile" className="avatar" aria-label="Tu perfil">
          {initials(profile?.full_name)}
        </Link>
      </header>
      {children}
    </main>
  )
}