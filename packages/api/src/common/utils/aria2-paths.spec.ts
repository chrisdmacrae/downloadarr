import { fromAria2Path, toAria2Path } from './aria2-paths';

describe('aria2 paths', () => {
  describe('with aria2 in a container of its own (the defaults)', () => {
    const env = {};

    it('translates this server’s download folder to aria2’s', () => {
      expect(toAria2Path('/app/downloads/movies', env)).toBe('/downloads/movies');
      expect(toAria2Path('/app/downloads', env)).toBe('/downloads');
    });

    it('leaves aria2’s own paths alone, and defaults to its download folder', () => {
      expect(toAria2Path('/downloads/games', env)).toBe('/downloads/games');
      expect(toAria2Path(undefined, env)).toBe('/downloads');
    });

    it('puts any other path inside the download folder', () => {
      expect(toAria2Path('/tv-shows', env)).toBe('/downloads/tv-shows');
      expect(toAria2Path('other', env)).toBe('/downloads/other');
    });

    it('translates what aria2 reports back', () => {
      expect(fromAria2Path('/downloads/movies/a.mkv', env)).toBe('/app/downloads/movies/a.mkv');
      expect(fromAria2Path('/app/downloads/movies/a.mkv', env)).toBe('/app/downloads/movies/a.mkv');
      expect(fromAria2Path('movies/a.mkv', env)).toBe('/app/downloads/movies/a.mkv');
    });

    it('doesn’t mistake a folder whose name only starts the same', () => {
      expect(fromAria2Path('/downloads-old/a.mkv', env)).toBe('/app/downloads/downloads-old/a.mkv');
    });
  });

  describe('with aria2 beside the server, seeing the same files', () => {
    const env = { DOWNLOAD_PATH: '/data/downloads/', ARIA2_DOWNLOAD_PATH: '/data/downloads' };

    it('leaves paths as they are', () => {
      expect(toAria2Path('/data/downloads/movies', env)).toBe('/data/downloads/movies');
      expect(toAria2Path(undefined, env)).toBe('/data/downloads');
      expect(fromAria2Path('/data/downloads/movies/a.mkv', env)).toBe('/data/downloads/movies/a.mkv');
    });
  });
});
