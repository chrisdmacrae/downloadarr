import { Routes, Route } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import Layout from '@/components/Layout'
import OnboardingGuard from '@/components/OnboardingGuard'
import Dashboard from '@/pages/Dashboard'
import Downloads from '@/pages/Downloads'
import Requests from '@/pages/Requests'
import Search from '@/pages/Search'
import MoviesDiscovery from '@/pages/MoviesDiscovery'
import TvShowsDiscovery from '@/pages/TvShowsDiscovery'
import GamesDiscovery from '@/pages/GamesDiscovery'
import Settings from '@/pages/Settings'
import OrganizationRules from '@/pages/OrganizationRules'
import Onboarding from '@/pages/Onboarding'

function App() {
  return (
    <div className="min-h-screen bg-background">
      <OnboardingGuard>
        <Routes>
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/*" element={
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
                <Route path="/organization" element={<OrganizationRules />} />
              </Routes>
            </Layout>
          } />
        </Routes>
      </OnboardingGuard>
      <Toaster />
    </div>
  )
}

export default App
