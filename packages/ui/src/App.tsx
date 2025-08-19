import { Routes, Route } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import Layout from '@/components/Layout'
import Dashboard from '@/pages/Dashboard'
import Downloads from '@/pages/Downloads'
import Requests from '@/pages/Requests'
import Search from '@/pages/Search'
import MoviesDiscovery from '@/pages/MoviesDiscovery'
import TvShowsDiscovery from '@/pages/TvShowsDiscovery'
import GamesDiscovery from '@/pages/GamesDiscovery'
import Settings from '@/pages/Settings'

function App() {
  return (
    <div className="min-h-screen bg-background">
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/downloads" element={<Downloads />} />
          <Route path="/requests" element={<Requests />} />
          <Route path="/search" element={<Search />} />
          <Route path="/movies" element={<MoviesDiscovery />} />
          <Route path="/tv-shows" element={<TvShowsDiscovery />} />
          <Route path="/games" element={<GamesDiscovery />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Layout>
      <Toaster />
    </div>
  )
}

export default App
