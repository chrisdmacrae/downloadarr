import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  MusicRecommendation,
  MusicRecommendationList,
  RecommendationProfile,
  RecommendationSource,
} from '../../../generated/prisma';
import { RecommendationSourcesService } from '../../recommendations/services/sources.service';
import { RecommendationProfilesService, TopArtist } from '../../recommendations/services/profiles.service';
import { Merged, mergeAcrossProfiles, union } from '../../recommendations/merge';
import { TasteProfileService } from './taste-profile.service';
import { MusicRecommenderService } from './music-recommender.service';
import { albumDismissalKey, artistDismissalKey, nameKey } from '../music-keys';

/** A recommendation as the UI sees it, with the profiles it was built for. */
export type MusicRecommendationView = MusicRecommendation & { profiles: string[] };

const TOP_ARTISTS_STORED = 50;

/**
 * Builds and serves each profile's album lists. The nightly sync and the
 * Refresh button go through RecommendationSyncService, which calls
 * `buildForProfile` for every profile with music accounts.
 */
@Injectable()
export class MusicListsService {
  private readonly logger = new Logger(MusicListsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sources: RecommendationSourcesService,
    private readonly profiles: RecommendationProfilesService,
    private readonly taste: TasteProfileService,
    private readonly recommender: MusicRecommenderService,
  ) {}

  /** Rebuilds one profile's lists from its music accounts. */
  async buildForProfile(profile: RecommendationProfile, sources: RecommendationSource[]): Promise<void> {
    const dismissed = new Set(
      (await this.prisma.musicDismissal.findMany({ where: { profileId: profile.id } })).map((d) => d.key),
    );
    const taste = await this.taste.build(sources);
    for (const source of sources) await this.sources.recordSync(source.id, taste.errors[source.id] ?? null);
    if (taste.synced.length === 0) throw new Error('None of the music accounts could be read');

    const albums = await this.recommender.build(taste, sources, dismissed);
    const generatedAt = new Date();
    const ranks = new Map<MusicRecommendationList, number>();
    const topArtists: TopArtist[] = taste.artists
      .slice(0, TOP_ARTISTS_STORED)
      .map((a) => ({ name: a.name, mbid: a.mbid ?? null, weight: a.weight }));

    await this.prisma.$transaction([
      this.prisma.musicRecommendation.deleteMany({ where: { profileId: profile.id } }),
      this.prisma.musicRecommendation.createMany({
        data: albums.map((album) => {
          const rank = ranks.get(album.list) ?? 0;
          ranks.set(album.list, rank + 1);
          return { ...album, profileId: profile.id, rank, generatedAt };
        }),
      }),
      this.prisma.recommendationProfile.update({
        where: { id: profile.id },
        data: { musicTopArtists: topArtists as unknown as object },
      }),
      // Remember provider IDs, so later syncs skip the lookups.
      ...taste.artists
        .filter((a) => a.mbid || a.deezerId)
        .slice(0, 200)
        .map((artist) =>
          this.prisma.musicArtist.upsert({
            where: { nameKey: artist.key },
            create: { nameKey: artist.key, name: artist.name, mbid: artist.mbid, deezerId: artist.deezerId },
            update: { mbid: artist.mbid ?? undefined, deezerId: artist.deezerId ?? undefined },
          }),
        ),
    ]);
    this.logger.log(`Built ${albums.length} music recommendations for ${profile.name} from ${taste.artists.length} artists`);
  }

  /** Every list for the given profiles, merged when there are several. */
  async lists(profiles: RecommendationProfile[]): Promise<Record<MusicRecommendationList, MusicRecommendationView[]>> {
    const names = new Map(profiles.map((p) => [p.id, p.name]));
    const rows = await this.prisma.musicRecommendation.findMany({
      where: { profileId: { in: profiles.map((p) => p.id) } },
      orderBy: [{ list: 'asc' }, { rank: 'asc' }],
    });
    const byList = Object.fromEntries(
      Object.values(MusicRecommendationList).map((list) => [list, [] as MusicRecommendation[]]),
    ) as Record<MusicRecommendationList, MusicRecommendation[]>;
    for (const row of rows) byList[row.list].push(row);

    const view = (row: Merged<MusicRecommendation>): MusicRecommendationView => {
      const { profileIds, ...rest } = row;
      return { ...rest, profiles: profileIds.map((id) => names.get(id) ?? '') };
    };
    return Object.fromEntries(
      Object.entries(byList).map(([list, items]) => [
        list,
        mergeAcrossProfiles(items, (r) => albumDismissalKey(r.artistName, r.albumTitle), (into, r) => {
          into.reasons = union(into.reasons, r.reasons);
          into.sources = union(into.sources, r.sources);
          into.releaseGroupMbid ??= r.releaseGroupMbid;
          into.coverUrl ??= r.coverUrl;
        }).map(view),
      ]),
    ) as Record<MusicRecommendationList, MusicRecommendationView[]>;
  }

  /** The profiles' top artists, weights summed across profiles. */
  topArtists(profiles: RecommendationProfile[], limit: number): TopArtist[] {
    const totals = new Map<string, TopArtist>();
    for (const profile of profiles) {
      for (const artist of this.profiles.topArtists(profile)) {
        const key = nameKey(artist.name);
        const total = totals.get(key) ?? { name: artist.name, mbid: artist.mbid ?? null, weight: 0 };
        total.weight += artist.weight;
        totals.set(key, total);
      }
    }
    return [...totals.values()].sort((a, b) => b.weight - a.weight).slice(0, limit);
  }

  /**
   * "Not interested" in an artist or one album, for each given profile.
   * Matching recommendations are dropped now rather than at the next sync.
   */
  async dismiss(profiles: RecommendationProfile[], artistName: string, albumTitle?: string) {
    const key = albumTitle ? albumDismissalKey(artistName, albumTitle) : artistDismissalKey(artistName);
    const label = albumTitle ? `${albumTitle} — ${artistName}` : artistName;
    const profileIds = profiles.map((p) => p.id);
    const dismissals = await Promise.all(
      profileIds.map((profileId) =>
        this.prisma.musicDismissal.upsert({
          where: { profileId_key: { profileId, key } },
          create: { profileId, key, label },
          update: {},
        }),
      ),
    );

    const rows = await this.prisma.musicRecommendation.findMany({
      where: { profileId: { in: profileIds }, artistName: { equals: artistName, mode: 'insensitive' } },
      select: { id: true, artistName: true, albumTitle: true },
    });
    const ids = rows
      .filter((row) =>
        albumTitle ? albumDismissalKey(row.artistName, row.albumTitle) === key : artistDismissalKey(row.artistName) === key,
      )
      .map((row) => row.id);
    if (ids.length) await this.prisma.musicRecommendation.deleteMany({ where: { id: { in: ids } } });
    return dismissals;
  }

  /** Dismissal keys for the given profiles; with several, what any of them hid. */
  async dismissedKeys(profiles: RecommendationProfile[]): Promise<Set<string>> {
    const rows = await this.prisma.musicDismissal.findMany({ where: { profileId: { in: profiles.map((p) => p.id) } } });
    return new Set(rows.map((d) => d.key));
  }

  listDismissals(profiles: RecommendationProfile[]) {
    return this.prisma.musicDismissal.findMany({
      where: { profileId: { in: profiles.map((p) => p.id) } },
      orderBy: { createdAt: 'desc' },
      include: { profile: { select: { name: true } } },
    });
  }

  async undoDismissal(id: string): Promise<void> {
    await this.prisma.musicDismissal.deleteMany({ where: { id } });
  }
}
