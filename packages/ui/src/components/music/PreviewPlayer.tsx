import * as React from 'react'
import { ListMusic, Loader2, Pause, Play, SkipBack, SkipForward, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { musicApi, type ArtistRadio } from '@/services/music'

interface PlayRequest {
  artistName: string
  albumTitle: string
  coverUrl?: string | null
}

/** What's in the player: one album's previews, or an artist radio station. */
export type NowPlaying = ({ kind: 'album' } & PlayRequest) | { kind: 'radio'; artistName: string; coverUrl?: string | null }

interface QueueTrack {
  id: string | number
  title: string
  artistName: string
  albumTitle?: string
  coverUrl?: string
  durationSeconds: number
  previewUrl?: string
}

interface Queue {
  coverUrl?: string
  tracks: QueueTrack[]
}

interface PreviewPlayerState {
  /** The album or station loaded, or loading, in the player. */
  current: NowPlaying | null
  playing: boolean
  loading: boolean
  play: (album: PlayRequest) => void
  playRadio: (radio: ArtistRadio) => void
  toggle: () => void
}

const PreviewPlayerContext = React.createContext<PreviewPlayerState | null>(null)

export function usePreviewPlayer() {
  const context = React.useContext(PreviewPlayerContext)
  if (!context) throw new Error('usePreviewPlayer must be used inside PreviewPlayerProvider')
  return context
}

const isSameAlbum = (a: NowPlaying | null, b: PlayRequest) =>
  a?.kind === 'album' && a.artistName === b.artistName && a.albumTitle === b.albumTitle

function formatClock(seconds: number) {
  const s = Math.max(0, Math.floor(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/**
 * One audio element for the page, playing Deezer's 30-second previews of an
 * album, or of an artist radio station, track by track. Preview URLs expire,
 * so the tracklist is fetched each time an album is played.
 */
export function PreviewPlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = React.useRef<HTMLAudioElement>(null)
  const [current, setCurrent] = React.useState<NowPlaying | null>(null)
  const [preview, setPreview] = React.useState<Queue | null>(null)
  const [trackIndex, setTrackIndex] = React.useState(0)
  const [playing, setPlaying] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [time, setTime] = React.useState({ position: 0, duration: 30 })
  const [showTracks, setShowTracks] = React.useState(false)
  const requestId = React.useRef(0)

  const tracks = preview?.tracks ?? []
  const track = tracks[trackIndex]

  const startTrack = React.useCallback((index: number) => {
    setTrackIndex(index)
    setTime({ position: 0, duration: 30 })
  }, [])

  // Load and play whenever the track changes.
  React.useEffect(() => {
    const audio = audioRef.current
    if (!audio || !track?.previewUrl) return
    audio.src = track.previewUrl
    audio.play().catch(() => setPlaying(false))
  }, [track?.previewUrl])

  const play = React.useCallback(
    async (album: PlayRequest) => {
      if (isSameAlbum(current, album) && preview) {
        audioRef.current?.play().catch(() => undefined)
        return
      }
      const id = ++requestId.current
      audioRef.current?.pause()
      setCurrent({ kind: 'album', ...album })
      setPreview(null)
      setError(null)
      setLoading(true)
      try {
        const result = await musicApi.getPreview(album.artistName, album.albumTitle)
        if (id !== requestId.current) return
        if (!result.tracks.length) throw new Error('empty')
        setPreview(result)
        startTrack(0)
      } catch {
        if (id === requestId.current) setError('No preview available for this album')
      } finally {
        if (id === requestId.current) setLoading(false)
      }
    },
    [current, preview, startTrack]
  )

  /** Radio tracks arrive with their previews, so there's nothing to fetch. */
  const playRadio = React.useCallback(
    (radio: ArtistRadio) => {
      requestId.current++
      audioRef.current?.pause()
      setCurrent({ kind: 'radio', artistName: radio.artistName, coverUrl: radio.tracks[0]?.coverUrl })
      setLoading(false)
      setShowTracks(false)
      if (!radio.tracks.length) {
        setPreview(null)
        setError('No previews on this station')
        return
      }
      setError(null)
      setPreview({ tracks: radio.tracks })
      startTrack(0)
    },
    [startTrack]
  )

  const toggle = React.useCallback(() => {
    const audio = audioRef.current
    if (!audio || !track) return
    if (audio.paused) audio.play().catch(() => undefined)
    else audio.pause()
  }, [track])

  const close = () => {
    requestId.current++
    audioRef.current?.pause()
    setCurrent(null)
    setPreview(null)
    setError(null)
    setShowTracks(false)
  }

  const value = React.useMemo(
    () => ({ current, playing, loading, play, playRadio, toggle }),
    [current, playing, loading, play, playRadio, toggle]
  )

  return (
    <PreviewPlayerContext.Provider value={value}>
      {children}

      <audio
        ref={audioRef}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) =>
          setTime({
            position: e.currentTarget.currentTime,
            duration: e.currentTarget.duration || 30,
          })
        }
        onEnded={() => {
          if (trackIndex < tracks.length - 1) startTrack(trackIndex + 1)
          else setPlaying(false)
        }}
      />

      {current && (
        <div className="glass fixed inset-x-0 bottom-0 z-40 border-t border-strong">
          {showTracks && tracks.length > 0 && (
            <ol className="max-h-[40vh] overflow-y-auto border-b border-hairline px-gutter py-2">
              {tracks.map((t, i) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => startTrack(i)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-control px-2 py-1.5 text-left text-sm transition-colors duration-fast hover:bg-surface-input',
                      i === trackIndex ? 'text-brand-500' : 'text-fg-secondary'
                    )}
                  >
                    <span className="w-6 shrink-0 text-right font-mono text-xs text-fg-muted">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate">
                      {t.title}
                      {current.kind === 'radio' && <span className="text-fg-muted"> · {t.artistName}</span>}
                    </span>
                    <span className="shrink-0 font-mono text-xs text-fg-muted">{formatClock(t.durationSeconds)}</span>
                  </button>
                </li>
              ))}
            </ol>
          )}

          {/* Right padding clears the report FAB, which floats over this bar. */}
          <div className="flex items-center gap-3 py-2.5 pl-gutter pr-[76px] sm:pr-[88px]">
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-ink-800 sm:h-12 sm:w-12">
              {(track?.coverUrl || preview?.coverUrl || current.coverUrl) && (
                <img
                  src={track?.coverUrl || preview?.coverUrl || current.coverUrl || undefined}
                  alt=""
                  className="h-full w-full object-cover"
                />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-fg-primary">
                {track?.title ?? (current.kind === 'album' ? current.albumTitle : `${current.artistName} radio`)}
              </p>
              <p className="truncate text-xs text-fg-muted">
                {error ??
                  (loading
                    ? 'Loading preview…'
                    : current.kind === 'album'
                      ? `${current.artistName} · ${current.albumTitle}`
                      : `${track?.artistName ?? ''} · ${current.artistName} radio`)}
              </p>
              {track && (
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="relative block h-[3px] flex-1 overflow-hidden rounded-pill bg-white/[.16]">
                    <span
                      className="absolute inset-y-0 left-0 bg-brand-500"
                      style={{ width: `${Math.min(100, (time.position / time.duration) * 100)}%` }}
                    />
                  </span>
                  <span className="hidden shrink-0 font-mono text-2xs text-fg-muted sm:inline">
                    {formatClock(time.position)} / {formatClock(time.duration)}
                  </span>
                </div>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Previous track"
                disabled={!track || trackIndex === 0}
                onClick={() => startTrack(trackIndex - 1)}
                // Phones skip tracks from the tracklist instead.
                className="hidden sm:inline-flex"
              >
                <SkipBack className="h-4 w-4" />
              </Button>
              <Button size="icon" aria-label={playing ? 'Pause' : 'Play'} disabled={!track} onClick={toggle}>
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : playing ? (
                  <Pause className="h-5 w-5" />
                ) : (
                  <Play className="h-5 w-5" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Next track"
                disabled={!track || trackIndex >= tracks.length - 1}
                onClick={() => startTrack(trackIndex + 1)}
                className="hidden sm:inline-flex"
              >
                <SkipForward className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Tracklist"
                aria-pressed={showTracks}
                disabled={!tracks.length}
                onClick={() => setShowTracks((v) => !v)}
                className={cn(showTracks && 'text-fg-primary')}
              >
                <ListMusic className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label="Close player" onClick={close}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <p className="px-gutter pb-1.5 text-2xs text-fg-muted">30-second previews from Deezer</p>
        </div>
      )}
    </PreviewPlayerContext.Provider>
  )
}
