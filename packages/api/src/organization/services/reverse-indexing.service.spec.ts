import { ReverseIndexingService } from './reverse-indexing.service';
import { ContentType, RequestStatus } from '../../../generated/prisma';

describe('ReverseIndexingService TV shows in the organize queue', () => {
  let requests: any[];
  let prisma: any;
  let seasonScanning: { scanTvShowRequest: jest.Mock };
  let tmdb: { searchTvShows: jest.Mock; getTvShowDetails: jest.Mock };
  let service: ReverseIndexingService;

  const queueItem = {
    id: 'item-1',
    // Not on disk: reorganizing is skipped, only the request matters here
    folderPath: '/nonexistent/library/tv-shows/Severance (2022)',
    contentType: ContentType.TV_SHOW,
    detectedTitle: 'Severance',
    detectedYear: 2022,
    detectedSeason: 1,
  };

  const existing = (overrides = {}) => ({
    id: 'request-1',
    contentType: ContentType.TV_SHOW,
    title: 'Severance',
    year: 2022,
    tmdbId: 95396,
    imdbId: null,
    season: null,
    isOngoing: true,
    status: RequestStatus.PENDING,
    ...overrides,
  });

  beforeEach(() => {
    requests = [];
    prisma = {
      organizeQueue: {
        findUnique: jest.fn(async () => queueItem),
        update: jest.fn(),
      },
      requestedTorrent: {
        findMany: jest.fn(async ({ where }) =>
          requests.filter(request => !where.status?.notIn?.includes(request.status)),
        ),
        create: jest.fn(async ({ data }) => ({ id: 'request-new', ...data })),
      },
    };
    seasonScanning = { scanTvShowRequest: jest.fn() };
    tmdb = {
      searchTvShows: jest.fn(async () => ({ success: true, data: [{ id: '95396' }] })),
      getTvShowDetails: jest.fn(async (id: string) => ({
        success: true,
        data: { id, title: 'Severance', year: 2022, imdbId: 'tt11280740' },
      })),
    };

    service = new ReverseIndexingService(prisma, {} as any, {} as any, seasonScanning as any, tmdb as any, {} as any);
  });

  it('uses the request the show already has, though it names no season', async () => {
    requests = [existing()];

    const result = await service.processOrganizeQueueItem('item-1', {});

    expect(result.success).toBe(true);
    expect(prisma.requestedTorrent.create).not.toHaveBeenCalled();
    expect(seasonScanning.scanTvShowRequest).toHaveBeenCalledWith('request-1');
  });

  it('matches a show whose folder spells the title differently, with no TMDB to ask', async () => {
    requests = [existing({ title: 'Shōgun', year: 2024, tmdbId: null })];
    prisma.organizeQueue.findUnique.mockResolvedValue({ ...queueItem, detectedTitle: 'Shogun', detectedYear: 2024 });
    tmdb.searchTvShows.mockResolvedValue({ success: false });

    await service.processOrganizeQueueItem('item-1', {});

    expect(prisma.requestedTorrent.create).not.toHaveBeenCalled();
  });

  it('creates an ongoing request when the show has none, or only a dead one', async () => {
    requests = [existing({ status: RequestStatus.EXPIRED })];

    await service.processOrganizeQueueItem('item-1', {});

    expect(prisma.requestedTorrent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ title: 'Severance', tmdbId: 95396, isOngoing: true, maxSearchAttempts: 1000 }),
    });
    expect(seasonScanning.scanTvShowRequest).toHaveBeenCalledWith('request-new');
  });

  it('looks up the show picked in the queue rather than searching for its title', async () => {
    await service.processOrganizeQueueItem('item-1', { selectedTmdbId: '1234' });

    expect(tmdb.searchTvShows).not.toHaveBeenCalled();
    expect(tmdb.getTvShowDetails).toHaveBeenCalledWith('1234');
    expect(prisma.requestedTorrent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tmdbId: 1234 }),
    });
  });
});
