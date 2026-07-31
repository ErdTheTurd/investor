import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useApp } from '../context/AppContext'

const links = [
  { to: '/app', label: 'Home', end: true },
  { to: '/app/invest', label: 'Invest' },
  { to: '/app/agent', label: 'AI Agent' },
  { to: '/app/goals', label: 'Goals' },
  { to: '/app/learn', label: 'Learn' },
]

export function AppLayout() {
  const { state } = useApp()
  const location = useLocation()
  const showBottom = location.pathname.startsWith('/app')

  return (
    <div className={`app-shell ${showBottom ? 'has-bottom' : ''}`}>
      <header className="nav">
        <div className="container nav-inner">
          <NavLink to="/app" className="brand">
            Dunn <span>Investing</span>
            <em>?</em>
          </NavLink>
          <nav className="nav-links" aria-label="Primary">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => (isActive ? 'active' : '')}>
                {l.label}
              </NavLink>
            ))}
          </nav>
          <div className="chip">
            <span className="pulse-dot" aria-hidden />
            {state.profile.streakDays} day streak
          </div>
        </div>
      </header>
      <main className="container">
        <Outlet />
      </main>
      <nav className="bottom-nav" aria-label="Mobile">
        {links.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => (isActive ? 'active' : '')}>
            {l.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
