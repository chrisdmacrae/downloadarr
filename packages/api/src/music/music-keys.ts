/**
 * Providers disagree on spelling ("The Beatles" vs "Beatles", "Sigur Rós" vs
 * "Sigur Ros"), and Last.fm often has no MBID, so artists and albums are merged
 * on a normalized name instead.
 */
export function nameKey(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/^the\s+/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Album titles also drop edition suffixes: "(Deluxe Edition)", "[Remastered 2011]". */
export function albumKey(title: string): string {
  const stripped = title.replace(
    /[([][^)\]]*(deluxe|edition|remaster|expanded|anniversary|bonus|version)[^)\]]*[)\]]/gi,
    '',
  );
  return nameKey(stripped) || nameKey(title);
}

export function artistDismissalKey(artistName: string): string {
  return `artist:${nameKey(artistName)}`;
}

export function albumDismissalKey(artistName: string, albumTitle: string): string {
  return `album:${nameKey(artistName)}::${albumKey(albumTitle)}`;
}

export function coverArtUrl(caaReleaseMbid?: string | null): string | undefined {
  return caaReleaseMbid ? `https://coverartarchive.org/release/${caaReleaseMbid}/front-500` : undefined;
}
