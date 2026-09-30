import api from '@/services/api'

export type MusicSourceProvider = 'LISTENBRAINZ' | 'LASTFM' | 'DEEZER' | 'SPOTIFY'
export type MusicList =
  | 'NEW_ARTISTS'
  | 'FRESH_RELEASES'
  | 'WEEKLY_PICKS'
  | 'WEEKLY_JAMS'
  | 'DAILY_JAMS'
  | 'FLOW'
  | 'MOST_PLAYED'
  | 'SAVED_ALBUMS'

export interface MusicSource {
  provider: MusicSourceProvider
  /** For Deezer, the numeric user ID; for Spotify, the user ID. */
  username: string
  /** Deezer or Spotify profile name. */
  displayName: string | null
  enabled: boolean
  /** Last.fm API key, or ListenBrainz token. Write-only. */
  hasApiKey: boolean
  /** Spotify only. */
  clientId: string | null
  redirectUri: string | null
  lastSyncedAt: string | null
  lastSyncError: string | null
}

export interface MusicSyncStatus {
  running: boolean
  startedAt: string | null
  finishedAt: string | null
  error: string | null
}

export interface MusicRecommendation {
  id: string
  list: MusicList
  rank: number
  artistName: string
  artistMbid: string | null
  albumTitle: string
  releaseGroupMbid: string | null
  releaseDate: string | null
  coverUrl: string | null
  score: number
  /** Artists you listen to that led here, strongest first. */
  reasons: string[]
  sources: string[]
  generatedAt: string
}

export interface MusicDiscoverData {
  lists: Record<MusicList, MusicRecommendation[]>
  topArtists: Array<{ name: string; mbid: string | null; tasteWeight: number }>
}

export interface PreviewTrack {
  id: number
  title: string
  artistName: string
  durationSeconds: number
  position?: number
  previewUrl?: string
}

export interface AlbumPreview {
  deezerAlbumId: number
  title: string
  artistName: string
  coverUrl?: string
  tracks: PreviewTrack[]
}

export interface RadioTrack {
  id: string
  title: string
  artistName: string
  albumTitle?: string
  coverUrl?: string
  durationSeconds: number
  previewUrl: string
  source: 'deezer' | 'listenbrainz'
}

export interface RadioAlbum {
  id: string
  artistName: string
  albumTitle: string
  coverUrl?: string
  sources: string[]
}

export interface ArtistRadio {
  artistName: string
  sources: string[]
  /** Playable tracks, in play order. */
  tracks: RadioTrack[]
  /** The albums the station's tracks come from, first heard first. */
  albums: RadioAlbum[]
}

export interface MusicDismissal {
  id: string
  key: string
  label: string
  createdAt: string
}

export const musicApi = {
  getSources: async (): Promise<MusicSource[]> => (await api.get('/music/sources')).data.data,

  saveSource: async (
    provider: MusicSourceProvider,
    body: { username: string; apiKey?: string; enabled?: boolean }
  ): Promise<MusicSource> =>
    // Validating the account calls out to the provider; allow for a slow one.
    (await api.put(`/music/sources/${provider}`, body, { timeout: 20000 })).data.data,

  removeSource: async (provider: MusicSourceProvider): Promise<void> => {
    await api.delete(`/music/sources/${provider}`)
  },

  /** Returns the Spotify sign-in address to send the browser to. */
  startSpotifyAuth: async (body: { clientId: string; redirectUri: string; returnTo: string }): Promise<string> =>
    (await api.post('/music/spotify/authorize', body)).data.data.authorizeUrl,

  /** The API's Spotify callback, as the browser reaches it from here. */
  spotifyCallbackUrl: (): string =>
    new URL(`${api.defaults.baseURL ?? ''}/music/spotify/callback`, window.location.origin).toString(),

  startSync: async (): Promise<MusicSyncStatus> => (await api.post('/music/sync')).data.data,

  getSyncStatus: async (): Promise<MusicSyncStatus> => (await api.get('/music/sync/status')).data.data,

  getDiscover: async (): Promise<MusicDiscoverData> => (await api.get('/music/discover')).data.data,

  getPreview: async (artist: string, album: string): Promise<AlbumPreview> =>
    (await api.get('/music/preview', { params: { artist, album }, timeout: 15000 })).data.data,

  /** Matching ListenBrainz tracks on Deezer takes a few seconds. */
  getArtistRadio: async (artist: string): Promise<ArtistRadio> =>
    (await api.get('/music/radio', { params: { artist }, timeout: 30000 })).data.data,

  getDismissals: async (): Promise<MusicDismissal[]> => (await api.get('/music/dismissals')).data.data,

  dismiss: async (artistName: string, albumTitle?: string): Promise<MusicDismissal> =>
    (await api.post('/music/dismissals', { artistName, albumTitle })).data.data,

  undoDismissal: async (id: string): Promise<void> => {
    await api.delete(`/music/dismissals/${id}`)
  },
}
