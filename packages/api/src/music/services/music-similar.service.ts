import { Injectable, Logger } from '@nestjs/common';
import { RecommendationProfile } from '../../../generated/prisma';
import { COMPILATION, DeezerAlbum, DeezerClient } from '../clients/deezer.client';
import { MusicListsService } from './music-lists.service';
import { albumDismissalKey, albumKey, artistDismissalKey, nameKey } from '../music-keys';

export interface SimilarAlbum {
  /** "deezer:123". */
  id: string;
  artistName: string;
  albumTitle: string;
  coverUrl?: string;
  releaseDate?: string;
}

const RELATED_ARTISTS = 15;
const CACHE_MS = 24 * 60 * 60 * 1000;
// A different genre counts as this many years apart.
const GENRE_PENALTY_YEARS = 8;

const year = (album: { releaseDate?: string }) => Number(album.releaseDate?.slice(0, 4)) || undefined;

/**
 * Picks the related artist's album most like the one you're looking at: a
 * proper album (not a single, EP, compilation or live record), in the same
 * genre, from around the same time. Null when they have no albums.
 */
export function closestAlbum(albums: DeezerAlbum[], target: { genreId?: number; releaseDate?: string }): DeezerAlbum | null {
  const candidates = albums.filter((a) => a.recordType === 'album' && !COMPILATION.test(a.title));
  const targetYear = year(target);
  const distance = (a: DeezerAlbum) => {
    const genre = target.genreId && a.genreId && a.genreId !== target.genreId ? GENRE_PENALTY_YEARS : 0;
    const albumYear = year(a);
    const era = targetYear && albumYear ? Math.abs(albumYear - targetYear) : GENRE_PENALTY_YEARS / 2;
    return genre + era;
  };
  // Deezer lists newest first; on a tie the stable sort keeps the newer one.
  return [...candidates].sort((a, b) => distance(a) - distance(b))[0] ?? null;
}

/**
 * "Albums like this" for an album page. Deezer has no album similarity, so
 * this goes through the artist: Deezer's related artists, in its order, each
 * with the album of theirs closest in genre and era to this one. Built from
 * Deezer's public catalog (no account needed) and cached for a day.
 */
@Injectable()
export class MusicSimilarService {
  private readonly logger = new Logger(MusicSimilarService.name);
  private readonly cache = new Map<string, { at: number; albums: SimilarAlbum[] }>();

  constructor(
    private readonly deezer: DeezerClient,
    private readonly lists: MusicListsService,
  ) {}

  async similar(artistName: string, albumTitle: string, profiles: RecommendationProfile[]): Promise<SimilarAlbum[]> {
    const albums = await this.cached(artistName, albumTitle);
    const dismissed = await this.lists.dismissedKeys(profiles);
    return albums.filter(
      (a) => !dismissed.has(artistDismissalKey(a.artistName)) && !dismissed.has(albumDismissalKey(a.artistName, a.albumTitle)),
    );
  }

  private async cached(artistName: string, albumTitle: string): Promise<SimilarAlbum[]> {
    const key = `${nameKey(artistName)}::${albumKey(albumTitle)}`;
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.albums;
    const albums = await this.build(artistName, albumTitle);
    this.cache.set(key, { at: Date.now(), albums });
    return albums;
  }

  private async build(artistName: string, albumTitle: string): Promise<SimilarAlbum[]> {
    const artist = await this.deezer.findArtist(artistName);
    if (!artist) return [];
    const [target, related] = await Promise.all([
      this.attempt(`Deezer album ${albumTitle}`, async () => {
        const found = await this.deezer.findAlbum(artistName, albumTitle);
        return found ? await this.deezer.album(found.id) : null;
      }),
      this.deezer.relatedArtists(artist.id, RELATED_ARTISTS),
    ]);

    const picks = await Promise.all(
      related.map((r) =>
        this.attempt(`Deezer albums for ${r.name}`, async () => closestAlbum(await this.deezer.artistAlbums(r.id), target ?? {})).then(
          (album) => (album ? { album, artistName: r.name } : null),
        ),
      ),
    );
    return picks
      .filter((p): p is { album: DeezerAlbum; artistName: string } => p !== null)
      .map(({ album, artistName: name }) => ({
        id: `deezer:${album.id}`,
        artistName: album.artistName ?? name,
        albumTitle: album.title,
        coverUrl: album.coverUrl,
        releaseDate: album.releaseDate,
      }));
  }

  private async attempt<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
    try {
      return await fn();
    } catch (error) {
      this.logger.debug(`${label} failed: ${(error as Error).message}`);
      return null;
    }
  }
}
