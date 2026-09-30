import { DeezerAlbum } from '../clients/deezer.client';
import { closestAlbum, MusicSimilarService } from './music-similar.service';

const album = (id: number, title: string, releaseDate: string, genreId = 152, recordType = 'album'): DeezerAlbum => ({
  id,
  title,
  releaseDate,
  genreId,
  recordType,
});

describe('closestAlbum', () => {
  it('picks the album nearest in time, in the same genre', () => {
    const albums = [album(1, 'Late', '2020-01-01'), album(2, 'Middle', '2008-01-01'), album(3, 'Early', '1995-01-01')];
    expect(closestAlbum(albums, { genreId: 152, releaseDate: '2007-10-10' })?.id).toBe(2);
  });

  it('prefers the same genre over a closer year', () => {
    const albums = [album(1, 'Electronic turn', '2007-01-01', 106), album(2, 'Rock record', '2003-01-01', 152)];
    expect(closestAlbum(albums, { genreId: 152, releaseDate: '2007-10-10' })?.id).toBe(2);
  });

  it('skips singles, EPs, compilations and live records', () => {
    const albums = [
      album(1, 'Hit', '2007-01-01', 152, 'single'),
      album(2, 'Greatest Hits', '2007-01-01', 152, 'compile'),
      album(3, 'Live at Somewhere', '2007-01-01'),
      album(4, 'Studio Album', '1999-01-01'),
    ];
    expect(closestAlbum(albums, { releaseDate: '2007-01-01' })?.id).toBe(4);
  });

  it('takes the newest album when there is nothing to compare with', () => {
    expect(closestAlbum([album(1, 'Newest', '2021-01-01'), album(2, 'Older', '2010-01-01')], {})?.id).toBe(1);
  });

  it('is null without a proper album', () => {
    expect(closestAlbum([album(1, 'Hit', '2007-01-01', 152, 'single')], {})).toBeNull();
  });
});

describe('MusicSimilarService.similar', () => {
  const setup = (dismissed: string[] = []) => {
    const deezer = {
      findArtist: jest.fn().mockResolvedValue({ id: 1, name: 'Radiohead' }),
      findAlbum: jest.fn().mockResolvedValue({ id: 10, title: 'In Rainbows' }),
      album: jest.fn().mockResolvedValue(album(10, 'In Rainbows', '2007-10-10')),
      relatedArtists: jest.fn().mockResolvedValue([
        { id: 2, name: 'Thom Yorke' },
        { id: 3, name: 'Portishead' },
        { id: 4, name: 'Nobody' },
      ]),
      artistAlbums: jest.fn(async (id: number) =>
        ({
          2: [album(20, 'Anima', '2019-06-27'), album(21, 'The Eraser', '2006-07-10')],
          3: [album(30, 'Third', '2008-04-28')],
          4: [],
        })[id],
      ),
    };
    const lists = { dismissedKeys: jest.fn().mockResolvedValue(new Set(dismissed)) };
    return { deezer, service: new MusicSimilarService(deezer as any, lists as any) };
  };

  it('lists each related artist’s closest album, in Deezer’s order', async () => {
    const { service } = setup();
    const albums = await service.similar('Radiohead', 'In Rainbows', []);
    expect(albums).toEqual([
      { id: 'deezer:21', artistName: 'Thom Yorke', albumTitle: 'The Eraser', coverUrl: undefined, releaseDate: '2006-07-10' },
      { id: 'deezer:30', artistName: 'Portishead', albumTitle: 'Third', coverUrl: undefined, releaseDate: '2008-04-28' },
    ]);
  });

  it('leaves out dismissed artists', async () => {
    const { service } = setup(['artist:portishead']);
    const albums = await service.similar('Radiohead', 'In Rainbows', []);
    expect(albums.map((a) => a.artistName)).toEqual(['Thom Yorke']);
  });

  it('builds once a day per album', async () => {
    const { service, deezer } = setup();
    await service.similar('Radiohead', 'In Rainbows', []);
    await service.similar('radiohead', 'In Rainbows (Deluxe Edition)', []);
    expect(deezer.relatedArtists).toHaveBeenCalledTimes(1);
  });

  it('still works when the album isn’t on Deezer', async () => {
    const { service, deezer } = setup();
    deezer.findAlbum.mockResolvedValue(null);
    const albums = await service.similar('Radiohead', 'Unreleased', []);
    expect(albums.map((a) => a.id)).toEqual(['deezer:20', 'deezer:30']);
  });

  it('is empty when Deezer doesn’t know the artist', async () => {
    const { service, deezer } = setup();
    deezer.findArtist.mockResolvedValue(null);
    expect(await service.similar('Nobody Knows', 'Nothing', [])).toEqual([]);
  });
});
