import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import GuestList from './pages/GuestList'
import NewGuest from './pages/NewGuest'
import GuestDetails from './pages/GuestDetails'
import Rooms from './pages/Rooms'
import ReservationForecast from './pages/ReservationForecast'

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/guests" element={<GuestList />} />
          <Route path="/guests/new" element={<NewGuest />} />
          {/* Make sure this route matches what you're navigating to */}
          <Route path="/guests/:id" element={<GuestDetails />} />
          <Route path="/rooms" element={<Rooms />} />
          <Route path="/forecast" element={<ReservationForecast />} />
          {/* Add a catch-all route for debugging */}
          <Route path="*" element={<div>404 - Page not found</div>} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}

export default App