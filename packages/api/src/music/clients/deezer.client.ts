import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ProviderError, ThrottledJsonClient } from './json-client';
import { albumKey, nameKey } from '../music-keys';

const API = 'https://api.deezer.com';

export interface DeezerArtist {
  id: number;
  name: string;
}

export interface DeezerUser {
  id: number;
  name: string;
}

export interface DeezerAlbum {
  id: number;
  title: string;
  artistName?: string;
  artistId?: number;
  recordType?: string;
  releaseDate?: string;
  coverUrl?: string;
}

export interface DeezerTrack {
  id: number;
  title: string;
  artistName: string;
  artistId?: number;
  albumTitle?: string;
  albumId?: number;
  coverUrl?: string;
  durationSeconds: number;
  position?: number;
  disc?: number;
  /** 30-second MP3. Signed and short-lived: never cache it. */
  previewUrl?: string;
}

/**
 * Pulls the numeric user ID out of what people paste: the ID itself, or a
 * profile URL like https://www.deezer.com/en/profile/123456.
 */
export function parseDeezerProfileId(input: string): number | null {
  const trimmed = input.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  const match = trimmed.match(/deezer\.com\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?profile\/(\d+)/i);
  return match ? Number(match[1]) : null;
}

/**
 * Titles of compilations and live records: a poor first listen, and top
 * tracks often land on them because they collect the hits.
 */
const COMPILATION = /\b(best of|greatest hits|hits|collection|anthology|essentials?|the very best|live|in concert|remixes|epics)\b/i;

const toAlbum = (a: any): DeezerAlbum => ({
  id: a.id,
  title: a.title,
  artistName: a.artist?.name,
  artistId: a.artist?.id,
  recordType: a.record_type,
  releaseDate: a.release_date,
  coverUrl: a.cover_xl || a.cover_big || undefined,
});

const toTrack = (t: any): DeezerTrack => ({
  id: t.id,
  title: t.title,
  artistName: t.artist?.name,
  artistId: t.artist?.id,
  albumTitle: t.album?.title,
  albumId: t.album?.id,
  coverUrl: t.album?.cover_xl || t.album?.cover_big || undefined,
  durationSeconds: t.duration ?? 0,
  position: t.track_position,
  disc: t.disk_number,
  previewUrl: t.preview || undefined,
});

/**
 * Deezer's public, unauthenticated catalog API: artist search, related artists,
 * discographies and 30-second previews. Deezer stopped issuing app IDs, so
 * nothing here needs one.
 */
@Injectable()
export class DeezerClient {
  private readonly logger = new Logger(DeezerClient.name);
  private readonly client: ThrottledJsonClient;

  constructor(private readonly http: HttpService) {
    // Deezer allows 50 requests per 5 seconds.
    this.client = new ThrottledJsonClient(http, this.logger, 120);
  }

  /**
   * Resolves a pasted ID, profile URL or link.deezer.com share link to a user
   * ID. Share links are followed to find the profile URL they point at.
   */
  async resolveProfileId(input: string): Promise<number | null> {
    const direct = parseDeezerProfileId(input);
    if (direct != null) return direct;
    if (!/^https?:\/\/(link\.deezer\.com|deezer\.page\.link)\//i.test(input.trim())) return null;
    try {
      const response = await firstValueFrom(
        this.http.get(input.trim(), { maxRedirects: 5, timeout: 10000, responseType: 'text' }),
      );
      const finalUrl: string = response.request?.res?.responseUrl ?? '';
      return parseDeezerProfileId(finalUrl);
    } catch {
      return null;
    }
  }

  async user(userId: number): Promise<DeezerUser | null> {
    const data = await this.get(`/user/${userId}`);
    return data?.id ? { id: data.id, name: data.name } : null;
  }

  /** Walks a paginated list up to `max` items. */
  private async paged(path: string, max: number): Promise<any[]> {
    const items: any[] = [];
    while (items.length < max) {
      const data = await this.get(path, { index: items.length, limit: Math.min(100, max - items.length) });
      const page: any[] = data?.data ?? [];
      items.push(...page);
      if (page.length === 0 || !data?.next) break;
    }
    return items;
  }

  /** The user's most played artists lately. Deezer returns at most 20. */
  async userChartArtists(userId: number): Promise<DeezerArtist[]> {
    const data = await this.get(`/user/${userId}/charts/artists`, { limit: 50 });
    return (data?.data ?? []).map((a: any) => ({ id: a.id, name: a.name }));
  }

  async userChartAlbums(userId: number): Promise<DeezerAlbum[]> {
    const data = await this.get(`/user/${userId}/charts/albums`, { limit: 50 });
    return (data?.data ?? []).map(toAlbum);
  }

  async userFavoriteArtists(userId: number, max = 500): Promise<DeezerArtist[]> {
    return (await this.paged(`/user/${userId}/artists`, max)).map((a) => ({ id: a.id, name: a.name }));
  }

  /** Favourite albums, most recently added first. */
  async userFavoriteAlbums(userId: number, max = 500): Promise<DeezerAlbum[]> {
    const albums = await this.paged(`/user/${userId}/albums`, max);
    return albums.sort((a, b) => (b.time_add ?? 0) - (a.time_add ?? 0)).map(toAlbum);
  }

  async userFavoriteTracks(userId: number, max = 1000): Promise<DeezerTrack[]> {
    return (await this.paged(`/user/${userId}/tracks`, max)).map(toTrack);
  }

  /** Deezer's personal Flow mix for the user. */
  async userFlow(userId: number): Promise<DeezerTrack[]> {
    const data = await this.get(`/user/${userId}/flow`, { limit: 100 });
    return (data?.data ?? []).map(toTrack);
  }

  /** Deezer reports errors, including quota errors, inside a 200. */
  private async get(path: string, params?: Record<string, string | number>) {
    const data = await this.client.get<any>(`${API}${path}`, params);
    if (data?.error) {
      if (data.error.code === 800) return null; // "no data"
      throw new ProviderError(`Deezer: ${data.error.message ?? data.error.type}`);
    }
    return data;
  }

  async findArtist(name: string): Promise<DeezerArtist | null> {
    const data = await this.get('/search/artist', { q: name, limit: 5 });
    const results: any[] = data?.data ?? [];
    const exact = results.find((a) => nameKey(a.name) === nameKey(name));
    return exact ? { id: exact.id, name: exact.name } : null;
  }

  async relatedArtists(artistId: number, limit: number): Promise<DeezerArtist[]> {
    const data = await this.get(`/artist/${artistId}/related`, { limit });
    return (data?.data ?? []).map((a: any) => ({ id: a.id, name: a.name }));
  }

  /** Deezer's radio for an artist: their tracks mixed with similar artists'. */
  async artistRadio(artistId: number, limit = 50): Promise<DeezerTrack[]> {
    const data = await this.get(`/artist/${artistId}/radio`, { limit });
    return (data?.data ?? []).map(toTrack);
  }

  /** Finds a track by artist and title, for its album and preview. */
  async findTrack(artistName: string, title: string): Promise<DeezerTrack | null> {
    // Unlike albums, the strict artist:"" track:"" form finds nothing for tracks.
    const data = await this.get('/search/track', { q: `${artistName} ${title}`, limit: 10 });
    const results: any[] = data?.data ?? [];
    const sameArtist = results.filter((t) => nameKey(t.artist?.name ?? '') === nameKey(artistName));
    const match =
      sameArtist.find((t) => albumKey(t.title) === albumKey(title)) ??
      sameArtist.find((t) => albumKey(t.title).startsWith(albumKey(title)));
    return match ? toTrack(match) : null;
  }

  async artistAlbums(artistId: number): Promise<DeezerAlbum[]> {
    const data = await this.get(`/artist/${artistId}/albums`, { limit: 100 });
    return (data?.data ?? []).map(toAlbum);
  }

  /**
   * The album the artist's most played tracks come from, skipping singles
   * (an album named after its track). Deezer has no album popularity, so this
   * stands in for "their best-known album".
   */
  async topAlbum(artistId: number): Promise<DeezerAlbum | null> {
    const data = await this.get(`/artist/${artistId}/top`, { limit: 15 });
    const counts = new Map<number, { album: any; count: number }>();
    for (const track of data?.data ?? []) {
      const album = track.album;
      if (!album?.id || albumKey(album.title) === albumKey(track.title) || COMPILATION.test(album.title)) continue;
      const entry = counts.get(album.id) ?? { album, count: 0 };
      entry.count += 1;
      counts.set(album.id, entry);
    }
    // Map iteration keeps first-seen order, so ties go to the higher track.
    const best = [...counts.values()].sort((a, b) => b.count - a.count)[0]?.album;
    return best
      ? { id: best.id, title: best.title, coverUrl: best.cover_xl || best.cover_big || undefined }
      : null;
  }

  /** Finds an album by artist and title, preferring an exact title match. */
  async findAlbum(artistName: string, albumTitle: string): Promise<DeezerAlbum | null> {
    const strict = await this.get('/search/album', {
      q: `artist:"${artistName}" album:"${albumTitle}"`,
      limit: 10,
    });
    let results: any[] = strict?.data ?? [];
    if (results.length === 0) {
      const loose = await this.get('/search/album', { q: `${artistName} ${albumTitle}`, limit: 10 });
      results = loose?.data ?? [];
    }

    const sameArtist = results.filter((a) => nameKey(a.artist?.name ?? '') === nameKey(artistName));
    const match =
      sameArtist.find((a) => albumKey(a.title) === albumKey(albumTitle)) ??
      sameArtist.find((a) => albumKey(a.title).includes(albumKey(albumTitle)));
    if (!match) return null;
    return {
      id: match.id,
      title: match.title,
      artistName: match.artist?.name,
      recordType: match.record_type,
      coverUrl: match.cover_xl || match.cover_big || undefined,
    };
  }

  /** Free-text album search. It matches artist names too, so "radiohead" finds their albums. */
  async searchAlbums(query: string, limit = 50): Promise<DeezerAlbum[]> {
    const data = await this.get('/search/album', { q: query, limit });
    return (data?.data ?? []).map(toAlbum);
  }

  /** Deezer's worldwide album chart. */
  async chartAlbums(limit = 50): Promise<DeezerAlbum[]> {
    const data = await this.get('/chart/0/albums', { limit });
    return (data?.data ?? []).map(toAlbum);
  }

  async albumTracks(albumId: number): Promise<DeezerTrack[]> {
    const data = await this.get(`/album/${albumId}/tracks`, { limit: 100 });
    return (data?.data ?? []).map(toTrack);
  }
}
