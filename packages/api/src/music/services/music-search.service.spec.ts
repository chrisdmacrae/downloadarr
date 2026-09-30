import { fromDeezer, fromSpotify, MusicSearchService, rankSearchAlbums } from './music-search.service';

const deezer = (id: number, title: string, artistName: string, recordType = 'album') =>
  fromDeezer({ id, title, artistName, recordType });

describe('rankSearchAlbums', () => {
  it('keeps the first edition of each album and moves singles last', () => {
    const ranked = rankSearchAlbums([
      deezer(1, 'Creep', 'Radiohead', 'single'),
      deezer(2, 'OK Computer', 'Radiohead'),
      deezer(3, 'OK Computer (Deluxe Edition)', 'Radiohead'),
      deezer(4, 'Kid A', 'Radiohead'),
      deezer(5, 'My Iron Lung', 'Radiohead', 'ep'),
      deezer(6, 'Kid A', 'Radiohead'),
    ]);

    expect(ranked.map((a) => a.id)).toEqual(['deezer:2', 'deezer:4', 'deezer:5', 'deezer:1']);
    expect(ranked[0]).toMatchObject({ artistName: 'Radiohead', albumTitle: 'OK Computer', source: 'deezer' });
  });

  it('keeps albums of the same name by different artists', () => {
    const ranked = rankSearchAlbums([
      deezer(1, 'Greatest Hits', 'Queen', 'compile'),
      deezer(2, 'Greatest Hits', 'ABBA', 'compile'),
    ]);

    expect(ranked).toHaveLength(2);
  });

  it('skips albums with no artist', () => {
    expect(rankSearchAlbums([fromDeezer({ id: 1, title: 'Untitled' })])).toEqual([]);
  });

  it('keeps the Deezer copy of an album on both, with Spotify’s release date', () => {
    const ranked = rankSearchAlbums([
      deezer(1, 'Kid A', 'Radiohead'),
      fromSpotify({ id: 'sp1', title: 'KID A', artistName: 'Radiohead', albumType: 'album', releaseDate: '2000-10-02' }),
      fromSpotify({ id: 'sp2', title: 'Rare B-Sides', artistName: 'Radiohead', albumType: 'compilation' }),
    ]);

    expect(ranked).toEqual([
      expect.objectContaining({ id: 'deezer:1', source: 'deezer', releaseDate: '2000-10-02' }),
      expect.objectContaining({ id: 'spotify:sp2', source: 'spotify', recordType: 'compile' }),
    ]);
  });
});

describe('MusicSearchService.search', () => {
  const setup = (opts: { deezer: () => Promise<any>; spotify?: () => Promise<any>; connected?: boolean }) => {
    const prisma = {
      recommendationSource: {
        findFirst: jest.fn(async () => (opts.connected === false ? null : { id: 's1', refreshToken: 'r' })),
      },
    };
    const service = new MusicSearchService(
      prisma as any,
      { searchAlbums: jest.fn(opts.deezer) } as any,
      { searchAlbums: jest.fn(opts.spotify ?? (async () => [])) } as any,
      { accessToken: jest.fn(async () => 'token') } as any,
    );
    return service;
  };

  it('adds Spotify albums Deezer doesn’t have', async () => {
    const service = setup({
      deezer: async () => [{ id: 1, title: 'Kid A', artistName: 'Radiohead', recordType: 'album' }],
      spotify: async () => [{ id: 'sp', title: 'Obscure LP', artistName: 'Radiohead', albumType: 'album' }],
    });

    expect((await service.search('radiohead')).map((a) => a.id)).toEqual(['deezer:1', 'spotify:sp']);
  });

  it('returns Deezer results when Spotify fails', async () => {
    const service = setup({
      deezer: async () => [{ id: 1, title: 'Kid A', artistName: 'Radiohead', recordType: 'album' }],
      spotify: async () => {
        throw new Error('401');
      },
    });

    expect(await service.search('radiohead')).toHaveLength(1);
  });

  it('returns Spotify results when Deezer fails', async () => {
    const service = setup({
      deezer: async () => {
        throw new Error('quota');
      },
      spotify: async () => [{ id: 'sp', title: 'Kid A', artistName: 'Radiohead', albumType: 'album' }],
    });

    expect((await service.search('radiohead')).map((a) => a.id)).toEqual(['spotify:sp']);
  });

  it('fails when Deezer fails and no Spotify account is connected', async () => {
    const service = setup({
      deezer: async () => {
        throw new Error('quota');
      },
      connected: false,
    });

    await expect(service.search('radiohead')).rejects.toThrow('quota');
  });
});
