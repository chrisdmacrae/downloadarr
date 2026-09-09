import * as React from 'react'

import { cn } from '@/lib/utils'

interface MediaCardProps {
  title: string
  /** Dot-separated facts under the title, on the artwork. */
  meta?: React.ReactNode[]
  /** Filename / torrent title — rendered in mono under the artwork. */
  subtitle?: string
  backdrop?: string
  /** Status pill, top-left. */
  status?: React.ReactNode
  /** Content-type badge, top-right. */
  typeBadge?: React.ReactNode
  /** Progress hairline across the artwork's bottom edge, 0–100. */
  progress?: number
  /** Mono telemetry under the artwork: percent, size, speed, ETA, peers. */
  stats?: React.ReactNode[]
  /** Action row, revealed on hover in place of the title. */
  actions?: React.ReactNode
  /** Always-visible footer controls under the body. */
  footer?: React.ReactNode
  onClick?: () => void
  className?: string
  width?: number | string
}

/**
 * The landscape (16:9) card that stands in for a table row wherever content
 * has state: downloads, requests and in-flight items.
 */
export function MediaCard({
  title,
  meta = [],
  subtitle,
  backdrop,
  status,
  typeBadge,
  progress,
  stats = [],
  actions,
  footer,
  onClick,
  className,
  width,
}: MediaCardProps) {
  const interactive = Boolean(onClick)
  const hasBody = Boolean(subtitle || stats.length > 0 || footer)

  return (
    <div
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? title : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          onClick()
        }
      }}
      className={cn(
        'group/media relative flex w-full flex-col overflow-hidden rounded-card border border-hairline bg-surface-card text-left shadow-1',
        'transition-[transform,box-shadow,border-color] duration-base ease-out',
        'hover:-translate-y-[3px] hover:border-subtle hover:shadow-3',
        'focus-visible:outline-none focus-visible:shadow-focus',
        interactive && 'cursor-pointer',
        className
      )}
      style={width ? { width } : undefined}
    >
      <div className="art-placeholder relative aspect-wide w-full overflow-hidden">
        {backdrop && (
          <img
            src={backdrop}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-slow ease-out group-hover/media:scale-105"
          />
        )}
        <span aria-hidden className="protect-bottom pointer-events-none absolute inset-0" />
        <span aria-hidden className="protect-top pointer-events-none absolute inset-x-0 top-0 h-[78px]" />

        {status && (
          <span className="absolute left-2.5 top-2.5 flex max-w-[calc(100%-96px)] flex-wrap items-start gap-1.5">
            {status}
          </span>
        )}
        {typeBadge && <span className="absolute right-2.5 top-2.5 flex gap-1.5">{typeBadge}</span>}

        <span
          className={cn(
            'pointer-events-none absolute inset-x-3 bottom-2.5 flex flex-col gap-1',
            actions && 'transition-opacity duration-base ease-standard group-hover/media:opacity-0'
          )}
        >
          <span className="line-clamp-2 font-condensed text-xl font-extrabold uppercase leading-tight tracking-tight text-white">
            {title}
          </span>
          {meta.length > 0 && (
            <span className="flex items-center gap-2 font-mono text-xs font-medium text-ink-200">
              {meta.map((item, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <i aria-hidden className="h-[3px] w-[3px] shrink-0 rounded-pill bg-ink-500" />}
                  <span>{item}</span>
                </React.Fragment>
              ))}
            </span>
          )}
        </span>

        {actions && (
          <span className="absolute inset-x-3 bottom-3 flex translate-y-1.5 gap-2 opacity-0 transition-[opacity,transform] duration-base ease-out group-hover/media:translate-y-0 group-hover/media:opacity-100 focus-within:translate-y-0 focus-within:opacity-100">
            {actions}
          </span>
        )}

        {typeof progress === 'number' && (
          <span aria-hidden className="absolute inset-x-0 bottom-0 h-[3px] bg-white/[.16]">
            <span
              className="block h-full transition-[width] duration-slow ease-standard"
              style={{
                width: `${Math.max(0, Math.min(100, progress))}%`,
                background: 'var(--status-downloading)',
              }}
            />
          </span>
        )}
      </div>

      {hasBody && (
        <div className="flex flex-col gap-2 p-3.5">
          {subtitle && (
            <span className="line-clamp-2 break-all font-mono text-xs font-medium text-fg-secondary" title={subtitle}>
              {subtitle}
            </span>
          )}
          {stats.length > 0 && (
            <span className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-xs font-medium text-fg-muted">
              {stats.map((stat, i) => (
                <span key={i}>{stat}</span>
              ))}
            </span>
          )}
          {footer && <div className="flex items-center gap-2 pt-0.5">{footer}</div>}
        </div>
      )}
    </div>
  )
}

/** Matches MediaCard's frame for rail loading states. */
export function MediaCardSkeleton({ width }: { width?: number | string }) {
  return (
    <div
      className="overflow-hidden rounded-card border border-hairline bg-surface-card"
      style={width ? { width } : undefined}
    >
      <div className="skeleton aspect-wide w-full" />
      <div className="flex flex-col gap-2 p-3.5">
        <div className="skeleton h-3 w-3/4 rounded-pill" />
        <div className="skeleton h-3 w-1/2 rounded-pill" />
      </div>
    </div>
  )
}
