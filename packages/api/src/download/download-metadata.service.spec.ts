import { DownloadMetadataService } from './download-metadata.service';

const aria2Download = (gid: string, extra: Record<string, unknown> = {}) => ({
  gid,
  status: 'active',
  totalLength: '1000',
  completedLength: '250',
  downloadSpeed: '10',
  files: [{ path: `/downloads/${gid}/file.mkv`, length: '1000', completedLength: '250', uris: [] }],
  ...extra,
});

const metadataRow = (extra: Record<string, unknown> = {}) => ({
  id: 'job-1',
  name: 'Tracked',
  originalUrl: 'magnet:?xt=urn:btih:abc',
  type: 'MAGNET',
  aria2Gid: 'parent',
  aria2ChildGids: [],
  status: 'ACTIVE',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...extra,
});

describe('DownloadMetadataService.getGroupedDownloads', () => {
  const setup = (rows: any[], aria2: Record<string, jest.Mock>) => {
    const prisma = {
      downloadMetadata: { findMany: jest.fn().mockResolvedValue(rows), update: jest.fn() },
      torrentDownload: { findMany: jest.fn().mockResolvedValue([]) },
      httpDownloadRequest: { findFirst: jest.fn().mockResolvedValue(null) },
      requestedTorrent: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    return new DownloadMetadataService(prisma as any, aria2 as any);
  };

  it('lists a download aria2 is running that has no entry', async () => {
    const service = setup([], {
      getActiveDownloads: jest.fn().mockResolvedValue([
        aria2Download('orphan', { bittorrent: { info: { name: 'Titans.S01' } } }),
      ]),
      getWaitingDownloads: jest.fn().mockResolvedValue([]),
    });

    expect(await service.getGroupedDownloads()).toEqual([
      expect.objectContaining({
        id: 'orphan',
        name: 'Titans.S01',
        untracked: true,
        status: 'active',
        progress: 25,
        type: 'TORRENT',
      }),
    ]);
  });

  it('does not list the second half of a tracked download on its own', async () => {
    const child = aria2Download('child', { following: 'parent' });
    const restored = aria2Download('restored');
    const service = setup(
      [metadataRow(), metadataRow({ id: 'job-2', aria2Gid: 'gone', aria2ChildGids: ['restored'] })],
      {
        getStatus: jest.fn(async (gid: string) => {
          if (gid === 'parent') return aria2Download('parent', { status: 'complete', followedBy: ['child'] });
          if (gid === 'restored') return restored;
          throw new Error(`GID ${gid} is not found`);
        }),
        getActiveDownloads: jest.fn().mockResolvedValue([child, restored]),
        getWaitingDownloads: jest.fn().mockResolvedValue([]),
      },
    );

    const downloads = await service.getGroupedDownloads();
    expect(downloads.map((d) => d.id)).toEqual(['job-1', 'job-2']);
  });

  it('still lists its own entries when aria2 cannot be asked', async () => {
    const unreachable = jest.fn().mockRejectedValue(new Error('Aria2 RPC not connected'));
    const service = setup([metadataRow()], {
      getStatus: unreachable,
      getActiveDownloads: unreachable,
      getWaitingDownloads: unreachable,
    });

    expect(await service.getGroupedDownloads()).toEqual([
      expect.objectContaining({ id: 'job-1', status: 'error' }),
    ]);
  });
});

describe('DownloadMetadataService.deleteDownloadMetadata', () => {
  it('removes a download aria2 started from this one that was never recorded', async () => {
    const prisma = {
      downloadMetadata: {
        findUnique: jest.fn().mockResolvedValue(metadataRow()),
        delete: jest.fn(),
      },
      requestedTorrent: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const forceRemove = jest.fn().mockResolvedValue('OK');
    const aria2 = {
      getStatus: jest.fn(async (gid: string) =>
        gid === 'parent'
          ? { gid, status: 'complete', files: [], followedBy: ['child'] }
          : { gid, status: 'active', files: [] },
      ),
      forceRemove,
    };

    await new DownloadMetadataService(prisma as any, aria2 as any).deleteDownloadMetadata('job-1');

    expect(forceRemove.mock.calls.map(([gid]) => gid)).toEqual(['parent', 'child']);
    expect(prisma.downloadMetadata.delete).toHaveBeenCalledWith({ where: { id: 'job-1' } });
  });
});
