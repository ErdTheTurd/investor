import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useApp } from '../context/AppContext'

const links = [
  { to: '/app', label: 'Home', end: true },
  { to: '/app/invest', label: 'Invest' },
  { to: '/app/markets', label: 'Markets' },
  { to: '/app/agent', label: 'AI Agent' },
  { to: '/app/goals', label: 'Goals' },
  { to: '/app/learn', label: 'Learn' },
]

export function AppLayout() {
  const { state, marketSimulated, marketAsOfLabel, loadingMarket } = useApp()
  const location = useLocation()
  const showBottom = location.pathname.startsWith('/app')

  return (
    <div className={`app-shell ${showBottom ? 'has-bottom' : ''}`}>
      <header className="nav">
        <div className="container nav-inner">
          <NavLink to="/app" className="brand">
            Dunn <span>Investing<em>?</em></span>
          </NavLink>
          <nav className="nav-links" aria-label="Primary">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => (isActive ? 'active' : '')}>
                {l.label}
              </NavLink>
            ))}
          </nav>
          <div className="nav-meta">
            <div
              className={`chip ${marketSimulated ? 'chip-warn' : 'chip-ok'}`}
              title={marketSimulated ? 'Using simulated fallback prices' : `Quotes as of ${marketAsOfLabel}`}
            >
              <span className="pulse-dot" aria-hidden />
              {loadingMarket
                ? 'Refreshing…'
                : marketSimulated
                  ? 'Simulated data'
                  : `As of ${marketAsOfLabel}`}
            </div>
            <div className="chip">
              <span className="pulse-dot" aria-hidden />
              {state.profile.streakDays} day streak
            </div>
          </div>
        </div>
      </header>
      <main className="container">
        <Outlet />
      </main>
      <footer className="app-footer">
        <p className="footer-note container">
          Educational paper-trading demo. Not a registered broker-dealer or investment adviser.
        </p>
      </footer>
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
