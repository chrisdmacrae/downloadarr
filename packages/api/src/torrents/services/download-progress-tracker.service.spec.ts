import { DownloadProgressTrackerService } from './download-progress-tracker.service';

describe('DownloadProgressTrackerService', () => {
  const stranded = {
    id: 'request-1',
    title: 'Some Movie',
    torrentDownloads: [{ id: 'download-1', aria2Gid: 'ce9cc8eaf0611519', torrentTitle: 'Some.Movie.1080p' }],
  };

  let aria2Service: { getStatus: jest.Mock };
  let orchestrator: { startDownload: jest.Mock };
  let prisma: {
    requestedTorrent: { findMany: jest.Mock };
    torrentDownload: { update: jest.Mock };
  };
  let service: DownloadProgressTrackerService;

  beforeEach(() => {
    aria2Service = { getStatus: jest.fn() };
    orchestrator = { startDownload: jest.fn() };
    prisma = {
      requestedTorrent: { findMany: jest.fn().mockResolvedValue([stranded]) },
      torrentDownload: { update: jest.fn() },
    };

    service = new DownloadProgressTrackerService(
      { getRequestsByStatus: jest.fn().mockResolvedValue([]) } as any,
      orchestrator as any,
      {} as any,
      aria2Service as any,
      prisma as any,
      {} as any,
      {} as any,
      {} as any,
    );
  });

  describe('stranded FOUND requests', () => {
    it('fails a download aria2 no longer knows about, so it is not polled again', async () => {
      aria2Service.getStatus.mockRejectedValue(new Error('GID ce9cc8eaf0611519 is not found'));

      await service.trackDownloadStatus();

      expect(prisma.torrentDownload.update).toHaveBeenCalledWith({
        where: { id: 'download-1' },
        data: expect.objectContaining({ status: 'FAILED' }),
      });
      expect(orchestrator.startDownload).not.toHaveBeenCalled();
    });

    it('leaves the download alone when aria2 cannot be reached', async () => {
      aria2Service.getStatus.mockRejectedValue(new Error('Aria2 RPC not connected'));

      await service.trackDownloadStatus();

      expect(prisma.torrentDownload.update).not.toHaveBeenCalled();
      expect(orchestrator.startDownload).not.toHaveBeenCalled();
    });

    it('adopts a download aria2 still has', async () => {
      aria2Service.getStatus.mockResolvedValue({ status: 'active' });

      await service.trackDownloadStatus();

      expect(orchestrator.startDownload).toHaveBeenCalledWith(
        'request-1',
        expect.objectContaining({ aria2Gid: 'ce9cc8eaf0611519' }),
      );
      expect(prisma.torrentDownload.update).not.toHaveBeenCalled();
    });
  });

  describe('a finished TV download', () => {
    it('counts the new episodes before deciding what the show still needs', async () => {
      const calls: string[] = [];
      const download = { id: 'download-1', requestedTorrentId: 'request-1', aria2Gid: 'gid-1', torrentTitle: 'Show S01' };
      const finishedPrisma = {
        requestedTorrent: {
          findMany: jest.fn().mockResolvedValue([]),
          findUnique: jest.fn().mockResolvedValue({ id: 'request-1', contentType: 'TV_SHOW' }),
        },
        torrentDownload: {
          findMany: jest.fn().mockResolvedValue([download]),
          update: jest.fn(async () => calls.push('download completed')),
        },
      };

      const tracker = new DownloadProgressTrackerService(
        { getRequestsByStatus: jest.fn().mockResolvedValue([{ id: 'request-1', aria2Gid: 'gid-1' }]) } as any,
        { markAsCompleted: jest.fn(async () => calls.push('request settled')) } as any,
        {
          isDownloadComplete: jest.fn().mockResolvedValue(true),
          isDownloadFailed: jest.fn().mockResolvedValue({ failed: false }),
        } as any,
        aria2Service as any,
        finishedPrisma as any,
        { getSettings: jest.fn(async () => (calls.push('files organized'), { organizeOnComplete: false })) } as any,
        {} as any,
        { scanTvShowRequest: jest.fn(async () => calls.push('episodes counted')) } as any,
      );

      await tracker.trackDownloadStatus();

      expect(calls).toEqual(['download completed', 'files organized', 'episodes counted', 'request settled']);
    });
  });
});
