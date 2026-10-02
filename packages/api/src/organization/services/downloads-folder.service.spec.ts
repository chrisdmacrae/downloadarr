import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DownloadsFolderService, guessFromReleaseName } from './downloads-folder.service';
import { ContentType, RequestStatus } from '../../../generated/prisma';

describe('guessFromReleaseName', () => {
  it.each([
    ['Severance.S02.1080p.WEB.x265-GRP', { title: 'Severance', season: 2 }],
    ['The.Bear.S03E01.720p.HDTV.mkv', { title: 'The Bear', season: 3 }],
    ['Heat.1995.1080p.BluRay.x264', { title: 'Heat', year: 1995 }],
    ['Blade Runner 2049 (2017) [1080p]', { title: 'Blade Runner 2049', year: 2017 }],
    ['1923.S01.2160p', { title: '1923', season: 1 }],
    ['Radiohead - In Rainbows (2007) [FLAC]', { title: 'Radiohead - In Rainbows', year: 2007 }],
  ])('reads %s', (name, expected) => {
    expect(guessFromReleaseName(name)).toMatchObject(expected);
  });
});

describe('DownloadsFolderService', () => {
  let root: string;
  let requests: any[];
  let prisma: any;
  let organizer: { organizeFiles: jest.Mock; isLeftBehind: jest.Mock };
  let scanner: { scanTvShowRequest: jest.Mock };
  let orchestrator: { markAsCompleted: jest.Mock; markAsManuallyOrganized: jest.Mock; markAsOrganizeFailed: jest.Mock };
  let settings: { organizeOnComplete: boolean };
  let service: DownloadsFolderService;
  const previousRoot = process.env.DOWNLOAD_PATH;

  const write = async (relativePath: string, content = 'x') => {
    const filePath = path.join(root, relativePath);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content);
  };

  beforeEach(async () => {
    root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'downloads-')));
    process.env.DOWNLOAD_PATH = root;

    requests = [];
    prisma = {
      requestedTorrent: {
        findMany: jest.fn(async () => requests),
        findUnique: jest.fn(async ({ where }) => requests.find(request => request.id === where.id) ?? null),
        update: jest.fn(),
      },
    };
    organizer = {
      organizeFiles: jest.fn(async files => ({ organized: files, failed: [], skipped: [], missing: [] })),
      isLeftBehind: jest.fn((file: string) => file.endsWith('.nfo')),
    } as any;
    scanner = { scanTvShowRequest: jest.fn() };
    orchestrator = { markAsCompleted: jest.fn(), markAsManuallyOrganized: jest.fn(), markAsOrganizeFailed: jest.fn() };

    settings = { organizeOnComplete: true };
    service = new DownloadsFolderService(
      prisma,
      { getSettings: jest.fn(async () => settings) } as any,
      organizer as any,
      scanner as any,
      orchestrator as any,
    );
  });

  afterEach(async () => {
    process.env.DOWNLOAD_PATH = previousRoot;
    await fs.rm(root, { recursive: true, force: true });
  });

  describe('list', () => {
    it('lists what is inside the type folders, with a guess at what each is', async () => {
      requests = [{ id: 'request-1', title: 'Severance', contentType: ContentType.TV_SHOW }];
      await write('tv-shows/Severance.S02.1080p.WEB/Severance.S02E01.mkv', '12345');
      await write('tv-shows/Severance.S02.1080p.WEB/Severance.S02E01.nfo', '1');
      await write('movies/Heat.1995.1080p.mkv');
      await write('stray.iso');
      await fs.mkdir(path.join(root, 'games'));

      const entries = await service.list();
      const byName = Object.fromEntries(entries.map(entry => [entry.name, entry]));

      expect(Object.keys(byName).sort()).toEqual(['Heat.1995.1080p.mkv', 'Severance.S02.1080p.WEB', 'stray.iso']);
      expect(byName['Severance.S02.1080p.WEB']).toMatchObject({
        path: 'tv-shows/Severance.S02.1080p.WEB',
        isDirectory: true,
        fileCount: 2,
        mediaFileCount: 1,
        sizeBytes: 6,
        suggestedContentType: ContentType.TV_SHOW,
        inProgress: false,
        detected: { title: 'Severance', season: 2 },
        suggestedRequestId: 'request-1',
      });
      expect(byName['Heat.1995.1080p.mkv']).toMatchObject({ suggestedContentType: ContentType.MOVIE, suggestedRequestId: null });
      expect(byName['stray.iso'].suggestedContentType).toBeNull();
    });

    it('leaves out folders that only hold what organizing left behind', async () => {
      await write('tv-shows/Severance.S01.1080p/release.nfo');
      await fs.mkdir(path.join(root, 'movies/Emptied'), { recursive: true });

      expect(await service.list()).toEqual([]);
    });

    it('marks a download aria2 is still writing', async () => {
      await write('movies/Heat.1995/Heat.mkv');
      await write('movies/Heat.1995.aria2');

      const [entry] = await service.list();

      expect(entry).toMatchObject({ name: 'Heat.1995', inProgress: true });
    });
  });

  describe('organize', () => {
    it('refuses paths outside the downloads folder, and the type folders themselves', async () => {
      await fs.mkdir(path.join(root, 'movies'));

      await expect(service.organize({ path: '../etc', contentType: ContentType.MOVIE, title: 'x' })).rejects.toThrow('inside the downloads folder');
      await expect(service.organize({ path: 'movies', contentType: ContentType.MOVIE, title: 'x' })).rejects.toThrow('not the folder itself');
      expect(organizer.organizeFiles).not.toHaveBeenCalled();
    });

    it('refuses a download that is still in progress', async () => {
      await write('movies/Heat.1995/Heat.mkv');
      await write('movies/Heat.1995/Heat.mkv.aria2');

      await expect(service.organize({ path: 'movies/Heat.1995', contentType: ContentType.MOVIE, title: 'Heat' })).rejects.toThrow('still downloading');
    });

    it('needs to be told what the download is', async () => {
      await write('other/thing.mkv');

      await expect(service.organize({ path: 'other/thing.mkv' })).rejects.toThrow('Say what this is');
    });

    it('organizes by a typed title when there is no request', async () => {
      await write('other/Some.Game/disc.iso');

      const result = await service.organize({ path: 'other/Some.Game', contentType: ContentType.GAME, title: 'Some Game', platform: 'PS2' });

      expect(organizer.organizeFiles).toHaveBeenCalledWith(
        [path.join(root, 'other/Some.Game/disc.iso')],
        expect.objectContaining({ contentType: ContentType.GAME, title: 'Some Game', platform: 'PS2' }),
      );
      expect(result).toMatchObject({ success: true, organized: 1 });
    });

    it('completes a failed movie request it was mapped to', async () => {
      requests = [{ id: 'request-1', title: 'Heat', year: 1995, contentType: ContentType.MOVIE, status: RequestStatus.FAILED }];
      await write('movies/Heat.1995/Heat.mkv');

      await service.organize({ path: 'movies/Heat.1995', requestId: 'request-1' });

      expect(organizer.organizeFiles.mock.calls[0][1]).toMatchObject({ title: 'Heat', year: 1995, requestId: 'request-1' });
      expect(orchestrator.markAsManuallyOrganized).toHaveBeenCalledWith('request-1');
    });

    it('counts the episodes of a show it was mapped to, and leaves its search to carry on', async () => {
      requests = [{ id: 'request-1', title: 'Severance', contentType: ContentType.TV_SHOW, status: RequestStatus.PENDING, season: null }];
      await write('tv-shows/Sev.S02/Episode 01.mkv');

      await service.organize({ path: 'tv-shows/Sev.S02', requestId: 'request-1', season: 2 });

      expect(organizer.organizeFiles.mock.calls[0][1]).toMatchObject({ contentType: ContentType.TV_SHOW, season: 2 });
      expect(scanner.scanTvShowRequest).toHaveBeenCalledWith('request-1');
      expect(orchestrator.markAsManuallyOrganized).not.toHaveBeenCalled();
    });

    it('releases a request that was held for a failed move', async () => {
      requests = [{ id: 'request-1', title: 'Severance', contentType: ContentType.TV_SHOW, status: RequestStatus.ORGANIZE_FAILED }];
      await write('tv-shows/Sev.S02/Severance.S02E01.mkv');

      await service.organize({ path: 'tv-shows/Sev.S02', requestId: 'request-1' });

      expect(prisma.requestedTorrent.update).toHaveBeenCalledWith({
        where: { id: 'request-1' },
        data: { organizeError: null, unorganizedFiles: [] },
      });
      expect(orchestrator.markAsCompleted).toHaveBeenCalledWith('request-1');
    });

    it('does not settle the request when some files could not be moved', async () => {
      requests = [{ id: 'request-1', title: 'Heat', contentType: ContentType.MOVIE, status: RequestStatus.FAILED }];
      await write('movies/Heat.1995/Heat.mkv');
      organizer.organizeFiles.mockResolvedValue({
        organized: [],
        failed: [{ path: path.join(root, 'movies/Heat.1995/Heat.mkv'), error: 'EACCES' }],
        skipped: [],
        missing: [],
      });

      const result = await service.organize({ path: 'movies/Heat.1995', requestId: 'request-1' });

      expect(result).toMatchObject({ success: false, failed: [{ path: 'movies/Heat.1995/Heat.mkv', error: 'EACCES' }] });
      expect(orchestrator.markAsManuallyOrganized).not.toHaveBeenCalled();
    });
  });

  describe('automatic matching', () => {
    const old = new Date(Date.now() - 60 * 60 * 1000);
    const heat = (overrides = {}) => ({
      id: 'request-1',
      title: 'Heat',
      year: 1995,
      contentType: ContentType.MOVIE,
      status: RequestStatus.FAILED,
      torrentDownloads: [],
      ...overrides,
    });
    const settledDownload = async (relativePath = 'movies/Heat.1995.1080p/Heat.mkv') => {
      await write(relativePath);
      await fs.utimes(path.join(root, relativePath), old, old);
      await fs.utimes(path.dirname(path.join(root, relativePath)), old, old);
    };
    const organizedPaths = () => organizer.organizeFiles.mock.calls.map(([files]) => files);

    it('organizes a settled download that matches exactly one open request', async () => {
      requests = [heat()];
      await settledDownload();

      await service.organizeMatchedDownloads();

      expect(organizer.organizeFiles).toHaveBeenCalledWith(
        [path.join(root, 'movies/Heat.1995.1080p/Heat.mkv')],
        expect.objectContaining({ title: 'Heat', requestId: 'request-1' }),
      );
      expect(orchestrator.markAsManuallyOrganized).toHaveBeenCalledWith('request-1');
    });

    it.each([
      ['matches two requests', () => { requests = [heat(), heat({ id: 'request-2' })]; }],
      ['has a request that is still downloading for itself', () => { requests = [heat({ torrentDownloads: [{ id: 'd' }] })]; }],
      ['has a request that was cancelled', () => { requests = [heat({ status: RequestStatus.CANCELLED })]; }],
      ['has a request that is held for a retry', () => { requests = [heat({ status: RequestStatus.ORGANIZE_FAILED })]; }],
      ['is from another year than the request', () => { requests = [heat({ year: 2022 })]; }],
      ['matches a request of another type', () => { requests = [heat({ contentType: ContentType.TV_SHOW })]; }],
    ])('leaves a download that %s', async (_case, arrange) => {
      arrange();
      await settledDownload();

      await service.organizeMatchedDownloads();

      expect(organizedPaths()).toEqual([]);
    });

    it('leaves a download that only just landed, or is still being written', async () => {
      requests = [heat()];
      await write('movies/Heat.1995.1080p/Heat.mkv');

      await service.organizeMatchedDownloads();
      expect(organizedPaths()).toEqual([]);

      await settledDownload();
      await write('movies/Heat.1995.1080p.aria2');
      await service.organizeMatchedDownloads();
      expect(organizedPaths()).toEqual([]);
    });

    it('leaves downloads outside the type folders, which could be anything', async () => {
      requests = [heat()];
      await settledDownload('other/Heat.1995.1080p/Heat.mkv');

      await service.organizeMatchedDownloads();

      expect(organizedPaths()).toEqual([]);
    });

    it('does nothing when organizing on completion is switched off', async () => {
      requests = [heat()];
      settings.organizeOnComplete = false;
      await settledDownload();

      await service.organizeMatchedDownloads();

      expect(organizedPaths()).toEqual([]);
    });

    it('holds the request when the files cannot be moved, rather than trying every ten minutes', async () => {
      requests = [heat()];
      await settledDownload();
      organizer.organizeFiles.mockResolvedValue({
        organized: [],
        failed: [{ path: path.join(root, 'movies/Heat.1995.1080p/Heat.mkv'), error: 'EACCES' }],
        skipped: [],
        missing: [],
      });

      await service.organizeMatchedDownloads();

      expect(prisma.requestedTorrent.update).toHaveBeenCalledWith({
        where: { id: 'request-1' },
        data: expect.objectContaining({ unorganizedFiles: [path.join(root, 'movies/Heat.1995.1080p/Heat.mkv')] }),
      });
      expect(orchestrator.markAsOrganizeFailed).toHaveBeenCalledWith('request-1', expect.stringContaining('EACCES'));
    });
  });
});
