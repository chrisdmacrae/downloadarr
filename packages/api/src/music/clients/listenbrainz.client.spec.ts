import { toRadioTrack } from './listenbrainz.client';

describe('toRadioTrack', () => {
  it('reads the artist credit and cover from the JSPF extension', () => {
    expect(
      toRadioTrack({
        title: 'Teardrop',
        creator: 'Massive Attack feat. Elizabeth Fraser',
        album: 'Mezzanine',
        extension: {
          'https://musicbrainz.org/doc/jspf#track': {
            additional_metadata: {
              artists: [{ artist_credit_name: 'Massive Attack', artist_mbid: 'mbid-1' }],
              caa_release_mbid: 'caa-1',
            },
          },
        },
      }),
    ).toEqual({ title: 'Teardrop', artistName: 'Massive Attack', artistMbid: 'mbid-1', albumTitle: 'Mezzanine', caaReleaseMbid: 'caa-1' });
  });

  it('falls back to the creator and leaves a missing album out', () => {
    expect(toRadioTrack({ title: 'Nude', creator: 'Radiohead' })).toEqual({
      title: 'Nude',
      artistName: 'Radiohead',
      artistMbid: undefined,
      albumTitle: undefined,
      caaReleaseMbid: undefined,
    });
  });

  it.each([{}, { title: 'X' }, { title: 'X', creator: 'Various Artists' }])('rejects %j', (input) => {
    expect(toRadioTrack(input)).toBeNull();
  });
});
