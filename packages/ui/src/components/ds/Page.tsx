import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * Content runs edge to edge — there is no content max width. Pages use the
 * same 32px gutter as the top bar (12px on small screens) so grids and rails
 * line up with the hero and the nav.
 */
export function Page({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-section pb-16', className)} {...props} />
}

/** A page body region that sits inside the gutter. */
export function PageSection({
  className,
  bleedRails = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { bleedRails?: boolean }) {
  return (
    <div
      className={cn('flex flex-col gap-section px-gutter', className)}
      // Rails bleed into the gutter so hover-expanded edge cards aren't clipped.
      style={bleedRails ? ({ ['--rail-bleed' as string]: 'var(--page-pad-x)' }) : undefined}
      {...props}
    />
  )
}

interface PageHeaderProps {
  eyebrow?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}

export function PageHeader({ eyebrow, title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-4', className)}>
      <div className="flex min-w-0 flex-col gap-1.5">
        {eyebrow && (
          <span className="font-condensed text-2xs font-bold uppercase leading-none tracking-eyebrow text-brand-500">
            {eyebrow}
          </span>
        )}
        <h1 className="text-3xl font-bold leading-tight tracking-tight text-fg-primary">{title}</h1>
        {description && <p className="text-sm text-fg-secondary">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

/** One line, and an offer of the next action. */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-card border border-hairline bg-surface-card px-6 py-14 text-center',
        className
      )}
    >
      {icon && <span className="text-fg-muted [&_svg]:h-8 [&_svg]:w-8">{icon}</span>}
      <p className="text-base font-semibold text-fg-primary">{title}</p>
      {description && <p className="max-w-[46ch] text-sm text-fg-secondary text-pretty">{description}</p>}
      {action}
    </div>
  )
}
