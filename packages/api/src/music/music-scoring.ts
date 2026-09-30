export type SimilaritySource = 'listenbrainz' | 'lastfm' | 'deezer';

export interface TasteArtist {
  key: string;
  name: string;
  /** 0–1, 1 being your most played artist. */
  weight: number;
}

export interface SimilarityEdge {
  seedKey: string;
  candidate: { key: string; name: string; mbid?: string };
  /** 0–1 within the seed's list, 1 being the most similar. */
  similarity: number;
  source: SimilaritySource;
}

export interface ScoredArtist {
  key: string;
  name: string;
  mbid?: string;
  score: number;
  /** Seed artist names, strongest contribution first. */
  because: string[];
  sources: SimilaritySource[];
}

export interface ScoreOptions {
  /** Artists you already listen to; never recommended. */
  knownKeys: Set<string>;
  /** Artists marked "not interested". */
  dismissedKeys: Set<string>;
  limit: number;
  /** At most this many results may share the same strongest seed. */
  maxPerSeed?: number;
  /** Bonus per extra provider that agrees on a candidate. */
  agreementBonus?: number;
}

/**
 * Scores candidates by how strongly your taste points at them: the sum, over
 * every seed that lists the candidate, of seed weight × similarity. Candidates
 * several providers agree on get a bonus, and a per-seed cap stops one heavily
 * played artist from filling the whole list with its neighbours.
 */
export function scoreCandidates(
  taste: TasteArtist[],
  edges: SimilarityEdge[],
  options: ScoreOptions,
): ScoredArtist[] {
  const { knownKeys, dismissedKeys, limit, maxPerSeed = 3, agreementBonus = 0.25 } = options;
  const seeds = new Map(taste.map((artist) => [artist.key, artist]));

  const candidates = new Map<
    string,
    {
      name: string;
      mbid?: string;
      raw: number;
      contributions: Map<string, number>;
      sources: Set<SimilaritySource>;
    }
  >();

  for (const edge of edges) {
    const seed = seeds.get(edge.seedKey);
    const key = edge.candidate.key;
    if (!seed || !key || key === edge.seedKey) continue;
    if (knownKeys.has(key) || dismissedKeys.has(key)) continue;

    const contribution = seed.weight * Math.max(0, Math.min(1, edge.similarity));
    if (contribution <= 0) continue;

    let entry = candidates.get(key);
    if (!entry) {
      entry = {
        name: edge.candidate.name,
        mbid: edge.candidate.mbid,
        raw: 0,
        contributions: new Map(),
        sources: new Set(),
      };
      candidates.set(key, entry);
    }
    entry.mbid ??= edge.candidate.mbid;
    entry.raw += contribution;
    entry.contributions.set(seed.name, (entry.contributions.get(seed.name) ?? 0) + contribution);
    entry.sources.add(edge.source);
  }

  const ranked = [...candidates.entries()]
    .map(([key, entry]) => ({
      key,
      name: entry.name,
      mbid: entry.mbid,
      score: entry.raw * (1 + agreementBonus * (entry.sources.size - 1)),
      because: [...entry.contributions.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name),
      sources: [...entry.sources].sort(),
    }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  const perSeed = new Map<string, number>();
  const result: ScoredArtist[] = [];
  for (const candidate of ranked) {
    if (result.length >= limit) break;
    const topSeed = candidate.because[0];
    const used = perSeed.get(topSeed) ?? 0;
    if (used >= maxPerSeed) continue;
    perSeed.set(topSeed, used + 1);
    result.push(candidate);
  }
  return result;
}

/** Scales a list of raw values so its largest is 1. */
export function normalizeByMax<T>(items: T[], value: (item: T) => number): Array<{ item: T; norm: number }> {
  const max = Math.max(0, ...items.map(value));
  return items.map((item) => ({ item, norm: max > 0 ? value(item) / max : 0 }));
}

/** Similarity from list position, for providers that rank without scores. */
export function rankSimilarity(index: number, total: number): number {
  return total <= 1 ? 1 : 1 - index / total;
}
