import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import GuestList from './pages/GuestList'
import NewGuest from './pages/NewGuest'
import GuestDetails from './pages/GuestDetails'

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/guests" element={<GuestList />} />
          <Route path="/guests/new" element={<NewGuest />} />
          <Route path="/guests/:id" element={<GuestDetails />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}

export default App
