import { useMemo, useState } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { AppHeader } from './components/AppHeader'
import { AuthModal, type AuthTab } from './components/AuthModal'
import { ConfirmEmailPage } from './pages/ConfirmEmailPage'
import { CreateItemPage } from './pages/CreateItemPage'
import { HomePage } from './pages/HomePage'
import { ListingDetailsPage } from './pages/ListingDetailsPage'
import { ManageCalendarPage } from './pages/ManageCalendarPage'
import { ProfilePage } from './pages/ProfilePage'
import { RenterBookingsPage } from './pages/RenterBookingsPage'
import { LandlordBookingsPage } from './pages/LandlordBookingsPage'
import { BookingDetailPage } from './pages/BookingDetailPage'

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
      <div className="shell__content">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<HomePage />} />
          <Route path="/register" element={<HomePage />} />
          <Route path="/login/telegram" element={<HomePage />} />
          <Route path="/confirm-email" element={<ConfirmEmailPage />} />
          <Route path="/create-item" element={<CreateItemPage />} />
          <Route path="/listings/:id/edit" element={<CreateItemPage />} />
          <Route path="/listings/:id/calendar" element={<ManageCalendarPage />} />
          <Route path="/listings/:id" element={<ListingDetailsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/bookings/hosting" element={<LandlordBookingsPage />} />
          <Route path="/bookings/:bookingId" element={<BookingDetailPage />} />
          <Route path="/bookings" element={<RenterBookingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      {isModalOpen && activeTab ? (
        <AuthModal
          key={activeTab}
          initialTab={activeTab}
          onClose={closeAuth}
          onTabChange={setManualTab}
        />
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
