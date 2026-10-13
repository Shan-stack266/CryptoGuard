import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import { TelemetryProvider } from './context/TelemetryContext.jsx'
import { SecurityProvider } from './context/SecurityContext.jsx'
import Navbar from './components/layout/Navbar.jsx'
import Footer from './components/layout/Footer.jsx'
import LandingPage from './views/LandingPage.jsx'
import Dashboard from './dashboard/Dashboard.jsx'
function Workspace() {
  const auth = useAuth()
  if (auth.loading) return <main className="view-stage"><p role="status">Checking session...</p></main>
  return <SecurityProvider><TelemetryProvider>{auth.user ? <Dashboard onLogout={auth.logout} /> : <div className="app-shell"><Navbar onNavigate={() => {}} /><div className="workspace"><main className="view-stage">{auth.error && <p role="alert" className="strict-note">{auth.error}</p>}<LandingPage /></main></div><Footer /></div>}</TelemetryProvider></SecurityProvider>
}
export default function App() { return <AuthProvider><Workspace /></AuthProvider> }
