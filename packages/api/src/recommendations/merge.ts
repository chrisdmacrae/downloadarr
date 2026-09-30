/**
 * The "Everyone" view: one list built from every profile's copy of it. An item
 * several profiles share appears once, at the best rank any of them gave it,
 * with ties going to the item more profiles share.
 */
export interface ProfileRanked {
  profileId: string;
  rank: number;
}

export type Merged<T> = T & { profileIds: string[] };

export function mergeAcrossProfiles<T extends ProfileRanked>(
  rows: T[],
  keyOf: (row: T) => string,
  combine: (into: T, row: T) => void = () => undefined,
): Merged<T>[] {
  const groups = new Map<string, { item: Merged<T>; bestRank: number }>();
  for (const row of [...rows].sort((a, b) => a.rank - b.rank)) {
    const key = keyOf(row);
    const group = groups.get(key);
    if (!group) {
      groups.set(key, { item: { ...row, profileIds: [row.profileId] }, bestRank: row.rank });
      continue;
    }
    if (!group.item.profileIds.includes(row.profileId)) group.item.profileIds.push(row.profileId);
    combine(group.item, row);
  }
  return [...groups.values()]
    .sort((a, b) => a.bestRank - b.bestRank || b.item.profileIds.length - a.item.profileIds.length)
    .map(({ item }, rank) => ({ ...item, rank }));
}

/** Union of two string lists, keeping first-seen order. */
export function union(a: string[], b: string[]): string[] {
  return [...new Set([...a, ...b])];
}
