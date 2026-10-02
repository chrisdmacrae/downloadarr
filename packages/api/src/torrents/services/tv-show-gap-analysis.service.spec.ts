import { TvShowGapAnalysisService } from './tv-show-gap-analysis.service';
import { ContentType, EpisodeStatus } from '../../../generated/prisma';

describe('TvShowGapAnalysisService', () => {
  const day = 24 * 60 * 60 * 1000;
  const aired = new Date(Date.now() - 30 * day);
  const upcoming = new Date(Date.now() + 30 * day);

  const episode = (episodeNumber: number, status: EpisodeStatus, airDate: Date | null) => ({ episodeNumber, status, airDate });

  const setup = (tvShowSeasons: any[]) => {
    const prisma: any = {
      requestedTorrent: {
        findUnique: jest.fn(async () => ({
          id: 'request-1',
          title: 'Severance',
          tmdbId: 95396,
          contentType: ContentType.TV_SHOW,
          totalSeasons: tvShowSeasons.length,
          tvShowSeasons,
        })),
      },
    };
    const releaseValidator = { isEpisodeReleased: jest.fn(async () => false), isSeasonComplete: jest.fn(async () => true) };
    return { service: new TvShowGapAnalysisService(prisma, releaseValidator as any), releaseValidator };
  };

  it('needs nothing when the only gaps are episodes that have not aired', async () => {
    const { service } = setup([
      {
        seasonNumber: 1,
        totalEpisodes: 2,
        episodes: [episode(1, EpisodeStatus.COMPLETED, aired), episode(2, EpisodeStatus.COMPLETED, aired)],
      },
      {
        seasonNumber: 2,
        totalEpisodes: 3,
        episodes: [
          episode(1, EpisodeStatus.COMPLETED, aired),
          episode(2, EpisodeStatus.PENDING, upcoming),
          episode(3, EpisodeStatus.PENDING, null),
        ],
      },
      // Announced, nothing aired, nothing downloaded: not a gap yet
      { seasonNumber: 3, totalEpisodes: 2, episodes: [episode(1, EpisodeStatus.PENDING, upcoming), episode(2, EpisodeStatus.PENDING, upcoming)] },
    ]);

    expect(await service.needsMoreContent('request-1')).toBe(false);
  });

  it('needs more as soon as an aired episode is missing', async () => {
    const { service } = setup([
      { seasonNumber: 1, totalEpisodes: 2, episodes: [episode(1, EpisodeStatus.COMPLETED, aired), episode(2, EpisodeStatus.PENDING, aired)] },
      { seasonNumber: 2, totalEpisodes: 1, episodes: [episode(1, EpisodeStatus.PENDING, aired)] },
    ]);

    const analysis = await service.analyzeContentGaps('request-1');

    expect(analysis.incompleteSeasons.map(season => season.seasonNumber)).toEqual([1]);
    expect(analysis.missingSeasons).toEqual([2]);
    expect(await service.needsMoreContent('request-1')).toBe(true);
  });

  it('reads air dates from the episodes it has, asking TMDB only for the rest', async () => {
    const { service, releaseValidator } = setup([
      { seasonNumber: 1, totalEpisodes: 2, episodes: [episode(1, EpisodeStatus.PENDING, aired), episode(2, EpisodeStatus.PENDING, null)] },
    ]);

    await service.analyzeContentGaps('request-1');

    expect(releaseValidator.isEpisodeReleased).toHaveBeenCalledTimes(1);
    expect(releaseValidator.isEpisodeReleased).toHaveBeenCalledWith(95396, 1, 2);
  });
});
