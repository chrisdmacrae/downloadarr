import { VideoRecommendationsService } from './video-recommendations.service';

const title = (name: string, tmdb: number | null, trakt = 1) => ({ title: name, year: 2020, ids: { trakt, tmdb, imdb: `tt${tmdb}` } });

describe('VideoRecommendationsService', () => {
  const profile: any = { id: 'p1', name: 'Sam' };
  const source: any = { id: 's1', provider: 'TRAKT' };

  const setup = () => {
    const created: any[] = [];
    const prisma: any = {
      videoDismissal: { findMany: jest.fn(async () => [{ kind: 'MOVIE', tmdbId: 2 }]) },
      videoRecommendation: {
        deleteMany: jest.fn(() => 'delete'),
        createMany: jest.fn(({ data }) => {
          created.push(...data);
          return 'create';
        }),
        findMany: jest.fn(),
      },
      $transaction: jest.fn(async (ops) => ops),
    };
    const trakt: any = {
      recommendations: jest.fn(async (_c: string, _t: string, kind: string) =>
        kind === 'movies' ? [title('Arrival', 1), title('Dismissed', 2), title('No TMDB', null)] : [title('Severance', 10)],
      ),
      watchlist: jest.fn(async (_c: string, _t: string, kind: string) => (kind === 'movies' ? [title('Dune', 3)] : [])),
    };
    const traktAuth: any = { accessToken: jest.fn(async () => 'at'), credentials: jest.fn(async () => ({ clientId: 'cid' })) };
    const tmdb: any = {
      getMovieSummary: jest.fn(async (id: number) => (id === 3 ? null : { id: String(id), title: `TMDB ${id}`, poster: 'p.jpg', type: 'movie', genres: ['Drama'] })),
      getTvSummary: jest.fn(async (id: number) => ({ id: String(id), title: `TMDB ${id}`, type: 'tv' })),
    };
    const sources: any = { recordSync: jest.fn() };
    const service = new VideoRecommendationsService(prisma, trakt, traktAuth, tmdb, sources);
    return { service, prisma, trakt, traktAuth, tmdb, sources, created };
  };

  it('stores recommendations and watchlist per kind, skipping dismissed titles and ones without a TMDB ID', async () => {
    const { service, created, sources } = setup();
    await service.buildForProfile(profile, source);

    expect(created.map((r) => [r.kind, r.list, r.rank, r.tmdbId, r.title])).toEqual([
      ['MOVIE', 'RECOMMENDED', 0, 1, 'TMDB 1'],
      // TMDB had nothing for it: Trakt's title fills in.
      ['MOVIE', 'WATCHLIST', 0, 3, 'Dune'],
      ['TV', 'RECOMMENDED', 0, 10, 'TMDB 10'],
    ]);
    expect(created[0]).toMatchObject({ profileId: 'p1', poster: 'p.jpg', genres: ['Drama'], imdbId: 'tt1' });
    expect(sources.recordSync).toHaveBeenCalledWith('s1', null);
  });

  it('records the error on the account when Trakt fails', async () => {
    const { service, traktAuth, sources } = setup();
    traktAuth.accessToken.mockRejectedValue(new Error('Trakt sign-in expired'));
    await expect(service.buildForProfile(profile, source)).rejects.toThrow(/expired/);
    expect(sources.recordSync).toHaveBeenCalledWith('s1', 'Trakt sign-in expired');
  });

  it('merges profiles into one rail with TMDB IDs as result IDs', async () => {
    const { service, prisma } = setup();
    const row = (profileId: string, list: string, rank: number, tmdbId: number) => ({
      profileId, kind: 'MOVIE', list, rank, tmdbId, title: `T${tmdbId}`, genres: [], year: null, poster: null, backdrop: null, overview: null, rating: null,
    });
    prisma.videoRecommendation.findMany.mockResolvedValue([
      row('p1', 'RECOMMENDED', 0, 1),
      row('p2', 'RECOMMENDED', 0, 1),
      row('p2', 'RECOMMENDED', 1, 5),
      row('p1', 'WATCHLIST', 0, 9),
    ]);
    const rails = await service.rails([{ id: 'p1', name: 'Sam' }, { id: 'p2', name: 'Alex' }] as any, 'MOVIE' as any);
    expect(rails.recommended.map((r) => [r.id, r.type, r.profiles])).toEqual([
      ['1', 'movie', ['Sam', 'Alex']],
      ['5', 'movie', ['Alex']],
    ]);
    expect(rails.watchlist.map((r) => r.id)).toEqual(['9']);
  });
});
