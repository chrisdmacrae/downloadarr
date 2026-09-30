import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ThrottledJsonClient } from './json-client';

const API = 'https://api.listenbrainz.org/1';
const LABS = 'https://labs.api.listenbrainz.org';
// The algorithm ListenBrainz's own artist pages use for "similar artists".
const SIMILAR_ARTISTS_ALGORITHM =
  'session_based_days_7500_session_300_contribution_5_threshold_10_limit_100_filter_True_skip_30';

export type StatsRange = 'week' | 'month' | 'quarter' | 'half_yearly' | 'year' | 'all_time';

export interface LbArtistStat {
  name: string;
  mbid?: string;
  listenCount: number;
}

export interface LbAlbum {
  artistName: string;
  artistMbid?: string;
  title: string;
  releaseGroupMbid?: string;
  caaReleaseMbid?: string;
  releaseDate?: string;
  listenCount?: number;
}

export interface LbSimilarArtist {
  name: string;
  mbid: string;
  score: number;
}

/** Artist credits that aren't a real artist to recommend. */
const IGNORED_ARTISTS = new Set(['unknown artist', 'various artists', '[unknown]']);

/**
 * ListenBrainz endpoints. Everything read here is public for any user; only
 * the popularity endpoint demands a user token, which any account can copy
 * from listenbrainz.org/settings.
 */
@Injectable()
export class ListenBrainzClient {
  private readonly logger = new Logger(ListenBrainzClient.name);
  private readonly client: ThrottledJsonClient;

  constructor(http: HttpService) {
    // Anonymous callers get 30 requests per 10 seconds.
    this.client = new ThrottledJsonClient(http, this.logger, 350);
  }

  async userExists(username: string): Promise<boolean> {
    const data = await this.client.get(`${API}/user/${encodeURIComponent(username)}/listen-count`);
    return data != null;
  }

  async topArtists(username: string, range: StatsRange, count: number): Promise<LbArtistStat[]> {
    const data = await this.client.get<any>(`${API}/stats/user/${encodeURIComponent(username)}/artists`, {
      range,
      count,
    });
    return (data?.payload?.artists ?? [])
      .filter((a: any) => a.artist_name && !IGNORED_ARTISTS.has(a.artist_name.toLowerCase()))
      .map((a: any) => ({ name: a.artist_name, mbid: a.artist_mbid ?? undefined, listenCount: a.listen_count ?? 0 }));
  }

  async topReleaseGroups(username: string, range: StatsRange, count: number): Promise<LbAlbum[]> {
    const data = await this.client.get<any>(
      `${API}/stats/user/${encodeURIComponent(username)}/release-groups`,
      { range, count },
    );
    return (data?.payload?.release_groups ?? [])
      .filter((r: any) => r.artist_name && !IGNORED_ARTISTS.has(r.artist_name.toLowerCase()))
      .map((r: any) => ({
        artistName: r.artist_name,
        artistMbid: r.artist_mbids?.[0],
        title: r.release_group_name,
        releaseGroupMbid: r.release_group_mbid ?? undefined,
        caaReleaseMbid: r.caa_release_mbid ?? undefined,
        listenCount: r.listen_count ?? 0,
      }));
  }

  async similarArtists(artistMbid: string, limit: number): Promise<LbSimilarArtist[]> {
    const data = await this.client.get<any[]>(`${LABS}/similar-artists/json`, {
      artist_mbids: artistMbid,
      algorithm: SIMILAR_ARTISTS_ALGORITHM,
    });
    return (Array.isArray(data) ? data : [])
      .filter((a) => a.artist_mbid && a.artist_mbid !== artistMbid && a.name)
      .slice(0, limit)
      .map((a) => ({ name: a.name, mbid: a.artist_mbid, score: Number(a.score) || 0 }));
  }

  /** The artist's most listened-to studio album, by ListenBrainz popularity. */
  async topAlbumForArtist(artistMbid: string, token: string): Promise<LbAlbum | null> {
    const data = await this.client.get<any[]>(
      `${API}/popularity/top-release-groups-for-artist/${artistMbid}`,
      undefined,
      { Authorization: `Token ${token}` },
    );
    const top = (Array.isArray(data) ? data : []).find(
      (r) => r.release_group?.type === 'Album' && r.release_group?.name,
    );
    if (!top) return null;
    return {
      artistName: top.artist?.name,
      artistMbid,
      title: top.release_group.name,
      releaseGroupMbid: top.release_group_mbid,
      caaReleaseMbid: top.release_group.caa_release_mbid ?? top.release?.caa_release_mbid ?? undefined,
      releaseDate: top.release_group.date ?? undefined,
    };
  }

  /** Recent album releases from artists the user listens to. */
  async freshReleases(username: string, days: number): Promise<LbAlbum[]> {
    const data = await this.client.get<any>(`${API}/user/${encodeURIComponent(username)}/fresh_releases`, {
      days,
      past: true,
      future: false,
    });
    return (data?.payload?.releases ?? [])
      .filter(
        (r: any) =>
          ['Album', 'EP'].includes(r.release_group_primary_type) &&
          !r.release_group_secondary_type &&
          r.artist_credit_name &&
          !IGNORED_ARTISTS.has(r.artist_credit_name.toLowerCase()),
      )
      .sort((a: any, b: any) => (b.confidence ?? 0) - (a.confidence ?? 0))
      .map((r: any) => ({
        artistName: r.artist_credit_name,
        artistMbid: r.artist_mbids?.[0],
        title: r.release_name,
        releaseGroupMbid: r.release_group_mbid ?? undefined,
        caaReleaseMbid: r.caa_release_mbid ?? undefined,
        releaseDate: r.release_date ?? undefined,
        listenCount: r.listen_count ?? 0,
      }));
  }

  /**
   * Tracks from the newest "Weekly Exploration" playlist ListenBrainz generated
   * for the user, reduced to the albums they come from.
   */
  async weeklyExplorationAlbums(username: string): Promise<LbAlbum[]> {
    const list = await this.client.get<any>(
      `${API}/user/${encodeURIComponent(username)}/playlists/createdfor`,
      { count: 25 },
    );
    const playlist = (list?.playlists ?? [])
      .map((p: any) => p.playlist)
      .find((p: any) => typeof p?.title === 'string' && p.title.startsWith('Weekly Exploration'));
    if (!playlist?.identifier) return [];

    const id = String(playlist.identifier).split('/').filter(Boolean).pop();
    const full = await this.client.get<any>(`${API}/playlist/${id}`);
    const albums = new Map<string, LbAlbum>();
    for (const track of full?.playlist?.track ?? []) {
      const meta = track.extension?.['https://musicbrainz.org/doc/jspf#track']?.additional_metadata ?? {};
      const artistName = meta.artists?.[0]?.artist_credit_name ?? track.creator;
      if (!track.album || !artistName) continue;
      const key = `${artistName}::${track.album}`;
      if (albums.has(key)) continue;
      albums.set(key, {
        artistName,
        artistMbid: meta.artists?.[0]?.artist_mbid,
        title: track.album,
        caaReleaseMbid: meta.caa_release_mbid ?? undefined,
      });
    }
    return [...albums.values()];
  }
}
