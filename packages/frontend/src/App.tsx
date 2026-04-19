import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { AppHeader } from './components/AppHeader'
import { ConfirmEmailPage } from './pages/ConfirmEmailPage'
import { HomePage } from './pages/HomePage'

const AUTH_PATHS = new Set(['/confirm-email'])

function AppLayout() {
  const location = useLocation()
  const hideChrome = AUTH_PATHS.has(location.pathname)

  return (
    <div className="rento-app">
      {!hideChrome ? <AppHeader /> : null}
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<HomePage initialAuthMode="login" />} />
        <Route path="/register" element={<HomePage initialAuthMode="register" />} />
        <Route path="/confirm-email" element={<ConfirmEmailPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
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
