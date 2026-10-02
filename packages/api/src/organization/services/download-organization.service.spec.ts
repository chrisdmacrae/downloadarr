import { DownloadOrganizationService } from './download-organization.service';
import { ContentType } from '../../../generated/prisma';

describe('DownloadOrganizationService', () => {
  let organizeFile: jest.Mock;
  let service: DownloadOrganizationService;

  const tvShow = { contentType: ContentType.TV_SHOW, title: 'Severance', year: 2022, requestId: 'request-1' };
  const movie = { contentType: ContentType.MOVIE, title: 'Heat', year: 1995 };
  const organizedAs = () => organizeFile.mock.calls.map(([context]) => context.fileName);

  beforeEach(() => {
    organizeFile = jest.fn(async context => ({ success: true, originalPath: context.originalPath, organizedPath: '/library/x' }));
    service = new DownloadOrganizationService({ organizeFile } as any);
  });

  it('organizes subtitles, which used to be left in the downloads folder', async () => {
    const outcome = await service.organizeFiles(
      ['/downloads/tv-shows/Sev.S01/Severance.S01E01.mkv', '/downloads/tv-shows/Sev.S01/Severance.S01E01.en.srt'],
      tvShow,
    );

    expect(outcome.organized).toHaveLength(2);
    expect(organizedAs()).toEqual(['Severance.S01E01.mkv', 'Severance.S01E01.en.srt']);
    expect(organizeFile.mock.calls[1][0]).toMatchObject({ season: 1, episode: 1 });
  });

  it('names a subtitle from a per-episode Subs folder after its episode', async () => {
    await service.organizeFiles(
      [
        '/downloads/tv-shows/Sev.S01/Severance.S01E01.mkv',
        '/downloads/tv-shows/Sev.S01/Severance.S01E02.mkv',
        '/downloads/tv-shows/Sev.S01/Subs/Severance.S01E01/2_English.srt',
        '/downloads/tv-shows/Sev.S01/Subs/Severance.S01E02/2_English.srt',
      ],
      tvShow,
    );

    expect(organizedAs().slice(2)).toEqual(['Severance.S01E01.2_English.srt', 'Severance.S01E02.2_English.srt']);
    expect(organizeFile.mock.calls[3][0]).toMatchObject({ season: 1, episode: 2 });
  });

  it("names a movie's loose subtitle after the movie", async () => {
    await service.organizeFiles(['/downloads/movies/Heat.1995/Heat.1995.1080p.mkv', '/downloads/movies/Heat.1995/Subs/English.srt'], movie);

    expect(organizedAs()).toEqual(['Heat.1995.1080p.mkv', 'Heat.1995.1080p.English.srt']);
  });

  it('still leaves release notes, samples and checksums behind', async () => {
    const outcome = await service.organizeFiles(
      ['/d/Heat/Heat.mkv', '/d/Heat/Heat.nfo', '/d/Heat/sample.mkv', '/d/Heat/Heat.sfv', '/d/Heat/Heat.mkv.aria2'],
      movie,
    );

    expect(organizedAs()).toEqual(['Heat.mkv']);
    expect(outcome.skipped).toHaveLength(4);
  });

  it('tells a file that could not be moved from one that is gone', async () => {
    organizeFile
      .mockResolvedValueOnce({ success: false, error: 'EACCES: permission denied' })
      .mockResolvedValueOnce({ success: false, error: 'File not found' });

    const outcome = await service.organizeFiles(['/d/a.mkv', '/d/b.mkv', '/d/c.mkv'], movie);

    expect(outcome.failed).toEqual([{ path: '/d/a.mkv', error: 'EACCES: permission denied' }]);
    expect(outcome.missing).toEqual(['/d/b.mkv']);
    expect(outcome.organized).toEqual(['/d/c.mkv']);
  });

  it('uses the given season only for files that do not name their own', async () => {
    await service.organizeFiles(['/d/Show/Episode 05.mkv', '/d/Show/Show.S03E01.mkv'], { ...tvShow, season: 2 });

    expect(organizeFile.mock.calls.map(([context]) => context.season)).toEqual([2, 3]);
  });
});
