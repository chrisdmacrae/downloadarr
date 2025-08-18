import { Routes, Route } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import Layout from '@/components/Layout'
import Dashboard from '@/pages/Dashboard'
import Downloads from '@/pages/Downloads'
import Search from '@/pages/Search'
import Settings from '@/pages/Settings'

function App() {
  return (
    <div className="min-h-screen bg-background">
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/downloads" element={<Downloads />} />
          <Route path="/search" element={<Search />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Layout>
      <Toaster />
    </div>
  )
}

export default App
