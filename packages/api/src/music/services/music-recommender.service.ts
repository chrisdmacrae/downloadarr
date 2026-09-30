import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { MusicRecommendationList, MusicSource, MusicSourceProvider } from '../../../generated/prisma';
import { ListenBrainzClient } from '../clients/listenbrainz.client';
import { LastFmClient } from '../clients/lastfm.client';
import { DeezerClient } from '../clients/deezer.client';
import { MusicSourcesService } from './music-sources.service';
import { TasteProfile, TasteProfileArtist } from './taste-profile.service';
import { albumDismissalKey, albumKey, artistDismissalKey, coverArtUrl, nameKey } from '../music-keys';
import { normalizeByMax, rankSimilarity, scoreCandidates, SimilarityEdge } from '../music-scoring';

export interface RecommendedAlbum {
  list: MusicRecommendationList;
  artistName: string;
  artistMbid?: string;
  albumTitle: string;
  releaseGroupMbid?: string;
  releaseDate?: string;
  coverUrl?: string;
  score: number;
  reasons: string[];
  sources: string[];
}

const SEED_COUNT = 25;
const SIMILAR_PER_SEED = 30;
const NEW_ARTIST_COUNT = 30;
const FRESH_RELEASE_DAYS = 90;
const LIST_LIMIT = 40;

/**
 * Builds the four music lists from a taste profile. Every provider call is
 * best-effort: a failed lookup drops one candidate or one list, never the sync.
 */
@Injectable()
export class MusicRecommenderService {
  private readonly logger = new Logger(MusicRecommenderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly listenBrainz: ListenBrainzClient,
    private readonly lastFm: LastFmClient,
    private readonly deezer: DeezerClient,
    private readonly sourcesService: MusicSourcesService,
  ) {}

  async build(profile: TasteProfile, sources: MusicSource[], dismissed: Set<string>): Promise<RecommendedAlbum[]> {
    const lb = sources.find((s) => s.provider === MusicSourceProvider.LISTENBRAINZ && profile.synced.includes(s.provider));
    const lf = sources.find((s) => s.provider === MusicSourceProvider.LASTFM && profile.synced.includes(s.provider));
    const lfKey = lf ? this.sourcesService.lastFmApiKey(lf) : null;
    const lbToken = lb?.apiKey ?? null;
    const dz = sources.find((s) => s.provider === MusicSourceProvider.DEEZER && profile.synced.includes(s.provider));
    const deezerUserId = dz ? Number(dz.username) : null;

    const seeds = profile.artists.slice(0, SEED_COUNT);
    const deezerIds = await this.resolveDeezerIds(seeds);

    const isDismissed = (artist: string, album?: string) =>
      dismissed.has(artistDismissalKey(artist)) || (album != null && dismissed.has(albumDismissalKey(artist, album)));

    const lists = await Promise.all([
      this.newArtists(profile, seeds, deezerIds, dismissed, lb?.username, lbToken, lfKey),
      this.freshReleases(profile, seeds, deezerIds, lb?.username),
      lb ? this.weeklyPicks(lb.username) : Promise.resolve([]),
      this.mostPlayed(lb?.username, lf?.username, lfKey, deezerUserId),
      deezerUserId ? this.flow(deezerUserId) : Promise.resolve([]),
      deezerUserId ? this.savedAlbums(deezerUserId) : Promise.resolve([]),
    ]);

    return lists.flatMap((list) => {
      const seen = new Set<string>();
      return list
        .filter((album) => {
          const key = albumDismissalKey(album.artistName, album.albumTitle);
          if (seen.has(key) || isDismissed(album.artistName, album.albumTitle)) return false;
          seen.add(key);
          return true;
        })
        .slice(0, LIST_LIMIT);
    });
  }

  /** Artists your taste points at that you've never played, one album each. */
  private async newArtists(
    profile: TasteProfile,
    seeds: TasteProfileArtist[],
    deezerIds: Map<string, number>,
    dismissed: Set<string>,
    lbUser: string | undefined,
    lbToken: string | null,
    lfKey: string | null,
  ): Promise<RecommendedAlbum[]> {
    const edges: SimilarityEdge[] = [];

    for (const seed of seeds) {
      if (lbUser && seed.mbid) {
        const similar = await this.attempt(`LB similar to ${seed.name}`, () =>
          this.listenBrainz.similarArtists(seed.mbid!, SIMILAR_PER_SEED),
        );
        for (const { item, norm } of normalizeByMax(similar ?? [], (a) => a.score)) {
          edges.push({ seedKey: seed.key, candidate: { key: nameKey(item.name), name: item.name, mbid: item.mbid }, similarity: norm, source: 'listenbrainz' });
        }
      }

      if (lfKey) {
        const similar = await this.attempt(`Last.fm similar to ${seed.name}`, () =>
          this.lastFm.similarArtists(lfKey, seed, SIMILAR_PER_SEED),
        );
        for (const a of similar ?? []) {
          edges.push({ seedKey: seed.key, candidate: { key: nameKey(a.name), name: a.name, mbid: a.mbid }, similarity: a.match, source: 'lastfm' });
        }
      }

      const deezerId = deezerIds.get(seed.key);
      if (deezerId) {
        const related = (await this.attempt(`Deezer related to ${seed.name}`, () => this.deezer.relatedArtists(deezerId, 20))) ?? [];
        related.forEach((a, i) =>
          edges.push({ seedKey: seed.key, candidate: { key: nameKey(a.name), name: a.name }, similarity: rankSimilarity(i, related.length), source: 'deezer' }),
        );
      }
    }

    const dismissedArtists = new Set(
      [...dismissed].filter((key) => key.startsWith('artist:')).map((key) => key.slice('artist:'.length)),
    );
    const scored = scoreCandidates(profile.artists, edges, {
      knownKeys: profile.knownKeys,
      dismissedKeys: dismissedArtists,
      limit: NEW_ARTIST_COUNT,
    });

    const albums: RecommendedAlbum[] = [];
    for (const artist of scored) {
      const album = await this.bestAlbumFor(artist.name, artist.mbid, lbToken, lfKey);
      if (!album) continue;
      albums.push({
        list: MusicRecommendationList.NEW_ARTISTS,
        artistName: artist.name,
        artistMbid: artist.mbid,
        ...album,
        score: artist.score,
        reasons: artist.because.slice(0, 3),
        sources: artist.sources,
      });
    }
    return albums;
  }

  /** The album to suggest for a new artist: their most popular studio album. */
  private async bestAlbumFor(
    artistName: string,
    mbid: string | undefined,
    lbToken: string | null,
    lfKey: string | null,
  ): Promise<Pick<RecommendedAlbum, 'albumTitle' | 'releaseGroupMbid' | 'releaseDate' | 'coverUrl'> | null> {
    if (mbid && lbToken) {
      const lb = await this.attempt(`LB top album for ${artistName}`, () => this.listenBrainz.topAlbumForArtist(mbid, lbToken));
      if (lb) {
        return { albumTitle: lb.title, releaseGroupMbid: lb.releaseGroupMbid, releaseDate: lb.releaseDate, coverUrl: coverArtUrl(lb.caaReleaseMbid) };
      }
    }
    if (lfKey) {
      const lf = await this.attempt(`Last.fm top album for ${artistName}`, () => this.lastFm.topAlbumForArtist(lfKey, artistName));
      if (lf) return { albumTitle: lf.title, coverUrl: lf.imageUrl };
    }
    const artist = await this.attempt(`Deezer artist ${artistName}`, () => this.deezer.findArtist(artistName));
    if (!artist) return null;
    const album = await this.attempt(`Deezer top album for ${artistName}`, () => this.deezer.topAlbum(artist.id));
    return album ? { albumTitle: album.title, coverUrl: album.coverUrl } : null;
  }

  /** Recent albums from artists you listen to, newest first. */
  private async freshReleases(
    profile: TasteProfile,
    seeds: TasteProfileArtist[],
    deezerIds: Map<string, number>,
    lbUser: string | undefined,
  ): Promise<RecommendedAlbum[]> {
    const albums: RecommendedAlbum[] = [];
    const weightOf = new Map(profile.artists.map((a) => [a.key, a.weight]));

    if (lbUser) {
      const fresh = (await this.attempt('LB fresh releases', () => this.listenBrainz.freshReleases(lbUser, FRESH_RELEASE_DAYS))) ?? [];
      for (const r of fresh) {
        albums.push({
          list: MusicRecommendationList.FRESH_RELEASES,
          artistName: r.artistName,
          artistMbid: r.artistMbid,
          albumTitle: r.title,
          releaseGroupMbid: r.releaseGroupMbid,
          releaseDate: r.releaseDate,
          coverUrl: coverArtUrl(r.caaReleaseMbid),
          score: weightOf.get(nameKey(r.artistName)) ?? 0,
          reasons: [],
          sources: ['listenbrainz'],
        });
      }
    }

    // Deezer's discographies catch releases for Last.fm-only setups, and ones
    // MusicBrainz hasn't catalogued yet.
    const cutoff = new Date(Date.now() - FRESH_RELEASE_DAYS * 86_400_000).toISOString().slice(0, 10);
    // Deezer lists pre-releases; only what's out now can be downloaded.
    const today = new Date().toISOString().slice(0, 10);
    for (const seed of seeds) {
      const deezerId = deezerIds.get(seed.key);
      if (!deezerId) continue;
      const discography = (await this.attempt(`Deezer albums for ${seed.name}`, () => this.deezer.artistAlbums(deezerId))) ?? [];
      for (const album of discography) {
        if (!album.releaseDate || album.releaseDate < cutoff || album.releaseDate > today) continue;
        if (!['album', 'ep'].includes(album.recordType ?? '')) continue;
        albums.push({
          list: MusicRecommendationList.FRESH_RELEASES,
          artistName: seed.name,
          artistMbid: seed.mbid,
          albumTitle: album.title,
          releaseDate: album.releaseDate,
          coverUrl: album.coverUrl,
          score: seed.weight,
          reasons: [],
          sources: ['deezer'],
        });
      }
    }

    // ListenBrainz and Deezer often list the same release; keep the first,
    // which carries the MusicBrainz IDs.
    const byAlbum = new Map<string, RecommendedAlbum>();
    for (const album of albums) {
      const key = `${nameKey(album.artistName)}::${albumKey(album.albumTitle)}`;
      const existing = byAlbum.get(key);
      if (existing) {
        existing.sources = [...new Set([...existing.sources, ...album.sources])];
        existing.coverUrl ??= album.coverUrl;
      } else {
        byAlbum.set(key, album);
      }
    }
    return [...byAlbum.values()].sort(
      (a, b) => (b.releaseDate ?? '').localeCompare(a.releaseDate ?? '') || b.score - a.score,
    );
  }

  private async weeklyPicks(lbUser: string): Promise<RecommendedAlbum[]> {
    const albums = (await this.attempt('LB weekly exploration', () => this.listenBrainz.weeklyExplorationAlbums(lbUser))) ?? [];
    return albums.map((a, i) => ({
      list: MusicRecommendationList.WEEKLY_PICKS,
      artistName: a.artistName,
      artistMbid: a.artistMbid,
      albumTitle: a.title,
      coverUrl: coverArtUrl(a.caaReleaseMbid),
      score: rankSimilarity(i, albums.length),
      reasons: [],
      sources: ['listenbrainz'],
    }));
  }

  /** Deezer's Flow mix, reduced to the albums its tracks come from. */
  private async flow(userId: number): Promise<RecommendedAlbum[]> {
    const tracks = (await this.attempt('Deezer flow', () => this.deezer.userFlow(userId))) ?? [];
    const albums = new Map<number, RecommendedAlbum>();
    tracks.forEach((track, i) => {
      if (!track.albumId || !track.albumTitle || albums.has(track.albumId)) return;
      albums.set(track.albumId, {
        list: MusicRecommendationList.FLOW,
        artistName: track.artistName,
        albumTitle: track.albumTitle,
        coverUrl: track.coverUrl,
        score: rankSimilarity(i, tracks.length),
        reasons: [],
        sources: ['deezer'],
      });
    });
    return [...albums.values()];
  }

  /** Albums saved on Deezer, most recently saved first. */
  private async savedAlbums(userId: number): Promise<RecommendedAlbum[]> {
    const albums = (await this.attempt('Deezer saved albums', () => this.deezer.userFavoriteAlbums(userId))) ?? [];
    return albums
      .filter((album) => album.artistName)
      .map((album, i) => ({
        list: MusicRecommendationList.SAVED_ALBUMS,
        artistName: album.artistName!,
        albumTitle: album.title,
        releaseDate: album.releaseDate,
        coverUrl: album.coverUrl,
        score: rankSimilarity(i, albums.length),
        reasons: [],
        sources: ['deezer'],
      }));
  }

  /** Your most played albums over the past year, across providers. */
  private async mostPlayed(
    lbUser: string | undefined,
    lfUser: string | undefined,
    lfKey: string | null,
    deezerUserId: number | null,
  ): Promise<RecommendedAlbum[]> {
    const byAlbum = new Map<string, RecommendedAlbum>();
    const add = (album: Omit<RecommendedAlbum, 'list' | 'reasons' | 'sources'>, source: string) => {
      const key = `${nameKey(album.artistName)}::${albumKey(album.albumTitle)}`;
      const existing = byAlbum.get(key);
      if (existing) {
        existing.score += album.score;
        existing.sources = [...new Set([...existing.sources, source])];
        existing.coverUrl ??= album.coverUrl;
        existing.releaseGroupMbid ??= album.releaseGroupMbid;
      } else {
        byAlbum.set(key, { ...album, list: MusicRecommendationList.MOST_PLAYED, reasons: [], sources: [source] });
      }
    };

    if (lbUser) {
      const top = (await this.attempt('LB top albums', () => this.listenBrainz.topReleaseGroups(lbUser, 'year', 50))) ?? [];
      for (const { item, norm } of normalizeByMax(top, (a) => a.listenCount ?? 0)) {
        add({ artistName: item.artistName, artistMbid: item.artistMbid, albumTitle: item.title, releaseGroupMbid: item.releaseGroupMbid, coverUrl: coverArtUrl(item.caaReleaseMbid), score: norm }, 'listenbrainz');
      }
    }
    if (lfUser && lfKey) {
      const top = (await this.attempt('Last.fm top albums', () => this.lastFm.topAlbums(lfKey, lfUser, '12month', 50))) ?? [];
      for (const { item, norm } of normalizeByMax(top, (a) => a.playcount)) {
        add({ artistName: item.artistName, artistMbid: item.artistMbid, albumTitle: item.title, coverUrl: item.imageUrl, score: norm }, 'lastfm');
      }
    }
    if (deezerUserId) {
      // Deezer charts are ranked without counts.
      const top = (await this.attempt('Deezer chart albums', () => this.deezer.userChartAlbums(deezerUserId))) ?? [];
      top.forEach((album, i) => {
        if (!album.artistName) return;
        add({ artistName: album.artistName, albumTitle: album.title, coverUrl: album.coverUrl, score: rankSimilarity(i, top.length) }, 'deezer');
      });
    }
    return [...byAlbum.values()].sort((a, b) => b.score - a.score);
  }

  /** Deezer artist IDs for the seeds, cached on MusicArtist. */
  private async resolveDeezerIds(seeds: TasteProfileArtist[]): Promise<Map<string, number>> {
    const cached = await this.prisma.musicArtist.findMany({
      where: { nameKey: { in: seeds.map((s) => s.key) }, deezerId: { not: null } },
    });
    const ids = new Map(cached.map((a) => [a.nameKey, a.deezerId!]));
    // Artists that came from a Deezer profile already carry their ID.
    for (const seed of seeds) if (seed.deezerId) ids.set(seed.key, seed.deezerId);

    for (const seed of seeds) {
      if (ids.has(seed.key)) continue;
      const artist = await this.attempt(`Deezer artist ${seed.name}`, () => this.deezer.findArtist(seed.name));
      if (!artist) continue;
      ids.set(seed.key, artist.id);
      await this.prisma.musicArtist.upsert({
        where: { nameKey: seed.key },
        create: { nameKey: seed.key, name: seed.name, mbid: seed.mbid, deezerId: artist.id },
        update: { deezerId: artist.id },
      });
    }
    return ids;
  }

  private async attempt<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
    try {
      return await fn();
    } catch (error) {
      this.logger.debug(`${label} failed: ${(error as Error).message}`);
      return null;
    }
  }
}
