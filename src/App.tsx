import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppProvider, useApp } from './context/AppContext'
import { AppLayout } from './components/AppLayout'
import { Landing } from './pages/Landing'
import { Onboarding } from './pages/Onboarding'
import { Dashboard } from './pages/Dashboard'
import { Invest } from './pages/Invest'
import { Agent } from './pages/Agent'
import { Goals } from './pages/Goals'
import { Learn } from './pages/Learn'

function Protected({ children }: { children: React.ReactNode }) {
  const { state } = useApp()
  if (!state.profile.onboardingComplete) return <Navigate to="/onboarding" replace />
  return children
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
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
      </BrowserRouter>
    </AppProvider>
  )
}
