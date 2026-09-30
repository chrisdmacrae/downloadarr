import api from '@/services/api'

export type MusicSourceProvider = 'LISTENBRAINZ' | 'LASTFM' | 'DEEZER'
export type MusicList =
  | 'NEW_ARTISTS'
  | 'FRESH_RELEASES'
  | 'WEEKLY_PICKS'
  | 'FLOW'
  | 'MOST_PLAYED'
  | 'SAVED_ALBUMS'

export interface MusicSource {
  provider: MusicSourceProvider
  /** For Deezer, the numeric user ID. */
  username: string
  /** Deezer profile name. */
  displayName: string | null
  enabled: boolean
  /** Last.fm API key, or ListenBrainz token. Write-only. */
  hasApiKey: boolean
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

  startSync: async (): Promise<MusicSyncStatus> => (await api.post('/music/sync')).data.data,

  getSyncStatus: async (): Promise<MusicSyncStatus> => (await api.get('/music/sync/status')).data.data,

  getDiscover: async (): Promise<MusicDiscoverData> => (await api.get('/music/discover')).data.data,

  getPreview: async (artist: string, album: string): Promise<AlbumPreview> =>
    (await api.get('/music/preview', { params: { artist, album }, timeout: 15000 })).data.data,

  getDismissals: async (): Promise<MusicDismissal[]> => (await api.get('/music/dismissals')).data.data,

  dismiss: async (artistName: string, albumTitle?: string): Promise<MusicDismissal> =>
    (await api.post('/music/dismissals', { artistName, albumTitle })).data.data,

  undoDismissal: async (id: string): Promise<void> => {
    await api.delete(`/music/dismissals/${id}`)
  },
}
