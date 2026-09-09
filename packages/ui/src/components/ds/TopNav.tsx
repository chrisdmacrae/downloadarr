import * as React from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  Download,
  Film,
  Gamepad2,
  Home,
  Link as LinkIcon,
  List,
  Search,
  Settings as SettingsIcon,
  Sparkles,
  ShieldCheck,
  ShieldOff,
  Tv,
  type LucideIcon,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAria2Stats, useVpnStatus } from '@/hooks/useApi'
import { formatSpeed } from '@/lib/status'

interface NavItem {
  name: string
  href: string
  icon: LucideIcon
}

/** Destinations, in order, with a divider before the management group. */
const DISCOVERY: NavItem[] = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Search', href: '/search', icon: Search },
  { name: 'Movies', href: '/movies', icon: Film },
  { name: 'TV shows', href: '/tv-shows', icon: Tv },
  { name: 'Anime', href: '/anime', icon: Sparkles },
  { name: 'Games', href: '/games', icon: Gamepad2 },
]

const MANAGEMENT: NavItem[] = [
  { name: 'Requests', href: '/requests', icon: List },
  { name: 'Downloads', href: '/downloads', icon: Download },
]

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('flex shrink-0 items-center gap-2.5', className)}>
      <span className="flex h-[26px] w-[26px] items-center justify-center rounded-md bg-brand-500 font-condensed text-[15px] font-extrabold text-fg-accent">
        D
      </span>
      <span className="whitespace-nowrap font-condensed text-lg font-extrabold uppercase tracking-tight text-fg-primary">
        Download<b className="font-[inherit] text-brand-500">arr</b>
      </span>
    </span>
  )
}

function NavLink({ item }: { item: NavItem }) {
  const location = useLocation()
  const isActive =
    item.href === '/' ? location.pathname === '/' : location.pathname.startsWith(item.href)
  const Icon = item.icon

  return (
    <Link
      to={item.href}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'relative inline-flex h-9 items-center gap-[7px] whitespace-nowrap rounded-pill px-3 text-sm font-medium transition-[background-color,color] duration-fast ease-standard',
        'focus-visible:outline-none focus-visible:shadow-focus',
        isActive
          ? 'bg-[color:var(--accent-quiet)] font-semibold text-fg-primary'
          : 'text-fg-secondary hover:bg-surface-input hover:text-fg-primary'
      )}
    >
      <Icon className={cn('h-4 w-4', isActive && 'text-brand-500')} />
      {item.name}
    </Link>
  )
}

interface TopNavProps {
  /** Second row for context filters — genre pills on discovery screens. */
  subnav?: React.ReactNode
  /** Opens the existing HTTP download modal. */
  onAddUrl?: () => void
}

/**
 * A 64px sticky glass bar; artwork runs full width beneath it. Below 1600px
 * the bar wraps so nav links get their own full-width row and the speed pill
 * hides; below 1040px both status pills hide. (The spec set the wrap at
 * 1240px for five destinations; a sixth no longer fits beside the right
 * cluster, and wrapping beats scrolling links out of reach.)
 */
export function TopNav({ subnav, onAddUrl }: TopNavProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [query, setQuery] = React.useState('')

  const { data: vpnStatus } = useVpnStatus()
  const { data: aria2Stats } = useAria2Stats()

  const speed = aria2Stats ? formatSpeed(parseInt(aria2Stats.downloadSpeed, 10)) : null
  const vpnOn = vpnStatus?.enabled && vpnStatus?.connected
  const settingsActive = location.pathname.startsWith('/settings') || location.pathname === '/organization'

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = query.trim()
    if (!trimmed) return
    navigate(`/search?q=${encodeURIComponent(trimmed)}`)
  }

  return (
    <header className="sticky top-0 z-30 flex flex-col border-b border-hairline glass">
      <div className="flex h-topbar items-center gap-[22px] px-gutter max-[1600px]:h-auto max-[1600px]:flex-wrap max-[1600px]:gap-3 max-[1600px]:py-2.5">
        <Link to="/" className="rounded-sm focus-visible:outline-none focus-visible:shadow-focus">
          <Wordmark />
        </Link>

        <nav
          aria-label="Primary"
          className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto scrollbar-hide max-[1600px]:order-3 max-[1600px]:w-full max-[1600px]:flex-[1_0_100%]"
        >
          {DISCOVERY.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
          <span aria-hidden className="mx-1.5 h-[22px] w-px shrink-0 bg-[color:var(--border-hairline)]" />
          {MANAGEMENT.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
        </nav>

        <div className="flex min-w-0 shrink items-center gap-2.5">
          <form onSubmit={submitSearch} className="w-[260px] min-w-[120px] shrink max-[1040px]:w-[180px]">
            <label className="sr-only" htmlFor="global-search">
              Search
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-muted" />
              <Input
                id="global-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search everything"
                className="h-9 pl-9 text-sm"
              />
            </div>
          </form>

          {/* Live status pills. */}
          <span
            className={cn(
              'inline-flex h-[30px] shrink-0 items-center gap-[7px] rounded-pill px-2.5 font-mono text-xs font-medium max-[1040px]:hidden',
              vpnOn ? 'bg-white/[.08] text-fg-body' : 'bg-white/[.05] text-fg-muted'
            )}
            title={vpnStatus?.message || (vpnStatus?.enabled ? 'VPN' : 'VPN disabled')}
          >
            {vpnOn ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldOff className="h-3.5 w-3.5" />}
            {vpnStatus?.enabled ? (vpnStatus.connected ? 'VPN on' : 'VPN off') : 'No VPN'}
          </span>

          <span className="inline-flex h-[30px] shrink-0 items-center gap-[7px] rounded-pill bg-white/[.05] px-2.5 font-mono text-xs font-medium text-fg-body max-[1600px]:hidden">
            <Download className="h-3.5 w-3.5 text-fg-muted" />
            {speed ?? '—'}
          </span>

          {onAddUrl && (
            <Button variant="secondary" size="sm" className="shrink-0" onClick={onAddUrl}>
              <LinkIcon className="h-3.5 w-3.5" />
              <span className="max-[1040px]:sr-only">Add via URL</span>
            </Button>
          )}

          <Link
            to="/settings"
            aria-label="Settings"
            aria-current={settingsActive ? 'page' : undefined}
            className={cn(
              'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-control transition-colors duration-fast ease-standard',
              'focus-visible:outline-none focus-visible:shadow-focus',
              settingsActive
                ? 'bg-[color:var(--accent-quiet)] text-brand-500'
                : 'text-fg-secondary hover:bg-surface-input hover:text-fg-primary'
            )}
          >
            <SettingsIcon className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {subnav && (
        <div className="flex items-center gap-2 overflow-x-auto px-gutter pb-3 scrollbar-hide">{subnav}</div>
      )}
    </header>
  )
}

/** Context-filter pill for the top nav's optional second row. */
export function NavPill({
  active,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-pill px-3 text-xs font-semibold uppercase tracking-wide transition-colors duration-fast ease-standard',
        'focus-visible:outline-none focus-visible:shadow-focus',
        active
          ? 'bg-brand-500 text-fg-accent'
          : 'bg-surface-input text-fg-secondary hover:bg-surface-input-hover hover:text-fg-primary'
      )}
      {...props}
    >
      {children}
    </button>
  )
}
