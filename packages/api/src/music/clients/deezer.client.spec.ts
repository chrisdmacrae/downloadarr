import { parseDeezerProfileId } from './deezer.client';

describe('parseDeezerProfileId', () => {
  it.each([
    ['123456', 123456],
    ['  42 ', 42],
    ['https://www.deezer.com/profile/123456', 123456],
    ['https://www.deezer.com/en/profile/123456', 123456],
    ['https://www.deezer.com/pt-br/profile/987/loved', 987],
    ['deezer.com/fr/profile/5', 5],
  ])('reads %s', (input, expected) => {
    expect(parseDeezerProfileId(input)).toBe(expected);
  });

  it.each(['', 'rob', 'https://www.deezer.com/en/artist/27', 'https://link.deezer.com/s/abc'])(
    'rejects %s',
    (input) => {
      expect(parseDeezerProfileId(input)).toBeNull();
    },
  );
});
