import { albumDismissalKey, albumKey, artistDismissalKey, nameKey } from './music-keys';

describe('nameKey', () => {
  it.each([
    ['The Beatles', 'Beatles'],
    ['Sigur Rós', 'Sigur Ros'],
    ['Simon & Garfunkel', 'Simon and Garfunkel'],
    ['AC/DC', 'ac dc'],
    ['  Björk ', 'bjork'],
  ])('matches %s with %s', (a, b) => {
    expect(nameKey(a)).toBe(nameKey(b));
  });

  it('keeps distinct names distinct', () => {
    expect(nameKey('Theatre of Tragedy')).not.toBe(nameKey('Atre of Tragedy'));
  });
});

describe('albumKey', () => {
  it.each([
    ['OK Computer (Remastered)', 'OK Computer'],
    ['Abbey Road [2019 Remaster]', 'Abbey Road'],
    ['Currents (Deluxe Edition)', 'Currents'],
  ])('drops edition suffixes from %s', (a, b) => {
    expect(albumKey(a)).toBe(albumKey(b));
  });

  it('keeps meaningful parentheses', () => {
    expect(albumKey('(What’s the Story) Morning Glory?')).not.toBe(albumKey('Morning Glory'));
  });

  it('never returns an empty key for a title that is all suffix', () => {
    expect(albumKey('(Deluxe Edition)')).not.toBe('');
  });
});

describe('dismissal keys', () => {
  it('match across spellings', () => {
    expect(artistDismissalKey('The National')).toBe(artistDismissalKey('national'));
    expect(albumDismissalKey('Beatles', 'Abbey Road (Remastered)')).toBe(albumDismissalKey('The Beatles', 'Abbey Road'));
  });
});
