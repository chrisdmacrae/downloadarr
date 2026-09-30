import { TorrentResult } from '../interfaces/external-api.interface';
import { detectAudioFormat, rankMusicReleases } from './music-release-ranker';

const release = (title: string, seeders = 10): TorrentResult => ({
  title,
  seeders,
  link: `magnet:?xt=${encodeURIComponent(title)}`,
  size: '500 MB',
  leechers: 0,
  category: 'Audio',
  indexer: 'test',
  publishDate: '',
});

const titles = (list: TorrentResult[]) => list.map((t) => t.title);

describe('detectAudioFormat', () => {
  it.each([
    ['Radiohead - In Rainbows (2007) [FLAC 24bit-96kHz]', 'FLAC_24'],
    ['Radiohead - In Rainbows (2007) FLAC', 'FLAC'],
    ['Radiohead - In Rainbows [MP3 320]', 'MP3_320'],
    ['Radiohead - In Rainbows (V0)', 'MP3_V0'],
    ['Radiohead - In Rainbows mp3 192kbps', 'MP3'],
    ['Radiohead - In Rainbows AAC', 'AAC'],
    ['Radiohead - In Rainbows', 'UNKNOWN'],
  ])('%s → %s', (title, format) => {
    expect(detectAudioFormat(title)).toBe(format);
  });
});

describe('rankMusicReleases', () => {
  const target = { artist: 'Radiohead', album: 'In Rainbows', year: 2007 };

  it('prefers lossless, then lossy by bitrate', () => {
    const ranked = rankMusicReleases(
      [
        release('Radiohead - In Rainbows (2007) MP3 320', 50),
        release('Radiohead - In Rainbows (2007) FLAC', 50),
        release('Radiohead - In Rainbows (2007) V0', 50),
      ],
      target,
    );
    expect(titles(ranked)).toEqual([
      'Radiohead - In Rainbows (2007) FLAC',
      'Radiohead - In Rainbows (2007) MP3 320',
      'Radiohead - In Rainbows (2007) V0',
    ]);
  });

  it('requires the artist and every album word', () => {
    const ranked = rankMusicReleases(
      [
        release('Radiohead - OK Computer FLAC'),
        release('Thom Yorke - In Rainbows Live FLAC'),
        release('Radiohead In.Rainbows.2007.FLAC'),
      ],
      target,
    );
    expect(titles(ranked)).toEqual(['Radiohead In.Rainbows.2007.FLAC']);
  });

  it('drops discographies and video', () => {
    const ranked = rankMusicReleases(
      [
        release('Radiohead - Discography 1993-2016 (In Rainbows, Kid A...) FLAC', 500),
        release('Radiohead - In Rainbows From the Basement 1080p', 500),
        release('Radiohead - In Rainbows FLAC', 5),
      ],
      target,
    );
    expect(titles(ranked)).toEqual(['Radiohead - In Rainbows FLAC']);
  });

  it('keeps bundle words when the album is named that', () => {
    const ranked = rankMusicReleases([release('Tool - Collection FLAC')], { artist: 'Tool', album: 'Collection' });
    expect(ranked).toHaveLength(1);
  });

  it('matches across accents and ampersands', () => {
    const ranked = rankMusicReleases(
      [release('Sigur Ros - Agaetis Byrjun FLAC'), release('Simon and Garfunkel - Bookends MP3 320')],
      { artist: 'Sigur Rós', album: 'Ágætis byrjun' },
    );
    expect(titles(ranked)).toEqual(['Sigur Ros - Agaetis Byrjun FLAC']);
    expect(
      rankMusicReleases([release('Simon and Garfunkel - Bookends MP3 320')], {
        artist: 'Simon & Garfunkel',
        album: 'Bookends',
      }),
    ).toHaveLength(1);
  });

  it('breaks format ties on seeders', () => {
    const ranked = rankMusicReleases(
      [release('Radiohead - In Rainbows FLAC', 2), release('Radiohead - In Rainbows FLAC [WEB]', 200)],
      target,
    );
    expect(ranked[0].seeders).toBe(200);
  });
});
