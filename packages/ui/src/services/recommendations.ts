import api, { type SearchResult } from '@/services/api'

export type RecommendationSourceProvider = 'LISTENBRAINZ' | 'LASTFM' | 'DEEZER' | 'SPOTIFY' | 'TRAKT'

/** Accounts whose listening history builds music recommendations. */
export const MUSIC_PROVIDERS: RecommendationSourceProvider[] = ['LISTENBRAINZ', 'LASTFM', 'DEEZER', 'SPOTIFY']

export interface RecommendationProfile {
  id: string
  name: string
  createdAt: string
}

export interface RecommendationSource {
  id: string
  profileId: string
  provider: RecommendationSourceProvider
  /** Deezer: numeric user ID. Spotify: user ID. Trakt: user slug. */
  username: string
  /** Deezer, Spotify or Trakt profile name. */
  displayName: string | null
  enabled: boolean
  /** Last.fm API key, or ListenBrainz token. Write-only. */
  hasApiKey: boolean
  lastSyncedAt: string | null
  lastSyncError: string | null
}

/** The Spotify and Trakt apps every profile signs in through. */
export interface RecommendationApps {
  spotifyClientId: string | null
  spotifyRedirectUri: string | null
  traktClientId: string | null
  hasTraktClientSecret: boolean
}

export interface TraktLogin {
  status: 'pending' | 'connected' | 'expired' | 'denied' | 'error'
  userCode: string
  verificationUrl: string
  expiresAt: string
  error?: string
}

/** A recommended movie or show; `id` is the TMDB ID, as everywhere else. */
export type VideoRecommendation = SearchResult & { profiles: string[] }

export interface VideoRails {
  recommended: VideoRecommendation[]
  watchlist: VideoRecommendation[]
}

export type VideoKind = 'MOVIE' | 'TV'

export interface VideoDismissal {
  id: string
  profileId: string
  profileName: string
  kind: VideoKind
  tmdbId: number
  title: string
  createdAt: string
}

export interface RecommendationSyncStatus {
  running: boolean
  currentProfile: string | null
  startedAt: string | null
  finishedAt: string | null
  error: string | null
}

export const recommendationsApi = {
  getProfiles: async (): Promise<RecommendationProfile[]> => (await api.get('/recommendations/profiles')).data.data,

  createProfile: async (name: string): Promise<RecommendationProfile> =>
    (await api.post('/recommendations/profiles', { name })).data.data,

  renameProfile: async (id: string, name: string): Promise<RecommendationProfile> =>
    (await api.patch(`/recommendations/profiles/${id}`, { name })).data.data,

  deleteProfile: async (id: string): Promise<void> => {
    await api.delete(`/recommendations/profiles/${id}`)
  },

  getSources: async (): Promise<RecommendationSource[]> => (await api.get('/recommendations/sources')).data.data,

  saveSource: async (
    profileId: string,
    provider: RecommendationSourceProvider,
    body: { username: string; apiKey?: string; enabled?: boolean }
  ): Promise<RecommendationSource> =>
    // Validating the account calls out to the provider; allow for a slow one.
    (await api.put(`/recommendations/profiles/${profileId}/sources/${provider}`, body, { timeout: 20000 })).data.data,

  removeSource: async (profileId: string, provider: RecommendationSourceProvider): Promise<void> => {
    await api.delete(`/recommendations/profiles/${profileId}/sources/${provider}`)
  },

  getApps: async (): Promise<RecommendationApps> => (await api.get('/recommendations/apps')).data.data,

  /** Omitted fields keep their value; "" clears one. */
  saveApps: async (body: Partial<Record<'spotifyClientId' | 'spotifyRedirectUri' | 'traktClientId' | 'traktClientSecret', string>>): Promise<RecommendationApps> =>
    (await api.put('/recommendations/apps', body)).data.data,

  /** Returns the Spotify sign-in address to send the browser to. */
  startSpotifyAuth: async (profileId: string, returnTo: string): Promise<string> =>
    (await api.post(`/recommendations/profiles/${profileId}/spotify/authorize`, { returnTo })).data.data.authorizeUrl,

  /** The API's Spotify callback, as the browser reaches it from here. */
  spotifyCallbackUrl: (): string =>
    new URL(`${api.defaults.baseURL ?? ''}/music/spotify/callback`, window.location.origin).toString(),

  /** Starts a device login; the person enters `userCode` at `verificationUrl`. */
  startTraktLogin: async (profileId: string): Promise<TraktLogin> =>
    (await api.post(`/recommendations/profiles/${profileId}/trakt/device`)).data.data,

  getTraktLogin: async (profileId: string): Promise<TraktLogin | null> =>
    (await api.get(`/recommendations/profiles/${profileId}/trakt/device`)).data.data,

  cancelTraktLogin: async (profileId: string): Promise<void> => {
    await api.delete(`/recommendations/profiles/${profileId}/trakt/device`)
  },

  /** Omit `profileId` for every profile, merged. */
  getVideoRails: async (kind: VideoKind, profileId?: string): Promise<VideoRails> =>
    (await api.get(`/recommendations/${kind === 'MOVIE' ? 'movies' : 'tv'}`, { params: { profileId } })).data.data,

  /** Omit `profileId` to dismiss for every profile. */
  dismissVideo: async (body: { kind: VideoKind; tmdbId: number; title: string; profileId?: string }): Promise<void> => {
    await api.post('/recommendations/video-dismissals', body)
  },

  getVideoDismissals: async (profileId?: string): Promise<VideoDismissal[]> =>
    (await api.get('/recommendations/video-dismissals', { params: { profileId } })).data.data,

  undoVideoDismissal: async (id: string): Promise<void> => {
    await api.delete(`/recommendations/video-dismissals/${id}`)
  },

  startSync: async (profileId?: string): Promise<RecommendationSyncStatus> =>
    (await api.post('/recommendations/sync', undefined, { params: { profileId } })).data.data,

  getSyncStatus: async (): Promise<RecommendationSyncStatus> => (await api.get('/recommendations/sync/status')).data.data,
}
