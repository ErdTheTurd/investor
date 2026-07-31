import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppProvider, useApp } from './context/AppContext'
import { Landing } from './pages/Landing'

const Onboarding = lazy(() => import('./pages/Onboarding').then((m) => ({ default: m.Onboarding })))
const AppLayout = lazy(() => import('./components/AppLayout').then((m) => ({ default: m.AppLayout })))
const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })))
const Invest = lazy(() => import('./pages/Invest').then((m) => ({ default: m.Invest })))
const Agent = lazy(() => import('./pages/Agent').then((m) => ({ default: m.Agent })))
const Goals = lazy(() => import('./pages/Goals').then((m) => ({ default: m.Goals })))
const Learn = lazy(() => import('./pages/Learn').then((m) => ({ default: m.Learn })))

function RouteFallback() {
  return (
    <div className="route-fallback" role="status" aria-live="polite">
      <div className="route-fallback-bar" aria-hidden />
      <p>Loading…</p>
    </div>
  )
}

function Protected({ children }: { children: React.ReactNode }) {
  const { state } = useApp()
  if (!state.profile.onboardingComplete) return <Navigate to="/onboarding" replace />
  return children
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route
              path="/app"
              element={
                <Protected>
                  <AppLayout />
                </Protected>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="invest" element={<Invest />} />
              <Route path="agent" element={<Agent />} />
              <Route path="goals" element={<Goals />} />
              <Route path="learn" element={<Learn />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AppProvider>
  )
}
