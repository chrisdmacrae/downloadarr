import { RequestedTorrentsService } from './requested-torrents.service';
import { ContentType, RequestStatus } from '../../../generated/prisma';

describe('RequestedTorrentsService TV show duplicates', () => {
  let rows: any[];
  let service: RequestedTorrentsService;

  const matches = (row: any, where: any): boolean =>
    Object.entries(where).every(([key, condition]: [string, any]) => {
      if (condition === undefined) return true;
      if (condition && typeof condition === 'object') {
        if ('notIn' in condition) return !condition.notIn.includes(row[key]);
        if ('equals' in condition) return String(row[key]).toLowerCase() === String(condition.equals).toLowerCase();
        if ('not' in condition) return row[key] !== condition.not;
      }
      return row[key] === condition;
    });

  beforeEach(() => {
    rows = [];
    const prisma: any = {
      requestedTorrent: {
        // Slow enough that two requests arriving together overlap
        findFirst: jest.fn(async ({ where }) => {
          await new Promise(resolve => setTimeout(resolve, 5));
          return rows.find(row => matches(row, where)) ?? null;
        }),
        create: jest.fn(async ({ data }) => {
          const row = { id: `request-${rows.length + 1}`, status: RequestStatus.PENDING, ...data };
          rows.push(row);
          return row;
        }),
      },
    };
    const metadata: any = { populateSeasonData: jest.fn(async () => undefined) };

    service = new RequestedTorrentsService(prisma, metadata, {} as any, {} as any);
  });

  const show = (overrides = {}) => ({ title: 'Severance', year: 2022, tmdbId: 95396, isOngoing: true, ...overrides }) as any;

  it('creates one request when the same show is requested twice at once', async () => {
    const results = await Promise.allSettled([
      service.createTvShowRequest(show()),
      service.createTvShowRequest(show()),
    ]);

    expect(rows).toHaveLength(1);
    expect(results.map(result => result.status)).toEqual(['fulfilled', 'rejected']);
    expect((results[1] as PromiseRejectedResult).reason.message).toContain('already exists');
  });

  it('keeps creating after a request was refused', async () => {
    await service.createTvShowRequest(show());
    await expect(service.createTvShowRequest(show())).rejects.toThrow('already exists');

    await service.createTvShowRequest(show({ title: 'Slow Horses', tmdbId: 95480 }));

    expect(rows.map(row => row.title)).toEqual(['Severance', 'Slow Horses']);
  });

  it('refuses one season of a show that has an ongoing request', async () => {
    await service.createTvShowRequest(show());

    await expect(service.createTvShowRequest(show({ isOngoing: false, season: 2 }))).rejects.toThrow('already exists');
    expect(rows).toHaveLength(1);
  });

  it('still allows different seasons of a show with no ongoing request', async () => {
    await service.createTvShowRequest(show({ isOngoing: false, season: 1 }));
    await service.createTvShowRequest(show({ isOngoing: false, season: 2 }));

    expect(rows.map(row => [row.contentType, row.season])).toEqual([
      [ContentType.TV_SHOW, 1],
      [ContentType.TV_SHOW, 2],
    ]);
  });
});
