import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import Layout from '@/components/Layout'
import OnboardingGuard from '@/components/OnboardingGuard'
import Dashboard from '@/pages/Dashboard'
import Downloads from '@/pages/Downloads'
import Requests from '@/pages/Requests'
import Search from '@/pages/Search'
import MoviesDiscovery from '@/pages/MoviesDiscovery'
import TvShowsDiscovery from '@/pages/TvShowsDiscovery'
import Browse from '@/pages/Browse'
import AnimeDiscovery from '@/pages/AnimeDiscovery'
import GamesDiscovery from '@/pages/GamesDiscovery'
import MusicDiscovery from '@/pages/MusicDiscovery'
import Settings from '@/pages/Settings'
import Onboarding from '@/pages/Onboarding'
import { ProfileProvider } from '@/contexts/ProfileContext'

function App() {
  return (
    <div className="min-h-screen bg-surface-app">
      <OnboardingGuard>
        <Routes>
          <Route path="/onboarding" element={<Onboarding />} />
          <Route
            path="/*"
            element={
              <ProfileProvider>
                <Layout>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/downloads" element={<Downloads />} />
                    <Route path="/requests" element={<Requests />} />
                    <Route path="/search" element={<Search />} />
                    <Route path="/movies" element={<MoviesDiscovery />} />
                    <Route path="/movies/browse" element={<Browse kind="movie" />} />
                    <Route path="/tv-shows" element={<TvShowsDiscovery />} />
                    <Route path="/tv-shows/browse" element={<Browse kind="tv" />} />
                    <Route path="/anime" element={<AnimeDiscovery />} />
                    <Route path="/games" element={<GamesDiscovery />} />
                    <Route path="/games/browse" element={<Browse kind="game" />} />
                    <Route path="/music" element={<MusicDiscovery />} />
                    {/* Organization lives inside Settings now; the old route
                        still resolves so existing links and the queue badge
                        keep working. */}
                    <Route
                      path="/organization"
                      element={<Navigate to="/settings/organization" replace />}
                    />
                    {/* Settings › Music became Settings › Recommendations. */}
                    <Route
                      path="/settings/music"
                      element={<Navigate to="/settings/recommendations" replace />}
                    />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/settings/:section" element={<Settings />} />
                  </Routes>
                </Layout>
              </ProfileProvider>
            }
          />
        </Routes>
      </OnboardingGuard>
      <Toaster />
    </div>
  )
}

export default App
