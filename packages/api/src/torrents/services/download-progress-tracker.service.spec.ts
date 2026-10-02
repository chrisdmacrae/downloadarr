import { DownloadProgressTrackerService } from './download-progress-tracker.service';

describe('DownloadProgressTrackerService', () => {
  let downloads: any[];
  let downloadingRequests: any[];
  let strandedRequests: any[];
  let aria2: { getStatus: jest.Mock };
  let aggregation: { isDownloadComplete: jest.Mock; isDownloadFailed: jest.Mock };
  let orchestrator: Record<string, jest.Mock>;
  let prisma: any;
  let rules: { getSettings: jest.Mock };
  let organizer: { organizeFiles: jest.Mock };
  let scanner: { scanTvShowRequest: jest.Mock };
  let downloadService: { createDownload: jest.Mock };
  let calls: string[];
  let service: DownloadProgressTrackerService;

  const request = (overrides = {}) => ({
    id: 'request-1',
    title: 'Severance',
    contentType: 'TV_SHOW',
    status: 'DOWNLOADING',
    aria2Gid: 'gid-1',
    year: 2022,
    season: null,
    episode: null,
    platform: null,
    artist: null,
    unorganizedFiles: [] as string[],
    ...overrides,
  });

  const download = (requestedTorrent: any, overrides = {}) => ({
    id: 'download-1',
    requestedTorrentId: requestedTorrent.id,
    aria2Gid: 'gid-1',
    downloadJobId: '3',
    torrentTitle: 'Severance S01 1080p',
    magnetUri: 'magnet:?xt=urn:btih:abc',
    torrentLink: null,
    status: 'DOWNLOADING',
    requestedTorrent,
    ...overrides,
  });

  const finished = () => aggregation.isDownloadComplete.mockResolvedValue(true);
  const lost = () => aggregation.isDownloadFailed.mockResolvedValue({ failed: true, lost: true, reason: 'Download no longer exists in aria2' });
  const settledRowsAs = () => prisma.torrentDownload.updateMany.mock.calls.map(([args]) => args.data.status).filter(Boolean);

  beforeEach(() => {
    downloads = [];
    downloadingRequests = [];
    strandedRequests = [];
    calls = [];

    aria2 = {
      getStatus: jest.fn().mockResolvedValue({ status: 'complete', files: [{ path: '/downloads/tv-shows/Sev/Severance.S01E01.mkv' }] }),
    };
    aggregation = {
      isDownloadComplete: jest.fn().mockResolvedValue(false),
      isDownloadFailed: jest.fn().mockResolvedValue({ failed: false }),
    };
    orchestrator = {
      startSearch: jest.fn(),
      markAsFound: jest.fn(),
      startDownload: jest.fn(),
      transitionRequest: jest.fn(),
      markAsFailed: jest.fn(),
      markAsCompleted: jest.fn(async () => calls.push('request settled')),
      markAsManuallyOrganized: jest.fn(),
      markAsOrganizeFailed: jest.fn(),
    };
    prisma = {
      torrentDownload: {
        findMany: jest.fn(async () => downloads),
        updateMany: jest.fn(async () => calls.push('download settled')),
        update: jest.fn(),
      },
      requestedTorrent: {
        findMany: jest.fn(async () => strandedRequests),
        findUnique: jest.fn(async () => downloads[0]?.requestedTorrent ?? downloadingRequests[0] ?? null),
        update: jest.fn(),
      },
      downloadMetadata: { deleteMany: jest.fn() },
    };
    rules = { getSettings: jest.fn(async () => ({ organizeOnComplete: true })) };
    organizer = {
      organizeFiles: jest.fn(async files => {
        calls.push('files organized');
        return { organized: files, failed: [], skipped: [], missing: [] };
      }),
    };
    scanner = { scanTvShowRequest: jest.fn(async () => calls.push('episodes counted')) };
    downloadService = { createDownload: jest.fn(async () => ({ id: 9, aria2Gid: 'gid-new' })) };

    service = new DownloadProgressTrackerService(
      { getRequestsByStatus: jest.fn(async () => downloadingRequests) } as any,
      orchestrator as any,
      aggregation as any,
      aria2 as any,
      prisma,
      rules as any,
      organizer as any,
      scanner as any,
      downloadService as any,
    );
  });

  describe('a finished download', () => {
    it('is settled, organized and counted before the request moves on', async () => {
      downloads = [download(request())];
      finished();

      await service.trackDownloadStatus();

      expect(calls).toEqual(['download settled', 'files organized', 'episodes counted', 'request settled']);
      expect(organizer.organizeFiles).toHaveBeenCalledWith(
        ['/app/downloads/tv-shows/Sev/Severance.S01E01.mkv'],
        expect.objectContaining({ title: 'Severance', requestId: 'request-1' }),
      );
    });

    it('is handled once though it has two records', async () => {
      const show = request();
      downloads = [download(show), download(show, { id: 'download-2' })];
      finished();

      await service.trackDownloadStatus();

      expect(organizer.organizeFiles).toHaveBeenCalledTimes(1);
    });

    it('is organized though its request had failed, and a movie is completed', async () => {
      downloads = [download(request({ contentType: 'MOVIE', title: 'Heat', status: 'FAILED' }))];
      finished();

      await service.trackDownloadStatus();

      expect(organizer.organizeFiles).toHaveBeenCalled();
      expect(orchestrator.markAsManuallyOrganized).toHaveBeenCalledWith('request-1');
    });

    it('is organized for a failed show, which then looks for the rest', async () => {
      downloads = [download(request({ status: 'FAILED' }))];
      finished();

      await service.trackDownloadStatus();

      expect(scanner.scanTvShowRequest).toHaveBeenCalledWith('request-1');
      expect(orchestrator.startSearch).toHaveBeenCalledWith('request-1');
      expect(orchestrator.transitionRequest).toHaveBeenCalledWith(expect.objectContaining({ targetStatus: 'PENDING' }));
    });

    it('is organized for a show that went back to pending, whose search carries on', async () => {
      downloads = [download(request({ status: 'PENDING' }))];
      finished();

      await service.trackDownloadStatus();

      expect(calls).toEqual(['download settled', 'files organized', 'episodes counted']);
      expect(orchestrator.markAsCompleted).not.toHaveBeenCalled();
    });

    it('is left in the downloads folder when its request was cancelled', async () => {
      downloads = [download(request({ status: 'CANCELLED' }))];
      finished();

      await service.trackDownloadStatus();

      expect(settledRowsAs()).toEqual(['CANCELLED']);
      expect(organizer.organizeFiles).not.toHaveBeenCalled();
    });

    it('waits a run while its request is mid-search', async () => {
      downloads = [download(request({ status: 'SEARCHING' }))];
      finished();

      await service.trackDownloadStatus();

      expect(prisma.torrentDownload.updateMany).not.toHaveBeenCalled();
      expect(organizer.organizeFiles).not.toHaveBeenCalled();
    });

    it('is still tracked for a downloading request with no download record', async () => {
      downloadingRequests = [request()];
      finished();

      await service.trackDownloadStatus();

      expect(organizer.organizeFiles).toHaveBeenCalled();
      expect(orchestrator.markAsCompleted).toHaveBeenCalledWith('request-1');
    });

    it('does not start a second run while it is still being moved', async () => {
      downloads = [download(request())];
      finished();
      let finishOrganizing: () => void = () => undefined;
      rules.getSettings
        .mockImplementationOnce(() => new Promise(resolve => { finishOrganizing = () => resolve({ organizeOnComplete: false }); }))
        .mockResolvedValue({ organizeOnComplete: false });

      const firstRun = service.trackDownloadStatus();
      await new Promise(resolve => setImmediate(resolve));
      await service.trackDownloadStatus();

      expect(prisma.torrentDownload.findMany).toHaveBeenCalledTimes(1);

      finishOrganizing();
      await firstRun;
      await service.trackDownloadStatus();
      expect(prisma.torrentDownload.findMany).toHaveBeenCalledTimes(2);
    });
  });

  describe('a download aria2 has lost', () => {
    it('is started again from its link, and the request is not failed', async () => {
      downloads = [download(request())];
      lost();

      await service.trackDownloadStatus();

      expect(downloadService.createDownload).toHaveBeenCalledWith(
        expect.objectContaining({ url: 'magnet:?xt=urn:btih:abc', type: 'magnet', name: 'Severance S01 1080p' }),
        { matchRequests: false },
      );
      expect(prisma.torrentDownload.updateMany).toHaveBeenCalledWith({
        where: { aria2Gid: 'gid-1', status: 'DOWNLOADING' },
        data: { aria2Gid: 'gid-new', downloadJobId: '9' },
      });
      expect(prisma.requestedTorrent.update).toHaveBeenCalledWith({
        where: { id: 'request-1' },
        data: { aria2Gid: 'gid-new', downloadJobId: '9' },
      });
      expect(orchestrator.markAsFailed).not.toHaveBeenCalled();
    });

    it('fails when there is no link to start it from', async () => {
      downloads = [download(request(), { magnetUri: null, torrentLink: null })];
      lost();

      await service.trackDownloadStatus();

      expect(downloadService.createDownload).not.toHaveBeenCalled();
      expect(settledRowsAs()).toEqual(['FAILED']);
      expect(orchestrator.markAsFailed).toHaveBeenCalledWith('request-1', 'Download no longer exists in aria2');
    });

    it('fails when aria2 will not take it back', async () => {
      downloads = [download(request())];
      lost();
      downloadService.createDownload.mockRejectedValue(new Error('link expired'));

      await service.trackDownloadStatus();

      expect(settledRowsAs()).toEqual(['FAILED']);
      expect(orchestrator.markAsFailed).toHaveBeenCalled();
    });

    it('is not started again for a cancelled request', async () => {
      downloads = [download(request({ status: 'CANCELLED' }))];
      lost();

      await service.trackDownloadStatus();

      expect(downloadService.createDownload).not.toHaveBeenCalled();
    });
  });

  describe('a download that errors in aria2', () => {
    beforeEach(() => aggregation.isDownloadFailed.mockResolvedValue({ failed: true, reason: 'disk full' }));

    it('fails the request that is waiting on it', async () => {
      downloads = [download(request())];

      await service.trackDownloadStatus();

      expect(settledRowsAs()).toEqual(['FAILED']);
      expect(orchestrator.markAsFailed).toHaveBeenCalledWith('request-1', 'disk full');
    });

    it('does not fail a request that has moved on to another download', async () => {
      downloads = [download(request({ aria2Gid: 'gid-2' }))];

      await service.trackDownloadStatus();

      expect(settledRowsAs()).toEqual(['FAILED']);
      expect(orchestrator.markAsFailed).not.toHaveBeenCalled();
    });
  });

  describe('a request marked failed while its download is still running', () => {
    it('goes back to downloading', async () => {
      downloads = [download(request({ status: 'FAILED' }))];

      await service.trackDownloadStatus();

      expect(orchestrator.startSearch).toHaveBeenCalledWith('request-1');
      expect(orchestrator.markAsFound).toHaveBeenCalledWith('request-1', expect.objectContaining({ title: 'Severance S01 1080p' }));
      expect(orchestrator.startDownload).toHaveBeenCalledWith('request-1', expect.objectContaining({ aria2Gid: 'gid-1' }));
    });

    it('leaves a pending or downloading request as it is', async () => {
      downloads = [download(request({ status: 'PENDING' }))];

      await service.trackDownloadStatus();

      expect(orchestrator.startSearch).not.toHaveBeenCalled();
    });
  });

  describe('stranded FOUND requests', () => {
    it('adopts a download aria2 still has', async () => {
      strandedRequests = [{ id: 'request-1', title: 'Some Movie', torrentDownloads: [download(request())] }];
      aria2.getStatus.mockResolvedValue({ status: 'active' });

      await service.trackDownloadStatus();

      expect(orchestrator.startDownload).toHaveBeenCalledWith('request-1', expect.objectContaining({ aria2Gid: 'gid-1' }));
    });

    it('leaves a download aria2 cannot be asked about', async () => {
      strandedRequests = [{ id: 'request-1', title: 'Some Movie', torrentDownloads: [download(request())] }];
      aria2.getStatus.mockRejectedValue(new Error('Aria2 RPC not connected'));

      await service.trackDownloadStatus();

      expect(orchestrator.startDownload).not.toHaveBeenCalled();
    });
  });

  describe('a download whose files cannot be moved', () => {
    const stuck = { path: '/app/downloads/tv-shows/Sev/Severance.S01E02.mkv', error: 'EACCES: permission denied' };
    const held = () => request({ status: 'ORGANIZE_FAILED', unorganizedFiles: [stuck.path] });

    it('holds the request for a retry instead of completing it or moving on', async () => {
      downloads = [download(request())];
      finished();
      organizer.organizeFiles.mockResolvedValue({ organized: ['a'], failed: [stuck], skipped: [], missing: [] });

      await service.trackDownloadStatus();

      expect(prisma.requestedTorrent.update).toHaveBeenCalledWith({
        where: { id: 'request-1' },
        data: {
          organizeError: 'Could not move Severance.S01E02.mkv: EACCES: permission denied',
          unorganizedFiles: [stuck.path],
        },
      });
      expect(orchestrator.markAsOrganizeFailed).toHaveBeenCalledWith('request-1', expect.stringContaining('EACCES'));
      expect(orchestrator.markAsCompleted).not.toHaveBeenCalled();
      expect(scanner.scanTvShowRequest).not.toHaveBeenCalled();
    });

    it('holds a request that had already failed, too', async () => {
      downloads = [download(request({ status: 'FAILED' }))];
      finished();
      organizer.organizeFiles.mockResolvedValue({ organized: [], failed: [stuck], skipped: [], missing: [] });

      await service.trackDownloadStatus();

      expect(orchestrator.markAsOrganizeFailed).toHaveBeenCalledWith('request-1', expect.any(String));
    });

    it('holds the request when aria2 cannot say which files the download has', async () => {
      downloads = [download(request())];
      finished();
      aria2.getStatus.mockRejectedValue(new Error('Aria2 RPC not connected'));

      await service.trackDownloadStatus();

      expect(orchestrator.markAsOrganizeFailed).toHaveBeenCalledWith('request-1', expect.stringContaining('Aria2 RPC not connected'));
      expect(orchestrator.markAsCompleted).not.toHaveBeenCalled();
    });

    it('releases the request when a retry moves the files', async () => {
      prisma.requestedTorrent.findUnique.mockResolvedValue(held());
      organizer.organizeFiles.mockResolvedValue({ organized: [stuck.path], failed: [], skipped: [], missing: [] });

      const result = await service.retryOrganize('request-1');

      expect(organizer.organizeFiles).toHaveBeenCalledWith([stuck.path], expect.objectContaining({ title: 'Severance', requestId: 'request-1' }));
      expect(result.success).toBe(true);
      expect(prisma.requestedTorrent.update).toHaveBeenCalledWith({
        where: { id: 'request-1' },
        data: { organizeError: null, unorganizedFiles: [] },
      });
      expect(scanner.scanTvShowRequest).toHaveBeenCalledWith('request-1');
      expect(orchestrator.markAsCompleted).toHaveBeenCalledWith('request-1');
    });

    it('releases the request when the stuck files were moved away by hand', async () => {
      prisma.requestedTorrent.findUnique.mockResolvedValue(held());
      organizer.organizeFiles.mockResolvedValue({ organized: [], failed: [], skipped: [], missing: [stuck.path] });

      expect((await service.retryOrganize('request-1')).success).toBe(true);
      expect(orchestrator.markAsCompleted).toHaveBeenCalledWith('request-1');
    });

    it('keeps holding when the retry fails too', async () => {
      prisma.requestedTorrent.findUnique.mockResolvedValue(held());
      organizer.organizeFiles.mockResolvedValue({ organized: [], failed: [stuck], skipped: [], missing: [] });

      const result = await service.retryOrganize('request-1');

      expect(result).toMatchObject({ success: false, failed: [stuck] });
      expect(orchestrator.markAsCompleted).not.toHaveBeenCalled();
    });

    it('only retries a request that is being held', async () => {
      prisma.requestedTorrent.findUnique.mockResolvedValue(request());

      await expect(service.retryOrganize('request-1')).rejects.toThrow('no failed move to retry');
    });
  });
});
