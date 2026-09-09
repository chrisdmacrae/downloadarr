import * as React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { cn } from '@/lib/utils'

interface RailProps {
  title?: React.ReactNode
  /** Item count rendered in mono beside the title. */
  count?: number
  /** Optional trailing link in the rail head. */
  moreLabel?: string
  onMore?: () => void
  /** Rendered in the head, right of the title — filters, refresh, etc. */
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
  /** Extra vertical room for the shadow under hover-expanded cards. */
  padY?: boolean
}

/**
 * A paged carousel — not a grid, not a free-scrolling strip.
 *
 * A click on an arrow translates the track by exactly one viewport width via
 * transform, over 520ms. There is no scrollbar, no free scroll and no
 * momentum. Arrows, edge fades and the page-tick indicator all disable at the
 * ends, and a rail whose content fits shows no arrows at all.
 */
export function Rail({
  title,
  count,
  moreLabel,
  onMore,
  action,
  children,
  className,
  padY = true,
}: RailProps) {
  const viewportRef = React.useRef<HTMLDivElement>(null)
  const trackRef = React.useRef<HTMLDivElement>(null)
  const [page, setPage] = React.useState(0)
  const [pages, setPages] = React.useState(1)
  const [step, setStep] = React.useState(0)

  const measure = React.useCallback(() => {
    const viewport = viewportRef.current
    const track = trackRef.current
    if (!viewport || !track) return

    const styles = getComputedStyle(viewport)
    const padding = parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight)
    const visible = viewport.clientWidth - padding
    const total = track.scrollWidth

    setStep(visible)
    setPages(visible > 0 ? Math.max(1, Math.ceil((total - visible) / visible) + 1) : 1)
  }, [])

  React.useEffect(() => {
    measure()
    const viewport = viewportRef.current
    const track = trackRef.current
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure)
      return () => window.removeEventListener('resize', measure)
    }
    const observer = new ResizeObserver(measure)
    if (viewport) observer.observe(viewport)
    if (track) observer.observe(track)
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [measure, children])

  // Clamp the current page when the content shrinks under it.
  React.useEffect(() => {
    setPage((current) => Math.min(current, Math.max(0, pages - 1)))
  }, [pages])

  const canPrev = page > 0
  const canNext = page < pages - 1
  const go = (direction: -1 | 1) =>
    setPage((current) => Math.min(pages - 1, Math.max(0, current + direction)))

  const arrow = (direction: -1 | 1) => {
    const enabled = direction < 0 ? canPrev : canNext
    return (
      <button
        type="button"
        aria-label={direction < 0 ? 'Previous page' : 'Next page'}
        tabIndex={enabled ? 0 : -1}
        aria-disabled={!enabled}
        onClick={() => enabled && go(direction)}
        className={cn(
          'absolute top-1/2 z-[3] inline-flex h-[76px] w-[38px] -translate-y-1/2 items-center justify-center rounded-md border-0 bg-[rgba(20,20,20,.6)] text-fg-primary opacity-0 transition-[opacity,background-color] duration-fast ease-standard',
          'hover:bg-[rgba(20,20,20,.86)] focus-visible:opacity-100 focus-visible:outline-none focus-visible:shadow-focus',
          direction < 0 ? 'left-0' : 'right-0',
          enabled ? 'group-hover/rail:opacity-100' : 'pointer-events-none'
        )}
      >
        {direction < 0 ? (
          <ChevronLeft className="h-[22px] w-[22px]" />
        ) : (
          <ChevronRight className="h-[22px] w-[22px]" />
        )}
      </button>
    )
  }

  return (
    <section className={cn('group/rail relative flex min-w-0 flex-col gap-2.5', className)}>
      {(title || action || moreLabel) && (
        <div className="flex items-baseline justify-between gap-4 pr-1">
          <div className="flex min-w-0 items-baseline gap-2.5">
            {title && (
              <h2 className="truncate text-xl font-bold leading-snug tracking-tight text-fg-primary">
                {title}
              </h2>
            )}
            {count != null && (
              <span className="font-mono text-xs font-medium text-fg-muted">{count}</span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {action}
            {moreLabel && (
              <button
                type="button"
                onClick={onMore}
                className="inline-flex items-center gap-1 rounded-sm text-xs font-medium text-fg-muted transition-colors duration-fast ease-standard hover:text-brand-500 focus-visible:outline-none focus-visible:shadow-focus"
              >
                {moreLabel}
                <ChevronRight className="h-3 w-3" strokeWidth={2.5} />
              </button>
            )}
          </div>
        </div>
      )}

      <div
        ref={viewportRef}
        className={cn('rail-viewport relative overflow-hidden', padY ? 'py-4' : 'py-1')}
      >
        {/* One tick per page, top-right, revealed on rail hover. */}
        {pages > 1 && (
          <div className="absolute right-[max(var(--rail-bleed,0px),12px)] top-0.5 z-[3] flex gap-[3px] opacity-0 transition-opacity duration-fast ease-standard group-hover/rail:opacity-100">
            {Array.from({ length: pages }, (_, i) => (
              <i
                key={i}
                className={cn('block h-0.5 w-3.5', i === page ? 'bg-ink-100' : 'bg-ink-600')}
              />
            ))}
          </div>
        )}

        <div
          aria-hidden
          className={cn(
            'rail-fade-l pointer-events-none absolute inset-y-0 left-0 z-[1] w-[72px] transition-opacity duration-fast ease-standard',
            canPrev ? 'opacity-100' : 'opacity-0'
          )}
        />
        {arrow(-1)}

        <div
          ref={trackRef}
          className="rail-track flex items-start gap-rail transition-transform duration-rail ease-out [&>*]:shrink-0"
          style={{ transform: `translate3d(${-page * step}px, 0, 0)` }}
        >
          {children}
        </div>

        <div
          aria-hidden
          className={cn(
            'rail-fade-r pointer-events-none absolute inset-y-0 right-0 z-[1] w-[72px] transition-opacity duration-fast ease-standard',
            canNext ? 'opacity-100' : 'opacity-0'
          )}
        />
        {arrow(1)}
      </div>
    </section>
  )
}
