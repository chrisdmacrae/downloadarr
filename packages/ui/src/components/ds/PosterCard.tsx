import * as React from 'react'

import { cn } from '@/lib/utils'
import { contentTypeTone, formatRating, formatRuntime } from '@/lib/status'

export type PosterSize = 'sm' | 'md' | 'lg'

export interface PosterDetails {
  rating?: number
  year?: number
  /** Movie runtime in minutes. */
  runtime?: number
  /** TV season count. */
  seasons?: number
  /** TV minutes per episode. */
  episodeRuntime?: number
  /** Game platform. */
  platform?: string
  description?: string
  categories?: string[]
}

interface PosterCardProps {
  title: string
  type?: string
  poster?: string
  year?: number
  details?: PosterDetails
  size?: PosterSize
  /** Status pill, top-left. Rendered only when the item has state. */
  status?: React.ReactNode
  /** Extra badges beside the status pill. */
  badges?: React.ReactNode
  /** Transfer hairline across the bottom edge, 0–100. */
  progress?: number
  /** Pinned to the bottom of the metadata panel. */
  actions?: React.ReactNode
  onClick?: () => void
  className?: string
  /**
   * Which way the expanded card grows. Tiles at either end of a rail anchor
   * inward so the wider card never runs off the edge.
   */
  anchor?: 'center' | 'start' | 'end'
}

const WIDTHS: Record<PosterSize, string> = {
  sm: 'var(--poster-w-sm)',
  md: 'var(--poster-w-md)',
  lg: 'var(--poster-w-lg)',
}

const EXPANDED: Record<PosterSize, string> = {
  sm: 'var(--poster-expand-sm)',
  md: 'var(--poster-expand-md)',
  lg: 'var(--poster-expand-lg)',
}

/** Missing artwork: the title's first two letters at 14% white on ink. */
function ArtPlaceholder({ title, className }: { title: string; className?: string }) {
  return (
    <span className={cn('art-placeholder absolute inset-0 flex items-center justify-center', className)}>
      <span className="font-condensed text-[44px] font-extrabold tracking-tight text-white/[.14]">
        {String(title || '?').slice(0, 2).toUpperCase()}
      </span>
    </span>
  )
}

/**
 * At rest: artwork, the title on a permanent bottom protection gradient, and
 * nothing else — a rail reads as a wall of artwork with titles.
 *
 * On hover or focus the card grows **in width only**, keeping its centre and
 * its exact height. The artwork keeps its full poster frame — it is never
 * re-cropped into a landscape still — and the width the card gains becomes a
 * metadata panel beside it.
 */
export function PosterCard({
  title,
  type = 'movie',
  poster,
  year,
  details,
  size = 'md',
  status,
  badges,
  progress,
  actions,
  onClick,
  className,
  anchor = 'center',
}: PosterCardProps) {
  const tone = contentTypeTone(type)
  const isGame = tone.aspect === 'game'
  const d = details ?? {}

  // Facts differ by content type: movies year · runtime, TV year · seasons ·
  // minutes per episode, games platform · year.
  const facts = (
    isGame
      ? [d.platform, String(d.year ?? year ?? '')]
      : tone.short === 'TV'
        ? [
            String(d.year ?? year ?? ''),
            d.seasons ? `${d.seasons} ${d.seasons === 1 ? 'season' : 'seasons'}` : '',
            d.episodeRuntime ? `${d.episodeRuntime}m eps` : '',
          ]
        : [String(d.year ?? year ?? ''), formatRuntime(d.runtime) ?? '']
  ).filter(Boolean) as string[]

  const rating = formatRating(d.rating)

  const artwork = (
    <>
      {poster ? (
        <img src={poster} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <ArtPlaceholder title={title} />
      )}
      {(status || badges) && (
        <span aria-hidden className="protect-top pointer-events-none absolute inset-x-0 top-0 h-16" />
      )}
      <span aria-hidden className="protect-bottom pointer-events-none absolute inset-x-0 bottom-0 h-[62%]" />
    </>
  )

  const transferBar =
    typeof progress === 'number' ? (
      <span aria-hidden className="absolute inset-x-0 bottom-0 block h-[3px] bg-white/[.16]">
        <span
          className="block h-full transition-[width] duration-slow ease-standard"
          style={{
            width: `${Math.max(0, Math.min(100, progress))}%`,
            background: 'var(--status-downloading)',
          }}
        />
      </span>
    ) : null

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={title}
      onClick={onClick}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          onClick()
        }
      }}
      className={cn(
        'group/poster relative block cursor-pointer text-left focus:outline-none hover:z-10 focus-within:z-10',
        className
      )}
      style={
        {
          width: WIDTHS[size],
          '--poster-expanded': EXPANDED[size],
        } as React.CSSProperties
      }
    >
      {/* At-rest tile */}
      <span
        className={cn(
          'relative block w-full overflow-hidden rounded-poster bg-ink-800 shadow-2',
          isGame ? 'aspect-game' : 'aspect-poster'
        )}
      >
        {artwork}
        {(status || badges) && (
          <span className="absolute inset-x-2 top-2 flex max-w-[calc(100%-16px)] flex-wrap gap-1.5">
            {status}
            {badges}
          </span>
        )}
        <span className="pointer-events-none absolute inset-x-2.5 bottom-2.5">
          <span
            className={cn(
              'line-clamp-2 font-condensed font-extrabold uppercase leading-tight tracking-tight text-white',
              size === 'sm' ? 'text-sm' : 'text-base'
            )}
          >
            {title}
          </span>
        </span>
        {transferBar}
      </span>

      {/* Expanded hover card: same centre, same height, wider. */}
      <span
        className={cn(
          'poster-expand pointer-events-none absolute top-1/2 z-[5] flex h-full w-full -translate-y-1/2 overflow-hidden rounded-poster bg-surface-card opacity-0 shadow-poster',
          'group-hover/poster:pointer-events-auto group-hover/poster:opacity-100 group-hover/poster:w-[var(--poster-expanded)]',
          'group-focus-visible/poster:pointer-events-auto group-focus-visible/poster:opacity-100 group-focus-visible/poster:w-[var(--poster-expanded)] group-focus-visible/poster:shadow-focus',
          anchor === 'start' && 'left-0',
          anchor === 'end' && 'right-0',
          anchor === 'center' && 'left-1/2 -translate-x-1/2'
        )}
        style={{
          transition:
            'opacity var(--dur-base) var(--ease-standard), width var(--dur-base) var(--ease-out)',
        }}
      >
        {/* The artwork keeps its full poster frame — never re-cropped. */}
        <span
          className="relative block h-full shrink-0 overflow-hidden"
          style={{ width: WIDTHS[size] }}
        >
          {artwork}
          {(status || badges) && (
            <span className="absolute inset-x-2 top-2 flex max-w-[calc(100%-16px)] flex-wrap gap-1.5">
              {status}
              {badges}
            </span>
          )}
          {transferBar}
        </span>

        {/* The width the card gains becomes the metadata panel. */}
        <span className="flex min-w-0 flex-1 flex-col gap-2 overflow-hidden p-3.5">
          <span className="line-clamp-2 font-condensed text-base font-extrabold uppercase leading-tight tracking-tight text-fg-primary">
            {title}
          </span>

          {(rating || facts.length > 0) && (
            <span className="flex flex-wrap items-center gap-2 font-mono text-xs font-medium text-fg-secondary">
              {rating && (
                <span className="inline-flex h-[17px] items-center gap-1 rounded-sm border border-strong px-1.5 text-fg-primary">
                  {rating}
                </span>
              )}
              {facts.map((fact, i) => (
                <React.Fragment key={`${fact}-${i}`}>
                  {(i > 0 || rating) && (
                    <i aria-hidden className="h-[3px] w-[3px] shrink-0 rounded-pill bg-ink-600" />
                  )}
                  <span>{fact}</span>
                </React.Fragment>
              ))}
            </span>
          )}

          {d.description && (
            <span className="line-clamp-5 text-xs font-medium text-fg-secondary text-pretty">
              {d.description}
            </span>
          )}

          <span className="flex-1" />

          {d.categories && d.categories.length > 0 && (
            <span className="line-clamp-1 font-mono text-xs font-medium text-fg-muted">
              {d.categories.join(' · ')}
            </span>
          )}

          {actions && <span className="flex shrink-0 items-center gap-2">{actions}</span>}
        </span>
      </span>
    </div>
  )
}

/** Rail-shaped poster skeleton, matching the card's frame exactly. */
export function PosterCardSkeleton({
  size = 'md',
  game = false,
}: {
  size?: PosterSize
  game?: boolean
}) {
  return (
    <div style={{ width: WIDTHS[size] }}>
      <div className={cn('skeleton w-full rounded-poster', game ? 'aspect-game' : 'aspect-poster')} />
    </div>
  )
}
