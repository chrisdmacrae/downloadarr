import { TorrentCheckerService } from './torrent-checker.service';
import { TvShowTorrentSelectionService } from './tv-show-torrent-selection.service';
import { TorrentTitleMatcherService } from './torrent-title-matcher.service';
import { ContentType, RequestStatus } from '../../../generated/prisma';

describe('TorrentCheckerService TV shows', () => {
  let orchestrator: Record<string, jest.Mock>;
  let prowlarr: { searchTvTorrents: jest.Mock };
  let downloadService: { createDownload: jest.Mock };
  let prisma: any;
  let aria2: { getStatus: jest.Mock; remove: jest.Mock };
  let selection: TvShowTorrentSelectionService;
  let service: TorrentCheckerService;

  const request: any = {
    id: 'request-1',
    contentType: ContentType.TV_SHOW,
    title: 'Severance',
    isOngoing: true,
    // A show found in the library carries the first season folder it had
    season: 2,
    episode: null,
    searchAttempts: 0,
    maxSearchAttempts: 1000,
    trustedIndexers: [],
    blacklistedWords: [],
    minSeeders: 1,
    maxSizeGB: 50,
  };

  const torrent = (title: string, seeders = 10) => ({ title, seeders, indexer: 'indexer', link: `http://indexer/${title}`, size: '1GB' });

  const searchReturns = (bySeason: Record<string, any[]>) =>
    prowlarr.searchTvTorrents.mockImplementation(async ({ season }) => ({ success: true, data: bySeason[season ?? 'general'] ?? [] }));

  const downloadedTitles = () => downloadService.createDownload.mock.calls.map(([dto]) => dto.name);

  beforeEach(() => {
    orchestrator = {
      startSearch: jest.fn(),
      markAsFound: jest.fn(),
      startDownload: jest.fn(),
      transitionRequest: jest.fn(),
      markAsFailed: jest.fn(),
    };
    prowlarr = { searchTvTorrents: jest.fn() };
    downloadService = { createDownload: jest.fn(async () => ({ id: 7, aria2Gid: 'new-gid' })) };
    prisma = {
      torrentDownload: {
        findMany: jest.fn(async () => []),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    aria2 = { getStatus: jest.fn(), remove: jest.fn() };

    selection = new TvShowTorrentSelectionService({} as any, new TorrentTitleMatcherService(), {} as any, {} as any);
    jest.spyOn(selection, 'analyzeMissingContent').mockResolvedValue({ missingSeasons: [1, 2, 3], incompleteSeasons: [] });

    service = new TorrentCheckerService(
      { updateRequestStatus: jest.fn() } as any,
      {} as any,
      {} as any,
      prowlarr as any,
      { filterAndRankTorrents: jest.fn(torrents => torrents) } as any,
      orchestrator as any,
      downloadService as any,
      prisma,
      selection,
      { needsMoreContent: jest.fn(async () => true) } as any,
      aria2 as any,
    );
  });

  describe('one download at a time', () => {
    const activeDownload = {
      id: 'download-1',
      aria2Gid: 'active-gid',
      downloadJobId: '3',
      torrentTitle: 'Severance S01 1080p',
    };

    it('goes back to tracking a download that is still running instead of starting another', async () => {
      prisma.torrentDownload.findMany.mockResolvedValue([activeDownload]);
      aria2.getStatus.mockResolvedValue({ status: 'active' });

      await service.processRequest(request);

      expect(prowlarr.searchTvTorrents).not.toHaveBeenCalled();
      expect(downloadService.createDownload).not.toHaveBeenCalled();
      expect(orchestrator.startDownload).toHaveBeenCalledWith('request-1', expect.objectContaining({ aria2Gid: 'active-gid' }));
    });

    it('does not start another while aria2 cannot be reached', async () => {
      prisma.torrentDownload.findMany.mockResolvedValue([activeDownload]);
      aria2.getStatus.mockRejectedValue(new Error('Aria2 RPC not connected'));

      await service.processRequest(request);

      expect(downloadService.createDownload).not.toHaveBeenCalled();
      expect(prisma.torrentDownload.update).not.toHaveBeenCalled();
      expect(orchestrator.transitionRequest).toHaveBeenCalledWith(expect.objectContaining({ targetStatus: RequestStatus.PENDING }));
    });

    it('moves on when the recorded download is gone from aria2', async () => {
      prisma.torrentDownload.findMany.mockResolvedValue([activeDownload]);
      aria2.getStatus.mockRejectedValue(new Error('GID active-gid is not found'));
      searchReturns({ general: [torrent('Severance S01 1080p')] });

      await service.processRequest(request);

      expect(prisma.torrentDownload.update).toHaveBeenCalledWith({
        where: { id: 'download-1' },
        data: expect.objectContaining({ status: 'FAILED' }),
      });
      expect(downloadedTitles()).toEqual(['Severance S01 1080p']);
    });

    it('starts exactly one download per search', async () => {
      searchReturns({ general: [torrent('Severance S01 1080p'), torrent('Severance S02 1080p'), torrent('Severance S03 1080p')] });

      await service.processRequest(request);

      expect(downloadedTitles()).toEqual(['Severance S01 1080p']);
      expect(downloadService.createDownload).toHaveBeenCalledWith(expect.anything(), { matchRequests: false });
    });
  });

  describe('seasons in order', () => {
    it('searches for the whole show, not the season the request happens to carry', async () => {
      searchReturns({ general: [torrent('Severance S01 1080p')] });

      await service.processRequest(request);

      expect(prowlarr.searchTvTorrents).toHaveBeenCalledTimes(1);
      expect(prowlarr.searchTvTorrents.mock.calls[0][0].season).toBeUndefined();
    });

    it('asks for the earliest missing season by name when only later ones come back', async () => {
      searchReturns({
        general: [torrent('Severance S03 1080p', 500), torrent('Severance S02 1080p', 300)],
        1: [torrent('Severance S01 1080p', 5)],
      });

      await service.processRequest(request);

      expect(prowlarr.searchTvTorrents.mock.calls.map(([dto]) => dto.season)).toEqual([undefined, 1]);
      expect(downloadedTitles()).toEqual(['Severance S01 1080p']);
    });

    it('takes the earliest season there is when the earliest missing one cannot be found', async () => {
      searchReturns({ general: [torrent('Severance S03 1080p', 500), torrent('Severance S02 1080p', 300)] });

      await service.processRequest(request);

      expect(downloadedTitles()).toEqual(['Severance S02 1080p']);
    });

    it('prefers the earliest season over a pack of later ones', async () => {
      searchReturns({ general: [torrent('Severance S02-S03 1080p', 900), torrent('Severance S01 1080p', 5)] });

      await service.processRequest(request);

      expect(downloadedTitles()).toEqual(['Severance S01 1080p']);
    });

    it('fills an incomplete earlier season before starting a later one', async () => {
      (selection.analyzeMissingContent as jest.Mock).mockResolvedValue({
        missingSeasons: [2],
        incompleteSeasons: [{ seasonNumber: 1, missingEpisodes: [8, 9], totalEpisodes: 9 }],
      });
      searchReturns({
        general: [torrent('Severance S02 1080p', 900), torrent('Severance S01E09 1080p', 50), torrent('Severance S01E08 1080p', 5)],
      });

      await service.processRequest(request);

      expect(downloadedTitles()).toEqual(['Severance S01E08 1080p']);
    });

    it('keeps a request for one season to that season', async () => {
      searchReturns({ 2: [torrent('Severance S02 1080p')] });

      await service.processRequest({ ...request, isOngoing: false });

      expect(prowlarr.searchTvTorrents.mock.calls.map(([dto]) => dto.season)).toEqual([2]);
      expect(downloadedTitles()).toEqual(['Severance S02 1080p']);
    });
  });
});
