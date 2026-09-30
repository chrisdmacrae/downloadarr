import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  RecommendationProfile,
  RecommendationSource,
  VideoKind,
  VideoRecommendation,
  VideoRecommendationList,
} from '../../../generated/prisma';
import { TmdbService } from '../../discovery/services/tmdb.service';
import { SearchResult } from '../../discovery/interfaces/external-api.interface';
import { TraktClient, TraktKind, TraktTitle } from '../clients/trakt.client';
import { TraktAuthService } from './trakt-auth.service';
import { RecommendationSourcesService } from './sources.service';
import { mergeAcrossProfiles } from '../merge';

/** A title as the Movies and TV pages see it: a search result, plus who it's for. */
export type VideoRecommendationView = SearchResult & { profiles: string[] };

export interface VideoRails {
  recommended: VideoRecommendationView[];
  watchlist: VideoRecommendationView[];
}

const RECOMMENDED_COUNT = 40;
const WATCHLIST_COUNT = 60;
const TRAKT_KIND: Record<VideoKind, TraktKind> = { MOVIE: 'movies', TV: 'shows' };

/**
 * Movie and TV recommendations from each profile's Trakt account: Trakt's
 * personal recommendations and the watchlist. Artwork and facts come from
 * TMDB, which also gives the TMDB IDs the request flow uses.
 */
@Injectable()
export class VideoRecommendationsService {
  private readonly logger = new Logger(VideoRecommendationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly trakt: TraktClient,
    private readonly traktAuth: TraktAuthService,
    private readonly tmdb: TmdbService,
    private readonly sources: RecommendationSourcesService,
  ) {}

  /** Rebuilds one profile's movie and TV rails from its Trakt account. */
  async buildForProfile(profile: RecommendationProfile, source: RecommendationSource): Promise<void> {
    try {
      const accessToken = await this.traktAuth.accessToken(source);
      const { clientId } = await this.traktAuth.credentials();
      const dismissed = await this.prisma.videoDismissal.findMany({ where: { profileId: profile.id } });
      const isDismissed = (kind: VideoKind, tmdbId: number) =>
        dismissed.some((d) => d.kind === kind && d.tmdbId === tmdbId);

      const rows: Array<Omit<VideoRecommendation, 'id' | 'generatedAt'>> = [];
      for (const kind of [VideoKind.MOVIE, VideoKind.TV]) {
        const traktKind = TRAKT_KIND[kind];
        const lists: Array<[VideoRecommendationList, TraktTitle[]]> = [
          [VideoRecommendationList.RECOMMENDED, await this.trakt.recommendations(clientId, accessToken, traktKind, RECOMMENDED_COUNT)],
          [VideoRecommendationList.WATCHLIST, await this.trakt.watchlist(clientId, accessToken, traktKind, WATCHLIST_COUNT)],
        ];
        for (const [list, titles] of lists) {
          let rank = 0;
          for (const title of titles) {
            const tmdbId = title.ids.tmdb;
            if (!tmdbId || isDismissed(kind, tmdbId)) continue;
            const summary = kind === VideoKind.MOVIE ? await this.tmdb.getMovieSummary(tmdbId) : await this.tmdb.getTvSummary(tmdbId);
            rows.push(toRow(profile.id, kind, list, rank, title, summary));
            rank += 1;
          }
        }
      }

      const generatedAt = new Date();
      await this.prisma.$transaction([
        this.prisma.videoRecommendation.deleteMany({ where: { profileId: profile.id } }),
        this.prisma.videoRecommendation.createMany({ data: rows.map((row) => ({ ...row, generatedAt })) }),
      ]);
      await this.sources.recordSync(source.id, null);
      this.logger.log(`Built ${rows.length} movie and TV recommendations for ${profile.name}`);
    } catch (error) {
      await this.sources.recordSync(source.id, (error as Error).message);
      throw error;
    }
  }

  /** A kind's rails for the given profiles, merged when there are several. */
  async rails(profiles: RecommendationProfile[], kind: VideoKind): Promise<VideoRails> {
    const names = new Map(profiles.map((p) => [p.id, p.name]));
    const rows = await this.prisma.videoRecommendation.findMany({
      where: { profileId: { in: profiles.map((p) => p.id) }, kind },
      orderBy: { rank: 'asc' },
    });
    const rail = (list: VideoRecommendationList) =>
      mergeAcrossProfiles(
        rows.filter((r) => r.list === list),
        (r) => String(r.tmdbId),
      ).map(({ profileIds, ...row }) => ({ ...toSearchResult(row), profiles: profileIds.map((id) => names.get(id) ?? '') }));
    return { recommended: rail(VideoRecommendationList.RECOMMENDED), watchlist: rail(VideoRecommendationList.WATCHLIST) };
  }

  /** "Not interested" in a title, for each given profile. Drops it from the rails now. */
  async dismiss(profiles: RecommendationProfile[], kind: VideoKind, tmdbId: number, title: string): Promise<void> {
    const profileIds = profiles.map((p) => p.id);
    await this.prisma.$transaction([
      ...profileIds.map((profileId) =>
        this.prisma.videoDismissal.upsert({
          where: { profileId_kind_tmdbId: { profileId, kind, tmdbId } },
          create: { profileId, kind, tmdbId, title },
          update: {},
        }),
      ),
      this.prisma.videoRecommendation.deleteMany({ where: { profileId: { in: profileIds }, kind, tmdbId } }),
    ]);
  }

  listDismissals(profiles: RecommendationProfile[]) {
    return this.prisma.videoDismissal.findMany({
      where: { profileId: { in: profiles.map((p) => p.id) } },
      orderBy: { createdAt: 'desc' },
      include: { profile: { select: { name: true } } },
    });
  }

  async undoDismissal(id: string): Promise<void> {
    await this.prisma.videoDismissal.deleteMany({ where: { id } });
  }
}

export function toRow(
  profileId: string,
  kind: VideoKind,
  list: VideoRecommendationList,
  rank: number,
  title: TraktTitle,
  summary: SearchResult | null,
): Omit<VideoRecommendation, 'id' | 'generatedAt'> {
  return {
    profileId,
    kind,
    list,
    rank,
    score: 0,
    tmdbId: title.ids.tmdb!,
    traktId: title.ids.trakt ?? null,
    imdbId: title.ids.imdb ?? null,
    // Trakt's title and year when TMDB can't be reached, so the rail still fills.
    title: summary?.title ?? title.title,
    year: summary?.year ?? title.year ?? null,
    poster: summary?.poster ?? null,
    backdrop: summary?.backdrop ?? null,
    overview: summary?.overview ?? null,
    rating: summary?.rating ?? null,
    genres: summary?.genres ?? [],
  };
}

export function toSearchResult(row: Omit<VideoRecommendation, 'id' | 'generatedAt' | 'profileId'> & Partial<VideoRecommendation>): SearchResult {
  return {
    id: String(row.tmdbId),
    title: row.title,
    year: row.year ?? undefined,
    poster: row.poster ?? undefined,
    backdrop: row.backdrop ?? undefined,
    overview: row.overview ?? undefined,
    type: row.kind === VideoKind.MOVIE ? 'movie' : 'tv',
    rating: row.rating ?? undefined,
    genres: row.genres.length ? row.genres : undefined,
  };
}
