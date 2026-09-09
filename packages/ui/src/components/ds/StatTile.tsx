import * as React from 'react'
import { AlertCircle, Loader2 } from 'lucide-react'

import { cn } from '@/lib/utils'

interface StatTileProps {
  label: string
  value?: React.ReactNode
  unit?: string
  hint?: React.ReactNode
  icon?: React.ReactNode
  /** Keyline and glyph colour. Defaults to the accent. */
  tone?: string
  /** Renders the value in condensed display type rather than mono numerals. */
  word?: boolean
  /** Per-tile loading spinner — never collapsed into a page-level spinner. */
  isLoading?: boolean
  /** Per-tile error state: `--` with an alert glyph. */
  isError?: boolean
  className?: string
}

export function StatTile({
  label,
  value,
  unit,
  hint,
  icon,
  tone = 'var(--accent)',
  word = false,
  isLoading = false,
  isError = false,
  className,
}: StatTileProps) {
  return (
    <div
      className={cn(
        'relative flex flex-col gap-2.5 overflow-hidden rounded-card border border-hairline bg-surface-card p-4 shadow-hairline',
        className
      )}
      style={{ ['--tone' as string]: isError ? 'var(--status-failed)' : tone }}
    >
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-0.5 opacity-90"
        style={{ background: 'var(--tone)' }}
      />

      <div className="flex items-center justify-between gap-2">
        <span className="font-condensed text-2xs font-bold uppercase leading-none tracking-eyebrow text-fg-muted">
          {label}
        </span>
        <span className="flex" style={{ color: 'var(--tone)' }}>
          {isError ? <AlertCircle className="h-4 w-4" /> : icon}
        </span>
      </div>

      {isLoading ? (
        <span className="flex h-6 items-center">
          <Loader2 className="h-5 w-5 animate-spin text-fg-muted" />
        </span>
      ) : (
        <span
          className={cn(
            'leading-none tracking-tight text-fg-primary',
            word
              ? 'font-condensed text-2xl font-extrabold'
              : 'font-mono text-2xl font-bold'
          )}
          style={word && !isError ? { color: tone } : isError ? { color: 'var(--status-failed)' } : undefined}
        >
          {isError ? '—' : value}
          {!isError && unit && (
            <span className="ml-1 font-mono text-sm font-medium text-fg-muted">{unit}</span>
          )}
        </span>
      )}

      <span className="text-xs font-medium text-fg-muted">
        {isError ? 'Unavailable' : hint}
      </span>
    </div>
  )
}
