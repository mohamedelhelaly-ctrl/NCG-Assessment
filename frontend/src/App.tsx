import { Route, Routes } from 'react-router'
import StatusPage from './pages/StatusPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<StatusPage />} />
    </Routes>
  )
}
