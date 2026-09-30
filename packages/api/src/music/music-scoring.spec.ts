import { normalizeByMax, rankSimilarity, scoreCandidates, SimilarityEdge, TasteArtist } from './music-scoring';

const taste: TasteArtist[] = [
  { key: 'radiohead', name: 'Radiohead', weight: 1 },
  { key: 'portishead', name: 'Portishead', weight: 0.5 },
];

const edge = (
  seedKey: string,
  name: string,
  similarity: number,
  source: SimilarityEdge['source'] = 'lastfm',
): SimilarityEdge => ({ seedKey, candidate: { key: name.toLowerCase(), name }, similarity, source });

const options = (overrides = {}) => ({
  knownKeys: new Set<string>(),
  dismissedKeys: new Set<string>(),
  limit: 10,
  ...overrides,
});

describe('scoreCandidates', () => {
  it('weights similarity by how much you play the seed', () => {
    const result = scoreCandidates(taste, [edge('radiohead', 'A', 0.5), edge('portishead', 'B', 0.9)], options());
    expect(result.map((r) => r.name)).toEqual(['A', 'B']);
    expect(result[0].score).toBeCloseTo(0.5);
    expect(result[1].score).toBeCloseTo(0.45);
  });

  it('sums contributions across seeds and orders reasons by contribution', () => {
    const [result] = scoreCandidates(taste, [edge('portishead', 'Massive Attack', 0.9), edge('radiohead', 'Massive Attack', 0.2)], options());
    expect(result.score).toBeCloseTo(0.65);
    expect(result.because).toEqual(['Portishead', 'Radiohead']);
  });

  it('rewards candidates several providers agree on', () => {
    const result = scoreCandidates(
      taste,
      [edge('radiohead', 'Agreed', 0.4, 'lastfm'), edge('radiohead', 'Agreed', 0.4, 'deezer'), edge('radiohead', 'Solo', 0.8, 'lastfm')],
      options(),
    );
    const agreed = result.find((r) => r.name === 'Agreed')!;
    expect(agreed.score).toBeCloseTo(0.8 * 1.25);
    expect(agreed.sources).toEqual(['deezer', 'lastfm']);
    expect(result[0].name).toBe('Agreed');
  });

  it('never recommends known, dismissed or seed artists', () => {
    const result = scoreCandidates(
      taste,
      [edge('radiohead', 'Known', 1), edge('radiohead', 'Dismissed', 1), edge('radiohead', 'Portishead', 1), edge('radiohead', 'Fresh', 0.1)],
      options({ knownKeys: new Set(['known', 'portishead']), dismissedKeys: new Set(['dismissed']) }),
    );
    expect(result.map((r) => r.name)).toEqual(['Fresh']);
  });

  it('caps how many results one seed can dominate', () => {
    const edges = ['A', 'B', 'C', 'D'].map((name) => edge('radiohead', name, 0.9)).concat(edge('portishead', 'E', 0.1));
    const result = scoreCandidates(taste, edges, options({ maxPerSeed: 2 }));
    expect(result.map((r) => r.name)).toEqual(['A', 'B', 'E']);
  });

  it('ignores edges from unknown seeds and clamps similarity', () => {
    const result = scoreCandidates(taste, [edge('nobody', 'X', 1), edge('radiohead', 'Y', 7)], options());
    expect(result).toHaveLength(1);
    expect(result[0].score).toBe(1);
  });
});

describe('normalizeByMax', () => {
  it('scales the largest value to 1', () => {
    expect(normalizeByMax([2, 4], (n) => n).map((r) => r.norm)).toEqual([0.5, 1]);
  });

  it('handles all-zero input', () => {
    expect(normalizeByMax([0], (n) => n)[0].norm).toBe(0);
  });
});

describe('rankSimilarity', () => {
  it('decreases with position', () => {
    expect(rankSimilarity(0, 4)).toBe(1);
    expect(rankSimilarity(2, 4)).toBe(0.5);
    expect(rankSimilarity(0, 1)).toBe(1);
  });
});
