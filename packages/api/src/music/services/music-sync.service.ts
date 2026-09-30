import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service';
import { MusicRecommendation, MusicRecommendationList } from '../../../generated/prisma';
import { MusicSourcesService } from './music-sources.service';
import { TasteProfileService } from './taste-profile.service';
import { MusicRecommenderService } from './music-recommender.service';
import { albumDismissalKey, artistDismissalKey } from '../music-keys';

export interface MusicSyncStatus {
  running: boolean;
  startedAt: Date | null;
  finishedAt: Date | null;
  error: string | null;
}

/**
 * Rebuilds the taste profile and every list. Runs nightly — ListenBrainz
 * regenerates its stats daily and its playlists weekly, so more often buys
 * nothing — and on demand from the Music page.
 */
@Injectable()
export class MusicSyncService {
  private readonly logger = new Logger(MusicSyncService.name);
  private status: MusicSyncStatus = { running: false, startedAt: null, finishedAt: null, error: null };

  constructor(
    private readonly prisma: PrismaService,
    private readonly sources: MusicSourcesService,
    private readonly taste: TasteProfileService,
    private readonly recommender: MusicRecommenderService,
  ) {}

  getStatus(): MusicSyncStatus {
    return this.status;
  }

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async scheduledSync(): Promise<void> {
    await this.sync();
  }

  /** Starts a sync unless one is running. Resolves when it finishes. */
  async sync(): Promise<MusicSyncStatus> {
    if (this.status.running) return this.status;

    const sources = await this.sources.listEnabled();
    if (sources.length === 0) return this.status;

    this.status = { running: true, startedAt: new Date(), finishedAt: null, error: null };
    try {
      const dismissed = new Set((await this.prisma.musicDismissal.findMany()).map((d) => d.key));
      const profile = await this.taste.build(sources);

      for (const source of sources) {
        await this.sources.recordSync(source.provider, profile.errors[source.provider] ?? null);
      }
      if (profile.synced.length === 0) {
        throw new Error('None of your music sources could be read');
      }

      const albums = await this.recommender.build(profile, sources, dismissed);
      const generatedAt = new Date();
      const ranks = new Map<MusicRecommendationList, number>();

      await this.prisma.$transaction([
        this.prisma.musicRecommendation.deleteMany(),
        this.prisma.musicRecommendation.createMany({
          data: albums.map((album) => {
            const rank = ranks.get(album.list) ?? 0;
            ranks.set(album.list, rank + 1);
            return { ...album, rank, generatedAt };
          }),
        }),
        // The taste snapshot: reset, then weight whoever you listen to now.
        this.prisma.musicArtist.updateMany({ data: { tasteWeight: 0 } }),
        ...profile.artists.slice(0, 200).map((artist) =>
          this.prisma.musicArtist.upsert({
            where: { nameKey: artist.key },
            create: {
              nameKey: artist.key,
              name: artist.name,
              mbid: artist.mbid,
              deezerId: artist.deezerId,
              tasteWeight: artist.weight,
            },
            update: {
              name: artist.name,
              mbid: artist.mbid ?? undefined,
              deezerId: artist.deezerId ?? undefined,
              tasteWeight: artist.weight,
            },
          }),
        ),
      ]);

      this.logger.log(`Music sync built ${albums.length} recommendations from ${profile.artists.length} artists`);
      this.status = { ...this.status, running: false, finishedAt: new Date() };
    } catch (error) {
      const message = (error as Error).message;
      this.logger.error(`Music sync failed: ${message}`);
      this.status = { ...this.status, running: false, finishedAt: new Date(), error: message };
    }
    return this.status;
  }

  async lists(): Promise<Record<MusicRecommendationList, MusicRecommendation[]>> {
    const rows = await this.prisma.musicRecommendation.findMany({ orderBy: [{ list: 'asc' }, { rank: 'asc' }] });
    const lists = Object.fromEntries(
      Object.values(MusicRecommendationList).map((list) => [list, [] as MusicRecommendation[]]),
    ) as Record<MusicRecommendationList, MusicRecommendation[]>;
    for (const row of rows) lists[row.list].push(row);
    return lists;
  }

  async topArtists(limit: number) {
    return this.prisma.musicArtist.findMany({
      where: { tasteWeight: { gt: 0 } },
      orderBy: { tasteWeight: 'desc' },
      take: limit,
      select: { name: true, mbid: true, tasteWeight: true },
    });
  }

  /**
   * "Not interested" in an artist or one album. Matching recommendations are
   * dropped now rather than at the next sync.
   */
  async dismiss(artistName: string, albumTitle?: string) {
    const key = albumTitle ? albumDismissalKey(artistName, albumTitle) : artistDismissalKey(artistName);
    const label = albumTitle ? `${albumTitle} — ${artistName}` : artistName;
    const dismissal = await this.prisma.musicDismissal.upsert({
      where: { key },
      create: { key, label },
      update: {},
    });

    const rows = await this.prisma.musicRecommendation.findMany({
      where: { artistName: { equals: artistName, mode: 'insensitive' } },
      select: { id: true, artistName: true, albumTitle: true },
    });
    const ids = rows
      .filter((row) =>
        albumTitle ? albumDismissalKey(row.artistName, row.albumTitle) === key : artistDismissalKey(row.artistName) === key,
      )
      .map((row) => row.id);
    if (ids.length) await this.prisma.musicRecommendation.deleteMany({ where: { id: { in: ids } } });
    return dismissal;
  }

  listDismissals() {
    return this.prisma.musicDismissal.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async undoDismissal(id: string): Promise<void> {
    await this.prisma.musicDismissal.deleteMany({ where: { id } });
  }
}
