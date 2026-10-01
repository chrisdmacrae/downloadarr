import {
  normalizeShowTitle,
  parseEpisodesFromFileName,
  parseSeasonFromFolderName,
  parseYearFromFolderName,
} from './episode-files';

describe('parseEpisodesFromFileName', () => {
  it.each([
    ['Show.Name.S01E05.1080p.WEB.x265-GROUP.mkv', 1, [5]],
    ['Show Name - S02E10 - Episode Title.mkv', 2, [10]],
    ['show.name.s03.e07.720p.mkv', 3, [7]],
    ['Show Name S01 E02.mp4', 1, [2]],
    ['Show.Name.1x03.HDTV.avi', 1, [3]],
    ['Show Name Season 2 Episode 4.mkv', 2, [4]],
    ['Daily.Show.S29E142.1080p.mkv', 29, [142]],
  ])('reads %s', (fileName, season, episodes) => {
    expect(parseEpisodesFromFileName(fileName)).toEqual({ season, episodes });
  });

  it.each([
    ['Show.S01E01E02.1080p.mkv', [1, 2]],
    ['Show.S01E01-E03.1080p.mkv', [1, 2, 3]],
    ['Show.S01E01-02.1080p.mkv', [1, 2]],
    ['Show - S01E01-E02 - Pilot.mkv', [1, 2]],
  ])('reads every episode in %s', (fileName, episodes) => {
    expect(parseEpisodesFromFileName(fileName)).toEqual({ season: 1, episodes });
  });

  it('does not read a quality as a second episode', () => {
    expect(parseEpisodesFromFileName('Show.S01E01-1080p.mkv')).toEqual({ season: 1, episodes: [1] });
    expect(parseEpisodesFromFileName('Show.S01E01-720p.mkv')).toEqual({ season: 1, episodes: [1] });
  });

  it('does not read a resolution as an episode', () => {
    expect(parseEpisodesFromFileName('Show.1920x1080.mkv')).toBeNull();
  });

  it('takes the season from the folder for episode-only names', () => {
    expect(parseEpisodesFromFileName('Episode 05.mkv', 2)).toEqual({ season: 2, episodes: [5] });
    expect(parseEpisodesFromFileName('E12 - Title.mkv', 3)).toEqual({ season: 3, episodes: [12] });
    expect(parseEpisodesFromFileName('Episode 05.mkv')).toBeNull();
  });

  it('prefers the file name over the folder it sits in', () => {
    expect(parseEpisodesFromFileName('Show.S02E03.mkv', 1)).toEqual({ season: 2, episodes: [3] });
  });
});

describe('folder names', () => {
  it('reads season folders', () => {
    expect(parseSeasonFromFolderName('Season 1')).toBe(1);
    expect(parseSeasonFromFolderName('Season 02')).toBe(2);
    expect(parseSeasonFromFolderName('S03')).toBe(3);
    expect(parseSeasonFromFolderName('Specials')).toBeNull();
    expect(parseSeasonFromFolderName('Scrubs')).toBeNull();
  });

  it('reads the year', () => {
    expect(parseYearFromFolderName('Shogun (2024)')).toBe(2024);
    expect(parseYearFromFolderName('Shogun')).toBeNull();
  });

  it('matches a folder to the title it was named after', () => {
    expect(normalizeShowTitle('Shogun (2024)')).toBe(normalizeShowTitle('Shōgun'));
    expect(normalizeShowTitle("Marvels Agents of S.H.I.E.L.D")).toBe(normalizeShowTitle("Marvel's Agents of S.H.I.E.L.D."));
    expect(normalizeShowTitle('Star Trek_ Picard (2020)')).toBe(normalizeShowTitle('Star Trek: Picard'));
    expect(normalizeShowTitle('Office (2005)')).toBe(normalizeShowTitle('The Office'));
    expect(normalizeShowTitle('Law and Order')).toBe(normalizeShowTitle('Law & Order'));
  });
});
