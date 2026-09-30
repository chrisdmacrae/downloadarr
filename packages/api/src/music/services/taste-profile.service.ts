import { Injectable, Logger } from '@nestjs/common';
import { MusicSource, MusicSourceProvider } from '../../../generated/prisma';
import { ListenBrainzClient } from '../clients/listenbrainz.client';
import { LastFmClient } from '../clients/lastfm.client';
import { DeezerClient } from '../clients/deezer.client';
import { MusicSourcesService } from './music-sources.service';
import { nameKey } from '../music-keys';
import { normalizeByMax, TasteArtist } from '../music-scoring';

export interface TasteProfileArtist extends TasteArtist {
  mbid?: string;
  deezerId?: number;
}

export interface TasteProfile {
  /** Weighted artists, heaviest first. */
  artists: TasteProfileArtist[];
  /** Every artist you have listened to, weighted or not. */
  knownKeys: Set<string>;
  /** Providers that synced, and the error for each that didn't. */
  synced: MusicSourceProvider[];
  errors: Partial<Record<MusicSourceProvider, string>>;
}

/** Recent listening counts double all-time listening. */
const RECENT_WEIGHT = 1;
const ALL_TIME_WEIGHT = 0.5;
const WEIGHTED_COUNT = 100;
const KNOWN_COUNT = 1000;

interface Listen {
  name: string;
  mbid?: string;
  deezerId?: number;
  count: number;
}

/** Deezer has no play counts, so saves stand in for them. */
const DEEZER_FAVORITE_ARTIST = 3;
const DEEZER_FAVORITE_ALBUM = 2;
const DEEZER_FAVORITE_TRACK = 1;

/**
 * Turns listening history into weighted artists. Each provider's lists are
 * scaled so its top artist is 1 before they are combined, so a Last.fm account
 * with ten years of scrobbles doesn't drown out a newer ListenBrainz one.
 */
@Injectable()
export class TasteProfileService {
  private readonly logger = new Logger(TasteProfileService.name);

  constructor(
    private readonly listenBrainz: ListenBrainzClient,
    private readonly lastFm: LastFmClient,
    private readonly deezer: DeezerClient,
    private readonly sources: MusicSourcesService,
  ) {}

  async build(sources: MusicSource[]): Promise<TasteProfile> {
    const weights = new Map<string, { name: string; mbid?: string; deezerId?: number; weight: number }>();
    const knownKeys = new Set<string>();
    const synced: MusicSourceProvider[] = [];
    const errors: TasteProfile['errors'] = {};

    const add = (listens: Listen[], factor: number) => {
      for (const { item, norm } of normalizeByMax(listens, (l) => l.count)) {
        const key = nameKey(item.name);
        if (!key) continue;
        const entry = weights.get(key) ?? { name: item.name, weight: 0 };
        entry.mbid ??= item.mbid;
        entry.deezerId ??= item.deezerId;
        entry.weight += norm * factor;
        weights.set(key, entry);
      }
    };

    for (const source of sources) {
      try {
        const { recent, allTime } = await this.fetchListens(source);
        add(recent.slice(0, WEIGHTED_COUNT), RECENT_WEIGHT);
        add(allTime.slice(0, WEIGHTED_COUNT), ALL_TIME_WEIGHT);
        for (const listen of [...recent, ...allTime]) knownKeys.add(nameKey(listen.name));
        synced.push(source.provider);
      } catch (error) {
        const message = (error as Error).message;
        this.logger.warn(`Could not read ${source.provider} history for ${source.username}: ${message}`);
        errors[source.provider] = message;
      }
    }

    const max = Math.max(0, ...[...weights.values()].map((w) => w.weight));
    const artists = [...weights.entries()]
      .map(([key, w]) => ({
        key,
        name: w.name,
        mbid: w.mbid,
        deezerId: w.deezerId,
        weight: max > 0 ? w.weight / max : 0,
      }))
      .sort((a, b) => b.weight - a.weight);

    knownKeys.delete('');
    return { artists, knownKeys, synced, errors };
  }

  private async fetchListens(source: MusicSource): Promise<{ recent: Listen[]; allTime: Listen[] }> {
    if (source.provider === MusicSourceProvider.LISTENBRAINZ) {
      const [recent, allTime] = [
        await this.listenBrainz.topArtists(source.username, 'year', WEIGHTED_COUNT),
        await this.listenBrainz.topArtists(source.username, 'all_time', KNOWN_COUNT),
      ];
      const toListen = (a: { name: string; mbid?: string; listenCount: number }) => ({
        name: a.name,
        mbid: a.mbid,
        count: a.listenCount,
      });
      return { recent: recent.map(toListen), allTime: allTime.map(toListen) };
    }

    if (source.provider === MusicSourceProvider.DEEZER) return this.deezerListens(Number(source.username));

    const apiKey = this.sources.lastFmApiKey(source);
    if (!apiKey) throw new Error('No Last.fm API key configured');
    const [recent, allTime] = [
      await this.lastFm.topArtists(apiKey, source.username, '12month', WEIGHTED_COUNT),
      await this.lastFm.topArtists(apiKey, source.username, 'overall', KNOWN_COUNT),
    ];
    const toListen = (a: { name: string; mbid?: string; playcount: number }) => ({
      name: a.name,
      mbid: a.mbid,
      count: a.playcount,
    });
    return { recent: recent.map(toListen), allTime: allTime.map(toListen) };
  }

  /**
   * Recent listening is the user's Deezer charts, ranked; all-time is what
   * they've saved, since Deezer shares no play counts.
   */
  private async deezerListens(userId: number): Promise<{ recent: Listen[]; allTime: Listen[] }> {
    const [chartArtists, chartAlbums, favoriteArtists, favoriteAlbums, favoriteTracks] = [
      await this.deezer.userChartArtists(userId),
      await this.deezer.userChartAlbums(userId),
      await this.deezer.userFavoriteArtists(userId),
      await this.deezer.userFavoriteAlbums(userId),
      await this.deezer.userFavoriteTracks(userId),
    ];

    const tally = (entries: Array<{ id?: number; name?: string; points: number }>) => {
      const counts = new Map<string, Listen>();
      for (const { id, name, points } of entries) {
        if (!name) continue;
        const key = nameKey(name);
        const listen = counts.get(key) ?? { name, deezerId: id, count: 0 };
        listen.count += points;
        counts.set(key, listen);
      }
      return [...counts.values()].sort((a, b) => b.count - a.count);
    };

    const recent = tally([
      ...chartArtists.map((a, i) => ({ id: a.id, name: a.name, points: chartArtists.length - i })),
      ...chartAlbums.map((a, i) => ({ id: a.artistId, name: a.artistName, points: (chartAlbums.length - i) / 2 })),
    ]);
    const allTime = tally([
      ...favoriteArtists.map((a) => ({ id: a.id, name: a.name, points: DEEZER_FAVORITE_ARTIST })),
      ...favoriteAlbums.map((a) => ({ id: a.artistId, name: a.artistName, points: DEEZER_FAVORITE_ALBUM })),
      ...favoriteTracks.map((t) => ({ id: t.artistId, name: t.artistName, points: DEEZER_FAVORITE_TRACK })),
    ]);
    return { recent, allTime };
  }
}
