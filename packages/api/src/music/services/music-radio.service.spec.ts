import { albumsOf, Candidate, mergeStations } from './music-radio.service';

const track = (title: string, artistName: string, albumTitle?: string, source: Candidate['source'] = 'deezer'): Candidate => ({
  title,
  artistName,
  albumTitle,
  durationSeconds: 200,
  previewUrl: 'https://example.com/p.mp3',
  source,
});

describe('mergeStations', () => {
  it('alternates stations and drops tracks already played', () => {
    const deezer = [track('Airbag', 'Radiohead'), track('Karma Police', 'Radiohead'), track('Wires', 'Athlete')];
    const lb = [track('Karma Police', 'radiohead', undefined, 'listenbrainz'), track('Teardrop', 'Massive Attack', undefined, 'listenbrainz')];
    expect(mergeStations(deezer, lb).map((t) => t.title)).toEqual(['Airbag', 'Karma Police', 'Teardrop', 'Wires']);
  });

  it('handles an empty station', () => {
    expect(mergeStations([track('Airbag', 'Radiohead')], [])).toHaveLength(1);
    expect(mergeStations([], [])).toEqual([]);
  });
});

describe('albumsOf', () => {
  it('collects albums in first-heard order, merging editions and sources', () => {
    const albums = albumsOf([
      track('Airbag', 'Radiohead', 'OK Computer'),
      track('Teardrop', 'Massive Attack', 'Mezzanine'),
      track('Lucky', 'Radiohead', 'OK Computer (Deluxe Edition)', 'listenbrainz'),
    ]);
    expect(albums.map((a) => a.albumTitle)).toEqual(['OK Computer', 'Mezzanine']);
    expect(albums[0].sources).toEqual(['deezer', 'listenbrainz']);
  });

  it('skips singles and tracks without an album', () => {
    expect(albumsOf([track('Creep', 'Radiohead', 'Creep'), track('Nude', 'Radiohead')])).toEqual([]);
  });
});
