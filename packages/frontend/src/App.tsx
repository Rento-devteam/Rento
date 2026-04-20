import { useMemo, useState } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { AppHeader } from './components/AppHeader'
import { AuthModal, type AuthTab } from './components/AuthModal'
import { ConfirmEmailPage } from './pages/ConfirmEmailPage'
import { HomePage } from './pages/HomePage'

const AUTH_ROUTE_TO_TAB: Record<string, AuthTab> = {
  '/login': 'login',
  '/register': 'register',
  '/login/telegram': 'telegram',
}

function AppLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const [manualTab, setManualTab] = useState<AuthTab | null>(null)

  const routeTab = AUTH_ROUTE_TO_TAB[location.pathname] ?? null
  const activeTab: AuthTab | null = manualTab ?? routeTab

  const hideChrome = location.pathname === '/confirm-email'

  const openAuth = (tab: AuthTab) => {
    setManualTab(tab)
  }

  const closeAuth = () => {
    setManualTab(null)
    if (routeTab) {
      navigate('/', { replace: true })
    }
  }

  const isModalOpen = useMemo(() => activeTab != null, [activeTab])

  return (
    <div className="shell">
      {!hideChrome ? <AppHeader onAuthRequest={openAuth} /> : null}
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<HomePage />} />
        <Route path="/register" element={<HomePage />} />
        <Route path="/login/telegram" element={<HomePage />} />
        <Route path="/confirm-email" element={<ConfirmEmailPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {isModalOpen && activeTab ? (
        <AuthModal initialTab={activeTab} onClose={closeAuth} onTabChange={setManualTab} />
      ) : null}
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppLayout />
    </AuthProvider>
  )
}
