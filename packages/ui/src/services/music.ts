import api from '@/services/api'

export type MusicList =
  | 'NEW_ARTISTS'
  | 'FRESH_RELEASES'
  | 'WEEKLY_PICKS'
  | 'WEEKLY_JAMS'
  | 'DAILY_JAMS'
  | 'FLOW'
  | 'MOST_PLAYED'
  | 'SAVED_ALBUMS'

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
  /** Names of the profiles it was recommended to. */
  profiles: string[]
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
  profileId: string
  profileName: string
  key: string
  label: string
  createdAt: string
}

export const musicApi = {
  /** Omit `profileId` for every profile, merged. */
  getDiscover: async (profileId?: string): Promise<MusicDiscoverData> =>
    (await api.get('/music/discover', { params: { profileId } })).data.data,

  getPreview: async (artist: string, album: string): Promise<AlbumPreview> =>
    (await api.get('/music/preview', { params: { artist, album }, timeout: 15000 })).data.data,

  /** Matching ListenBrainz tracks on Deezer takes a few seconds. */
  getArtistRadio: async (artist: string, profileId?: string): Promise<ArtistRadio> =>
    (await api.get('/music/radio', { params: { artist, profileId }, timeout: 30000 })).data.data,

  getDismissals: async (profileId?: string): Promise<MusicDismissal[]> =>
    (await api.get('/music/dismissals', { params: { profileId } })).data.data,

  /** Omit `profileId` to dismiss for every profile. */
  dismiss: async (artistName: string, albumTitle?: string, profileId?: string): Promise<MusicDismissal[]> =>
    (await api.post('/music/dismissals', { artistName, albumTitle, profileId })).data.data,

  undoDismissal: async (id: string): Promise<void> => {
    await api.delete(`/music/dismissals/${id}`)
  },
}
