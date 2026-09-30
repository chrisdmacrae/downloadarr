import { mergeAcrossProfiles, union } from './merge';

const row = (profileId: string, rank: number, key: string, sources: string[] = []) => ({ profileId, rank, key, sources });

describe('mergeAcrossProfiles', () => {
  it('keeps one item per key at its best rank, and records every profile', () => {
    const merged = mergeAcrossProfiles(
      [row('a', 0, 'x'), row('a', 1, 'y'), row('b', 0, 'y'), row('b', 1, 'z')],
      (r) => r.key,
    );
    expect(merged.map((m) => [m.key, m.rank, m.profileIds])).toEqual([
      ['y', 0, ['b', 'a']],
      ['x', 1, ['a']],
      ['z', 2, ['b']],
    ]);
  });

  it('combines the rest of each row into the best-ranked one', () => {
    const merged = mergeAcrossProfiles(
      [row('a', 3, 'x', ['lastfm']), row('b', 1, 'x', ['deezer'])],
      (r) => r.key,
      (into, r) => (into.sources = union(into.sources, r.sources)),
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].sources).toEqual(['deezer', 'lastfm']);
    expect(merged[0].profileIds).toEqual(['b', 'a']);
  });

  it('lists a profile once even when it has the item twice', () => {
    expect(mergeAcrossProfiles([row('a', 0, 'x'), row('a', 1, 'x')], (r) => r.key)[0].profileIds).toEqual(['a']);
  });
});
