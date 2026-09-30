import { useState } from 'react'
import { Loader2, MoreHorizontal, Pause, Play } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import type { MusicRecommendation } from '@/services/music'
import { usePreviewPlayer } from './PreviewPlayer'

interface AlbumCardProps {
  album: MusicRecommendation
  /** One line under the artist: why it's here, or when it came out. */
  caption?: string
  onDismiss: (scope: 'album' | 'artist') => void
}

/** Missing artwork: the title's first two letters at 14% white on ink. */
function CoverPlaceholder({ title }: { title: string }) {
  return (
    <span className="art-placeholder absolute inset-0 flex items-center justify-center">
      <span className="font-condensed text-[44px] font-extrabold tracking-tight text-white/[.14]">
        {title.slice(0, 2).toUpperCase()}
      </span>
    </span>
  )
}

/**
 * A square album tile. The cover plays a preview; the menu dismisses the album
 * or the whole artist from future lists.
 */
export function AlbumCard({ album, caption, onDismiss }: AlbumCardProps) {
  const player = usePreviewPlayer()
  // Cover Art Archive has gaps; a broken cover falls back to the placeholder.
  const [coverFailed, setCoverFailed] = useState(false)
  const isCurrent =
    player.current?.artistName === album.artistName && player.current?.albumTitle === album.albumTitle
  const isPlaying = isCurrent && player.playing
  const isLoading = isCurrent && player.loading

  const onPlay = () => {
    if (isCurrent && !isLoading) player.toggle()
    else player.play({ artistName: album.artistName, albumTitle: album.albumTitle, coverUrl: album.coverUrl })
  }

  return (
    <div className="group/album flex flex-col gap-2" style={{ width: 'var(--poster-w-md)' }}>
      <div className="relative aspect-square overflow-hidden rounded-poster bg-ink-800 shadow-2">
        {album.coverUrl && !coverFailed ? (
          <img
            src={album.coverUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
            onError={() => setCoverFailed(true)}
          />
        ) : (
          <CoverPlaceholder title={album.albumTitle} />
        )}

        <button
          type="button"
          onClick={onPlay}
          aria-label={isPlaying ? `Pause ${album.albumTitle}` : `Preview ${album.albumTitle}`}
          className={cn(
            'absolute inset-0 flex items-center justify-center bg-black/0 transition-colors duration-fast ease-standard',
            'hover:bg-black/40 focus-visible:bg-black/40 focus-visible:outline-none',
            isCurrent && 'bg-black/40'
          )}
        >
          <span
            className={cn(
              'flex h-12 w-12 items-center justify-center rounded-pill bg-brand-500 text-fg-accent shadow-2 transition-opacity duration-fast',
              isCurrent ? 'opacity-100' : 'opacity-0 group-hover/album:opacity-100 group-focus-within/album:opacity-100'
            )}
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : isPlaying ? (
              <Pause className="h-5 w-5" />
            ) : (
              <Play className="h-5 w-5 translate-x-px" />
            )}
          </span>
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="glass"
              size="icon-sm"
              aria-label={`More options for ${album.albumTitle}`}
              className="absolute right-2 top-2 opacity-0 group-hover/album:opacity-100 group-focus-within/album:opacity-100 data-[state=open]:opacity-100"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => onDismiss('album')}>Not interested in this album</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onDismiss('artist')}>
              Not interested in {album.artistName}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-fg-primary" title={album.albumTitle}>
          {album.albumTitle}
        </p>
        <p className="truncate text-xs text-fg-secondary" title={album.artistName}>
          {album.artistName}
        </p>
        {caption && (
          <p className="mt-0.5 line-clamp-2 text-xs text-fg-muted" title={caption}>
            {caption}
          </p>
        )}
      </div>
    </div>
  )
}

export function AlbumCardSkeleton() {
  return (
    <div className="flex flex-col gap-2" style={{ width: 'var(--poster-w-md)' }}>
      <div className="skeleton aspect-square w-full rounded-poster" />
      <div className="skeleton h-3.5 w-3/4 rounded-sm" />
      <div className="skeleton h-3 w-1/2 rounded-sm" />
    </div>
  )
}
