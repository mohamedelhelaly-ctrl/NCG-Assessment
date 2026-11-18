import { Route, Routes } from 'react-router'
import { GuestOnly, RequireAdmin } from './components/auth/guards'
import Layout from './components/layout/Layout'
import AdminHomePage from './pages/AdminHomePage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import StatusPage from './pages/StatusPage'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<StatusPage />} />
        <Route element={<GuestOnly />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>
        <Route element={<RequireAdmin />}>
          <Route path="/admin" element={<AdminHomePage />} />
        </Route>
      </Route>
    </Routes>
  )
}
