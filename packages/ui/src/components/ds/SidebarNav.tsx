import * as React from 'react'
import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Wordmark } from '@/components/ds/TopNav'

export interface SidebarItem {
  id: string
  label: string
  icon: LucideIcon
  /** Rendered as a red count pill on the right of the item. */
  count?: number
}

export interface SidebarGroup {
  label?: string
  items: SidebarItem[]
}

interface SidebarNavProps {
  groups: SidebarGroup[]
  active?: string
  onNavigate?: (id: string) => void
  /**
   * `bare` drops the brand block and the rail fill — the variant Settings uses
   * as its section sub-navigation. The filled rail is retained for narrow
   * admin views.
   */
  bare?: boolean
  collapsed?: boolean
  footer?: React.ReactNode
  className?: string
  'aria-label'?: string
}

export function SidebarNav({
  groups,
  active,
  onNavigate,
  bare = false,
  collapsed = false,
  footer,
  className,
  'aria-label': ariaLabel,
}: SidebarNavProps) {
  return (
    <nav
      aria-label={ariaLabel}
      className={cn(
        'flex flex-col',
        bare
          ? 'h-auto w-full'
          : 'h-full w-[var(--sidebar-w)] shrink-0 border-r border-hairline bg-surface-1',
        !bare && collapsed && 'w-[var(--sidebar-w-collapsed)]',
        className
      )}
    >
      {!bare && (
        <div className="flex h-topbar shrink-0 items-center border-b border-hairline px-[18px]">
          {collapsed ? (
            <span className="flex h-[26px] w-[26px] items-center justify-center rounded-md bg-brand-500 font-condensed text-[15px] font-extrabold text-fg-accent">
              D
            </span>
          ) : (
            <Wordmark />
          )}
        </div>
      )}

      <div
        className={cn(
          'flex flex-1 flex-col gap-5',
          bare ? 'overflow-visible' : 'overflow-y-auto px-2.5 py-4'
        )}
      >
        {groups.map((group, groupIndex) => (
          <div key={group.label ?? groupIndex} className="flex flex-col gap-0.5">
            {group.label && !collapsed && (
              <span className="px-2.5 pb-2 font-condensed text-2xs font-bold uppercase leading-none tracking-eyebrow text-fg-muted">
                {group.label}
              </span>
            )}
            {group.items.map((item) => {
              const Icon = item.icon
              const isActive = item.id === active
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate?.(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'relative flex h-[38px] w-full items-center gap-2.5 rounded-control px-2.5 text-left text-sm font-medium transition-[background-color,color] duration-fast ease-standard',
                    'focus-visible:outline-none focus-visible:shadow-focus',
                    collapsed && 'justify-center',
                    isActive
                      ? 'bg-[color:var(--accent-quiet)] font-semibold text-fg-primary before:absolute before:inset-y-[9px] before:left-0 before:w-0.5 before:rounded-pill before:bg-brand-500 before:content-[""]'
                      : 'text-fg-secondary hover:bg-surface-input hover:text-fg-primary'
                  )}
                >
                  <Icon className={cn('h-4 w-4 shrink-0', isActive && 'text-brand-500')} />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                  {!collapsed && !!item.count && (
                    <span className="ml-auto inline-flex h-5 min-w-[20px] items-center justify-center rounded-pill bg-brand-500 px-1.5 font-mono text-[10px] font-bold text-fg-accent">
                      {item.count}
                    </span>
                  )}
                  {collapsed && !!item.count && (
                    <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-pill bg-brand-500" />
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </div>

      {footer && (
        <div className={cn('shrink-0', bare ? 'pt-3.5' : 'border-t border-hairline p-2.5')}>{footer}</div>
      )}
    </nav>
  )
}
