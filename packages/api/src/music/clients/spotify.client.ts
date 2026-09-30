import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { createHash, randomBytes } from 'crypto';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import { ProviderError, ThrottledJsonClient } from './json-client';

const ACCOUNTS = 'https://accounts.spotify.com';
const API = 'https://api.spotify.com/v1';

/** Read-only scopes: everything the taste profile and lists use. */
export const SPOTIFY_SCOPES = [
  'user-top-read',
  'user-follow-read',
  'user-library-read',
  'playlist-read-private',
  'user-read-recently-played',
];

export interface PkcePair {
  verifier: string;
  challenge: string;
}

export function createPkcePair(): PkcePair {
  const verifier = randomBytes(64).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

export function buildAuthorizeUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
  challenge: string;
}): string {
  const url = new URL(`${ACCOUNTS}/authorize`);
  url.search = new URLSearchParams({
    client_id: params.clientId,
    response_type: 'code',
    redirect_uri: params.redirectUri,
    state: params.state,
    scope: SPOTIFY_SCOPES.join(' '),
    code_challenge_method: 'S256',
    code_challenge: params.challenge,
  }).toString();
  return url.toString();
}

export interface SpotifyTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
}

export interface SpotifyArtist {
  id: string;
  name: string;
}

export interface SpotifyAlbum {
  id: string;
  title: string;
  artistName?: string;
  artistId?: string;
  albumType?: string;
  releaseDate?: string;
  coverUrl?: string;
  upc?: string;
}

export interface SpotifyTrack {
  id: string;
  title: string;
  artistName?: string;
  artistId?: string;
  album?: SpotifyAlbum;
  isrc?: string;
}

const toAlbum = (a: any): SpotifyAlbum => ({
  id: a.id,
  title: a.name,
  artistName: a.artists?.[0]?.name,
  artistId: a.artists?.[0]?.id,
  albumType: a.album_type,
  releaseDate: a.release_date,
  coverUrl: a.images?.[0]?.url,
  upc: a.external_ids?.upc,
});

const toTrack = (t: any): SpotifyTrack => ({
  id: t.id,
  title: t.name,
  artistName: t.artists?.[0]?.name,
  artistId: t.artists?.[0]?.id,
  album: t.album ? toAlbum(t.album) : undefined,
  isrc: t.external_ids?.isrc,
});

/**
 * Spotify's Web API for one user's library. Apps in development mode lost
 * related artists, recommendations, top tracks and new releases in 2026, so
 * Spotify is a taste source only; recommendations come from the others.
 */
@Injectable()
export class SpotifyClient {
  private readonly logger = new Logger(SpotifyClient.name);
  private readonly client: ThrottledJsonClient;

  constructor(private readonly http: HttpService) {
    this.client = new ThrottledJsonClient(http, this.logger, 100);
  }

  private async token(body: Record<string, string>): Promise<SpotifyTokens> {
    try {
      const response = await firstValueFrom(
        this.http.post(`${ACCOUNTS}/api/token`, new URLSearchParams(body).toString(), {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 15000,
        }),
      );
      const data = response.data;
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: new Date(Date.now() + (data.expires_in ?? 3600) * 1000),
      };
    } catch (error) {
      const data = (error as AxiosError<any>).response?.data;
      const detail = data?.error_description ?? data?.error ?? (error as Error).message;
      throw new ProviderError(`Spotify: ${detail}`, (error as AxiosError).response?.status);
    }
  }

  exchangeCode(params: { clientId: string; code: string; redirectUri: string; verifier: string }) {
    return this.token({
      grant_type: 'authorization_code',
      code: params.code,
      redirect_uri: params.redirectUri,
      client_id: params.clientId,
      code_verifier: params.verifier,
    });
  }

  refresh(clientId: string, refreshToken: string) {
    return this.token({ grant_type: 'refresh_token', refresh_token: refreshToken, client_id: clientId });
  }

  private get<T>(accessToken: string, pathOrUrl: string, params?: Record<string, string | number>) {
    const url = pathOrUrl.startsWith('http') ? pathOrUrl : `${API}${pathOrUrl}`;
    return this.client.get<T>(url, params, { Authorization: `Bearer ${accessToken}` });
  }

  /** Follows `next` links up to `max` items. */
  private async paged(accessToken: string, path: string, max: number, key?: string): Promise<any[]> {
    const items: any[] = [];
    let next: string | null = `${API}${path}${path.includes('?') ? '&' : '?'}limit=50`;
    while (next && items.length < max) {
      const data: any = await this.get(accessToken, next);
      const page = key ? data?.[key] : data;
      items.push(...(page?.items ?? []));
      next = page?.next ?? null;
    }
    return items.slice(0, max);
  }

  async me(accessToken: string): Promise<{ id: string; displayName?: string }> {
    const data = await this.get<any>(accessToken, '/me');
    if (!data?.id) throw new ProviderError('Spotify returned no profile');
    return { id: data.id, displayName: data.display_name ?? undefined };
  }

  async topArtists(accessToken: string, range: 'short_term' | 'medium_term' | 'long_term'): Promise<SpotifyArtist[]> {
    const data = await this.get<any>(accessToken, '/me/top/artists', { time_range: range, limit: 50 });
    return (data?.items ?? []).map((a: any) => ({ id: a.id, name: a.name }));
  }

  async followedArtists(accessToken: string, max = 500): Promise<SpotifyArtist[]> {
    const items = await this.paged(accessToken, '/me/following?type=artist', max, 'artists');
    return items.map((a) => ({ id: a.id, name: a.name }));
  }

  /** Saved albums, most recently saved first. */
  async savedAlbums(accessToken: string, max = 500): Promise<SpotifyAlbum[]> {
    const items = await this.paged(accessToken, '/me/albums', max);
    return items.filter((i) => i.album).map((i) => toAlbum(i.album));
  }

  async savedTracks(accessToken: string, max = 1000): Promise<SpotifyTrack[]> {
    const items = await this.paged(accessToken, '/me/tracks', max);
    return items.filter((i) => i.track).map((i) => toTrack(i.track));
  }

  /** Tracks across the user's own playlists, capped per playlist and overall. */
  async playlistTracks(accessToken: string, userId: string, maxPlaylists = 30, maxTracks = 1500): Promise<SpotifyTrack[]> {
    const playlists = (await this.paged(accessToken, '/me/playlists', 200))
      .filter((p) => p?.owner?.id === userId)
      .slice(0, maxPlaylists);
    const tracks: SpotifyTrack[] = [];
    for (const playlist of playlists) {
      if (tracks.length >= maxTracks) break;
      const items = await this.paged(accessToken, `/playlists/${playlist.id}/items`, 200).catch(() => []);
      for (const item of items) {
        // Renamed from `track` in 2026; accept either.
        const track = item?.item ?? item?.track;
        if (track?.type === 'track' || track?.album) tracks.push(toTrack(track));
      }
    }
    return tracks.slice(0, maxTracks);
  }
}

/**
 * Spotify only accepts HTTPS redirects, or HTTP on a loopback address for
 * local development.
 */
export function isValidRedirectUri(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || (url.protocol === 'http:' && ['127.0.0.1', '[::1]'].includes(url.hostname));
  } catch {
    return false;
  }
}

export function isValidSpotifyClientId(value: string): boolean {
  return /^[0-9a-f]{32}$/i.test(value);
}
