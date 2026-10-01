import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { SeasonScanningService } from './season-scanning.service';
import { ContentType, EpisodeStatus } from '../../../generated/prisma';

describe('SeasonScanningService', () => {
  let library: string;
  let tvShowsPath: string;
  let request: any;
  let prisma: any;
  let service: SeasonScanningService;

  const episode = (seasonId: string, episodeNumber: number, status: EpisodeStatus) => ({
    id: `${seasonId}-e${episodeNumber}`,
    tvShowSeasonId: seasonId,
    episodeNumber,
    status,
  });

  const addFile = async (...parts: string[]) => {
    const filePath = path.join(tvShowsPath, ...parts);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, '');
  };

  const statusChanges = () =>
    Object.fromEntries(prisma.tvShowEpisode.update.mock.calls.map(([args]) => [args.where.id, args.data.status]));

  beforeEach(async () => {
    library = await fs.mkdtemp(path.join(os.tmpdir(), 'season-scan-'));
    tvShowsPath = path.join(library, 'tv-shows');
    await fs.mkdir(tvShowsPath);

    request = {
      id: 'request-1',
      contentType: ContentType.TV_SHOW,
      title: 'Shōgun',
      year: 2024,
      tmdbId: 126308,
      tvShowSeasons: [
        {
          id: 's1',
          seasonNumber: 1,
          episodes: [
            episode('s1', 1, EpisodeStatus.COMPLETED),
            episode('s1', 2, EpisodeStatus.PENDING),
            episode('s1', 3, EpisodeStatus.PENDING),
          ],
        },
        { id: 's2', seasonNumber: 2, episodes: [episode('s2', 1, EpisodeStatus.PENDING)] },
      ],
    };

    prisma = {
      requestedTorrent: { findUnique: jest.fn(async () => request) },
      organizedFile: { findMany: jest.fn(async () => []) },
      tvShowEpisode: { update: jest.fn(), create: jest.fn() },
      tvShowSeason: { findUnique: jest.fn(async () => null), update: jest.fn(), create: jest.fn() },
    };

    const organizationRules: any = {
      getSettings: jest.fn(async () => ({ libraryPath: library, tvShowsPath: null })),
      generateOrganizedPath: jest.fn(async ({ title, year }) => ({
        folderPath: path.join(tvShowsPath, `${title} (${year ?? ''})`),
      })),
    };
    // No TMDB key: files on disk are taken at their word
    const appConfig: any = { getApiKeysConfig: jest.fn(async () => ({})) };

    service = new SeasonScanningService(prisma, organizationRules, appConfig, {} as any);
  });

  afterEach(async () => {
    await fs.rm(library, { recursive: true, force: true });
  });

  it('leaves completed episodes alone when the show has no folder in the library', async () => {
    await addFile('Some Other Show (2020)', 'Season 01', 'Other.S01E01.mkv');

    const results = await service.scanTvShowRequest('request-1');

    expect(prisma.tvShowEpisode.update).not.toHaveBeenCalled();
    expect(results).toEqual({ episodesUpdated: 0, episodesMarkedMissing: 0 });
  });

  it('leaves completed episodes alone when the show folder is empty', async () => {
    await fs.mkdir(path.join(tvShowsPath, 'Shōgun (2024)', 'Season 01'), { recursive: true });

    await service.scanTvShowRequest('request-1');

    expect(prisma.tvShowEpisode.update).not.toHaveBeenCalled();
  });

  it('finds the show in a folder that spells its title differently', async () => {
    await addFile('Shogun (2024)', 'Season 01', 'Shogun.S01E01.1080p.mkv');
    await addFile('Shogun (2024)', 'Season 01', 'Shogun.S01E02.1080p.mkv');

    await service.scanTvShowRequest('request-1');

    expect(statusChanges()).toEqual({ 's1-e2': EpisodeStatus.COMPLETED });
  });

  it('does not take a show of the same name from another year', async () => {
    await addFile('Shogun (1980)', 'Season 01', 'Shogun.S01E02.mkv');

    await service.scanTvShowRequest('request-1');

    expect(prisma.tvShowEpisode.update).not.toHaveBeenCalled();
  });

  it('finds the show where its files were organized to', async () => {
    const organizedPath = path.join(tvShowsPath, 'Renamed By Hand', 'Season 01', 'Shogun.S01E01.mkv');
    await addFile('Renamed By Hand', 'Season 01', 'Shogun.S01E01.mkv');
    await addFile('Renamed By Hand', 'Season 01', 'Shogun.S01E03.mkv');
    prisma.organizedFile.findMany.mockResolvedValue([{ organizedPath }]);

    await service.scanTvShowRequest('request-1');

    expect(statusChanges()).toEqual({ 's1-e3': EpisodeStatus.COMPLETED });
  });

  it('counts episodes by their file name, whichever season folder they are in', async () => {
    await addFile('Shōgun (2024)', 'Season 01', 'Shogun.S01E01.mkv');
    await addFile('Shōgun (2024)', 'Season 01', 'Shogun.S02E01.mkv');
    await addFile('Shōgun (2024)', 'Shogun.S01E02E03.mkv');

    await service.scanTvShowRequest('request-1');

    expect(statusChanges()).toEqual({
      's1-e2': EpisodeStatus.COMPLETED,
      's1-e3': EpisodeStatus.COMPLETED,
      's2-e1': EpisodeStatus.COMPLETED,
    });
  });

  it('marks a completed episode pending when its file is gone from a show it can see', async () => {
    await addFile('Shōgun (2024)', 'Season 01', 'Shogun.S01E02.mkv');

    const results = await service.scanTvShowRequest('request-1');

    expect(statusChanges()).toEqual({
      's1-e1': EpisodeStatus.PENDING,
      's1-e2': EpisodeStatus.COMPLETED,
    });
    expect(results.episodesMarkedMissing).toBe(1);
  });

  it('creates seasons from the files of a show with no TMDB ID', async () => {
    request.tmdbId = null;
    request.tvShowSeasons = [];
    prisma.tvShowSeason.create.mockImplementation(async ({ data }) => ({ id: `s${data.seasonNumber}`, ...data }));
    await addFile('Shōgun (2024)', 'Season 1', 'Episode 04.mkv');

    await service.scanTvShowRequest('request-1');

    expect(prisma.tvShowSeason.create).toHaveBeenCalledWith({
      data: { requestedTorrentId: 'request-1', seasonNumber: 1 },
    });
    expect(prisma.tvShowEpisode.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tvShowSeasonId: 's1', episodeNumber: 4, status: EpisodeStatus.COMPLETED }),
    });
  });
});
