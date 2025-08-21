import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { IssueReportFab } from '@/components/IssueReportFab'
import { UpdateCard } from '@/components/UpdateCard'
import {
  Download,
  Search,
  Settings,
  Home,
  Activity,
  Film,
  Tv,
  Gamepad2,
  List,
  FolderTree
} from 'lucide-react'

const navigation = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Requests', href: '/requests', icon: List },
  { name: 'Downloads', href: '/downloads', icon: Download },
]

const findNavigation = [
  { name: 'Search', href: '/search', icon: Search },
  { name: 'Movies', href: '/movies', icon: Film },
  { name: 'TV Shows', href: '/tv-shows', icon: Tv },
  { name: 'Games', href: '/games', icon: Gamepad2 },
]

const settingsNavigation = [
  { name: 'Settings', href: '/settings', icon: Settings },
  { name: 'Organization', href: '/organization', icon: FolderTree },
]

interface LayoutProps {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation()

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className="flex flex-col w-16 md:w-64 bg-card border-r">
        <div className="flex items-center h-16 px-6 border-b">
          <Activity className="w-8 h-8 text-primary" />
          <span className="ml-2 text-xl font-bold hidden md:block">Downloadarr</span>
        </div>
        
        <nav className="flex-1 flex flex-col px-2 md:px-4 py-6">
          <div className="space-y-6">
            {/* Main Navigation */}
            <div className="space-y-2">
              {navigation.map((item) => {
                const Icon = item.icon
                const isActive = location.pathname === item.href

                return (
                  <Link key={item.name} to={item.href}>
                    <Button
                      variant={isActive ? "default" : "ghost"}
                      className={cn(
                        "w-full justify-center md:justify-start",
                        isActive && "bg-primary text-primary-foreground"
                      )}
                    >
                      <Icon className="w-4 h-4 md:mr-2" />
                      <span className="hidden md:inline">{item.name}</span>
                    </Button>
                  </Link>
                )
              })}
            </div>

            {/* Find Section */}
            <div className="space-y-2">
              <h3 className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 hidden md:block">
                Find
              </h3>
              {findNavigation.map((item) => {
                const Icon = item.icon
                const isActive = location.pathname === item.href

                return (
                  <Link key={item.name} to={item.href}>
                    <Button
                      variant={isActive ? "default" : "ghost"}
                      className={cn(
                        "w-full justify-center md:justify-start",
                        isActive && "bg-primary text-primary-foreground"
                      )}
                    >
                      <Icon className="w-4 h-4 md:mr-2" />
                      <span className="hidden md:inline">{item.name}</span>
                    </Button>
                  </Link>
                )
              })}
            </div>
          </div>

          {/* Update Card above settings */}
          <div className="mt-auto space-y-3">
            <div className="px-2">
              <UpdateCard />
            </div>

            {/* Settings */}
            <div className="space-y-2">
              {settingsNavigation.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.href

              return (
                <Link key={item.name} to={item.href}>
                  <Button
                    variant={isActive ? "default" : "ghost"}
                    className={cn(
                      "w-full justify-center md:justify-start",
                      isActive && "bg-primary text-primary-foreground"
                    )}
                  >
                    <Icon className="w-4 h-4 md:mr-2" />
                    <span className="hidden md:inline">{item.name}</span>
                  </Button>
                </Link>
              )
            })}
            </div>
          </div>
        </nav>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-auto p-3 md:p-6">
          {children}
        </main>
      </div>

      {/* Floating Action Button for Issue Reporting */}
      <IssueReportFab />
    </div>
  )
}
