import { AuthProvider } from './context/AuthContext'
import { AppViewProvider } from './context/AppViewContext'
import RequireAuth from './components/auth/RequireAuth'
import PrivacyBanner from './components/layout/PrivacyBanner'
import Header from './components/layout/Header'
import NavBar from './components/layout/NavBar'
import ContentArea from './components/layout/ContentArea'

export default function App() {
  return (
    <AuthProvider>
      <RequireAuth>
        <AppViewProvider>
          <div className="flex min-h-screen flex-col bg-slate-50 font-sans">
            <PrivacyBanner />
            <Header />
            <NavBar />
            <ContentArea />
          </div>
        </AppViewProvider>
      </RequireAuth>
    </AuthProvider>
  )
}
