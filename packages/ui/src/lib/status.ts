import {
  AlertCircle,
  CheckCircle,
  Clock,
  Download,
  Film,
  Gamepad2,
  Link as LinkIcon,
  Pause,
  Search,
  Timer,
  Tv,
  XCircle,
  type LucideIcon,
} from 'lucide-react'

/**
 * Status is monochrome. States are told apart by value, weight and motion —
 * never by hue. Waiting states sit low on the ink ramp and climb it as work
 * progresses; failure is the single place chroma appears.
 *
 * Because hue no longer carries state, a status dot must never be rendered
 * without its label. `StatusBadge` enforces that.
 */
export type StatusKey =
  | 'PENDING'
  | 'QUEUED'
  | 'SEARCHING'
  | 'FOUND'
  | 'DOWNLOADING'
  | 'PAUSED'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'PROCESSING'
  | 'SKIPPED'
  | 'PENDING_METADATA'
  | 'METADATA_MATCHED'

export interface StatusTone {
  label: string
  icon: LucideIcon
  /** Foreground tone — a CSS custom property from the status ramp. */
  color: string
  /** Tint background — a white alpha, or the brand tint for failure. */
  bg: string
  /** Live states pulse their dot at 1.4s. */
  live?: boolean
}

const TONES: Record<StatusKey, StatusTone> = {
  PENDING: {
    label: 'Pending',
    icon: Clock,
    color: 'var(--status-pending)',
    bg: 'var(--status-pending-bg)',
  },
  QUEUED: {
    label: 'Queued',
    icon: Clock,
    color: 'var(--status-pending)',
    bg: 'var(--status-pending-bg)',
  },
  PENDING_METADATA: {
    label: 'Needs metadata',
    icon: LinkIcon,
    color: 'var(--status-pending)',
    bg: 'var(--status-pending-bg)',
  },
  SEARCHING: {
    label: 'Searching',
    icon: Search,
    color: 'var(--status-searching)',
    bg: 'var(--status-searching-bg)',
    live: true,
  },
  PROCESSING: {
    label: 'Processing',
    icon: Search,
    color: 'var(--status-searching)',
    bg: 'var(--status-searching-bg)',
    live: true,
  },
  FOUND: {
    label: 'Found',
    icon: CheckCircle,
    color: 'var(--status-found)',
    bg: 'var(--status-found-bg)',
  },
  METADATA_MATCHED: {
    label: 'Matched',
    icon: CheckCircle,
    color: 'var(--status-found)',
    bg: 'var(--status-found-bg)',
  },
  DOWNLOADING: {
    label: 'Downloading',
    icon: Download,
    color: 'var(--status-downloading)',
    bg: 'var(--status-downloading-bg)',
    live: true,
  },
  COMPLETED: {
    label: 'Completed',
    icon: CheckCircle,
    color: 'var(--status-completed)',
    bg: 'var(--status-completed-bg)',
  },
  FAILED: {
    label: 'Failed',
    icon: AlertCircle,
    color: 'var(--status-failed)',
    bg: 'var(--status-failed-bg)',
  },
  PAUSED: {
    label: 'Paused',
    icon: Pause,
    color: 'var(--status-idle)',
    bg: 'var(--status-idle-bg)',
  },
  CANCELLED: {
    label: 'Cancelled',
    icon: XCircle,
    color: 'var(--status-idle)',
    bg: 'var(--status-idle-bg)',
  },
  EXPIRED: {
    label: 'Expired',
    icon: Timer,
    color: 'var(--status-idle)',
    bg: 'var(--status-idle-bg)',
  },
  SKIPPED: {
    label: 'Skipped',
    icon: XCircle,
    color: 'var(--status-idle)',
    bg: 'var(--status-idle-bg)',
  },
}

/** aria2 reports lowercase job states; map them onto the same language. */
const ARIA2_ALIASES: Record<string, StatusKey> = {
  active: 'DOWNLOADING',
  downloading: 'DOWNLOADING',
  waiting: 'QUEUED',
  queued: 'QUEUED',
  paused: 'PAUSED',
  complete: 'COMPLETED',
  completed: 'COMPLETED',
  error: 'FAILED',
  failed: 'FAILED',
  removed: 'CANCELLED',
  cancelled: 'CANCELLED',
}

export function normalizeStatus(status: string | undefined | null): StatusKey {
  if (!status) return 'PENDING'
  const alias = ARIA2_ALIASES[status.toLowerCase()]
  if (alias) return alias
  const upper = status.toUpperCase() as StatusKey
  return upper in TONES ? upper : 'PENDING'
}

export function statusTone(status: string | undefined | null): StatusTone {
  return TONES[normalizeStatus(status)]
}

/* -------------------------------------------------------------------------- */
/* Content types — monochrome too: white, ink-100, ink-300, ink-400.           */
/* -------------------------------------------------------------------------- */

export type ContentTypeKey = 'MOVIE' | 'TV_SHOW' | 'GAME' | 'OTHER'

export interface ContentTypeTone {
  label: string
  short: string
  icon: LucideIcon
  color: string
  /** The Badge variant carrying the matching tint. */
  variant: 'movie' | 'tv' | 'game' | 'other'
  /** Poster aspect: 2:3 for movies and TV, 3:4 for games. */
  aspect: 'poster' | 'game'
}

const CONTENT_TYPES: Record<ContentTypeKey, ContentTypeTone> = {
  MOVIE: {
    label: 'Movie',
    short: 'Movie',
    icon: Film,
    color: 'var(--type-movie)',
    variant: 'movie',
    aspect: 'poster',
  },
  TV_SHOW: {
    label: 'TV show',
    short: 'TV',
    icon: Tv,
    color: 'var(--type-tv)',
    variant: 'tv',
    aspect: 'poster',
  },
  GAME: {
    label: 'Game',
    short: 'Game',
    icon: Gamepad2,
    color: 'var(--type-game)',
    variant: 'game',
    aspect: 'game',
  },
  OTHER: {
    label: 'Other',
    short: 'Other',
    icon: LinkIcon,
    color: 'var(--type-other)',
    variant: 'other',
    aspect: 'poster',
  },
}

export function normalizeContentType(type: string | undefined | null): ContentTypeKey {
  if (!type) return 'OTHER'
  const upper = type.toUpperCase()
  if (upper === 'MOVIE' || upper === 'MOVIES') return 'MOVIE'
  if (upper === 'TV' || upper === 'TV_SHOW' || upper === 'TVSHOW' || upper === 'TV_SHOWS') return 'TV_SHOW'
  if (upper === 'GAME' || upper === 'GAMES') return 'GAME'
  return 'OTHER'
}

export function contentTypeTone(type: string | undefined | null): ContentTypeTone {
  return CONTENT_TYPES[normalizeContentType(type)]
}

/* -------------------------------------------------------------------------- */
/* Formatters. Numbers are always formatted and unit-suffixed.                 */
/* -------------------------------------------------------------------------- */

export function formatFileSize(bytes: number | undefined | null, decimals = 1): string {
  if (bytes == null || Number.isNaN(bytes)) return '—'
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`
}

export function formatSpeed(bytesPerSecond: number | undefined | null): string {
  if (!bytesPerSecond || bytesPerSecond <= 0) return '0 MB/s'
  const mbps = bytesPerSecond / (1024 * 1024)
  if (mbps < 1) return `${(bytesPerSecond / 1024).toFixed(0)} KB/s`
  return `${mbps.toFixed(1)} MB/s`
}

/** Percentages carry one decimal, because the source formats them that way. */
export function formatPercent(value: number | undefined | null): string {
  if (value == null || Number.isNaN(value)) return '—'
  return `${Math.max(0, Math.min(100, value)).toFixed(1)}%`
}

export function formatEta(seconds: number | undefined | null): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return '∞'
  if (seconds < 60) return `${Math.round(seconds)}s`
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`
  return `${Math.round(seconds / 3600)}h`
}

/** Cheap relative timestamp for request and queue rows. */
export function formatRelativeTime(value: string | Date | undefined | null): string {
  if (!value) return '—'
  const date = typeof value === 'string' ? new Date(value) : value
  const diff = Date.now() - date.getTime()
  if (Number.isNaN(diff)) return '—'
  const minutes = Math.round(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days}d ago`
  return date.toLocaleDateString()
}

/** Ratings render as `8.4` in a bordered chip. */
export function formatRating(rating: number | undefined | null): string | undefined {
  if (rating == null || Number.isNaN(rating) || rating <= 0) return undefined
  return rating.toFixed(1)
}

export function formatRuntime(minutes: number | undefined | null): string | undefined {
  if (!minutes || minutes <= 0) return undefined
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours}h ${rest}m` : `${hours}h`
}
