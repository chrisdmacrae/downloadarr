import { cn } from '@/lib/utils'
import { statusTone } from '@/lib/status'

interface StatusBadgeProps {
  status: string | undefined | null
  /** Overrides the tone's own label — e.g. "Ongoing" for a live TV request. */
  label?: string
  size?: 'sm' | 'default'
  /** Glass chrome, for pills sitting over artwork. */
  onArtwork?: boolean
  className?: string
}

/**
 * The monochrome status pill. The label is never optional: hue no longer
 * carries state, so a bare dot would be unreadable.
 */
export function StatusBadge({
  status,
  label,
  size = 'default',
  onArtwork = false,
  className,
}: StatusBadgeProps) {
  const tone = statusTone(status)

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-pill font-bold uppercase tracking-wide',
        size === 'sm' ? 'h-5 px-[7px] text-[9px]' : 'h-6 px-2.5 text-2xs',
        onArtwork && 'glass border border-strong',
        className
      )}
      style={{ color: tone.color, background: onArtwork ? undefined : tone.bg }}
    >
      <span
        aria-hidden
        className={cn(
          'shrink-0 rounded-pill bg-current',
          size === 'sm' ? 'h-[5px] w-[5px]' : 'h-1.5 w-1.5',
          tone.live && 'animate-pulse-dot'
        )}
      />
      {label ?? tone.label}
    </span>
  )
}
