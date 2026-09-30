import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { RecommendationSourceProvider } from '../../../generated/prisma';
import { DeezerAlbum, DeezerClient } from '../clients/deezer.client';
import { SpotifyAlbum, SpotifyClient } from '../clients/spotify.client';
import { SpotifyAuthService } from './spotify-auth.service';
import { albumKey, nameKey } from '../music-keys';

export interface MusicSearchAlbum {
  /** The provider's album id, prefixed with the provider: "deezer:123". */
  id: string;
  artistName: string;
  albumTitle: string;
  coverUrl?: string;
  /** album, ep, single or compile. */
  recordType?: string;
  releaseDate?: string;
  /** Deezer albums have previews; Spotify-only ones usually don't. */
  source: 'deezer' | 'spotify';
}

/** Albums first: they're what the request flow searches indexers for. */
const RECORD_TYPE_ORDER: Record<string, number> = { album: 0, ep: 1, compile: 2, single: 3 };

export function fromDeezer(album: DeezerAlbum): MusicSearchAlbum | null {
  if (!album.title || !album.artistName) return null;
  return {
    id: `deezer:${album.id}`,
    artistName: album.artistName,
    albumTitle: album.title,
    coverUrl: album.coverUrl,
    recordType: album.recordType,
    releaseDate: album.releaseDate,
    source: 'deezer',
  };
}

export function fromSpotify(album: SpotifyAlbum): MusicSearchAlbum | null {
  if (!album.title || !album.artistName) return null;
  return {
    id: `spotify:${album.id}`,
    artistName: album.artistName,
    albumTitle: album.title,
    coverUrl: album.coverUrl,
    // Spotify files EPs as singles.
    recordType: album.albumType === 'compilation' ? 'compile' : album.albumType,
    releaseDate: album.releaseDate,
    source: 'spotify',
  };
}

/**
 * Collapses editions of the same record (explicit and clean copies,
 * "(Deluxe Edition)", the same album from both providers) to the first one,
 * filling in a release date from a later copy when the first has none. Then
 * moves singles behind albums, keeping the given order within each type.
 */
export function rankSearchAlbums(albums: Array<MusicSearchAlbum | null>): MusicSearchAlbum[] {
  const byKey = new Map<string, MusicSearchAlbum>();
  for (const album of albums) {
    if (!album) continue;
    const key = `${nameKey(album.artistName)}::${albumKey(album.albumTitle)}`;
    const kept = byKey.get(key);
    if (!kept) byKey.set(key, { ...album });
    else if (!kept.releaseDate && album.releaseDate) kept.releaseDate = album.releaseDate;
  }

  const order = (album: MusicSearchAlbum) => RECORD_TYPE_ORDER[album.recordType ?? 'album'] ?? 1;
  return [...byKey.values()]
    .map((album, index) => ({ album, index }))
    .sort((a, b) => order(a.album) - order(b.album) || a.index - b.index)
    .map(({ album }) => album);
}

/**
 * Album search for the Search page. Deezer's public catalog comes first: it
 * needs no account and supplies the previews. When a profile has Spotify
 * connected, its search runs alongside and adds albums Deezer doesn't carry,
 * plus the release years Deezer's search leaves out.
 */
@Injectable()
export class MusicSearchService {
  private readonly logger = new Logger(MusicSearchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly deezer: DeezerClient,
    private readonly spotify: SpotifyClient,
    private readonly spotifyAuth: SpotifyAuthService,
  ) {}

  async search(query: string): Promise<MusicSearchAlbum[]> {
    const [deezer, spotify] = await Promise.allSettled([
      this.deezer.searchAlbums(query, 50),
      this.searchSpotify(query),
    ]);
    // Spotify is optional and never rejects, so only Deezer failing with
    // nothing from Spotify is an error.
    const spotifyAlbums = spotify.status === 'fulfilled' ? spotify.value : [];
    if (deezer.status === 'rejected' && spotifyAlbums.length === 0) throw deezer.reason;

    const deezerAlbums = deezer.status === 'fulfilled' ? deezer.value : [];
    return rankSearchAlbums([...deezerAlbums.map(fromDeezer), ...spotifyAlbums.map(fromSpotify)]);
  }

  async charts(): Promise<MusicSearchAlbum[]> {
    return rankSearchAlbums((await this.deezer.chartAlbums(50)).map(fromDeezer));
  }

  /**
   * Searches with any profile's Spotify sign-in: the install has no app-only
   * token, since connecting uses PKCE without a client secret.
   */
  private async searchSpotify(query: string): Promise<SpotifyAlbum[]> {
    const source = await this.prisma.recommendationSource.findFirst({
      where: { provider: RecommendationSourceProvider.SPOTIFY, enabled: true, refreshToken: { not: null } },
      orderBy: { lastSyncedAt: { sort: 'desc', nulls: 'last' } },
    });
    if (!source) return [];
    try {
      return await this.spotify.searchAlbums(await this.spotifyAuth.accessToken(source), query);
    } catch (error) {
      this.logger.warn(`Spotify search failed: ${(error as Error).message}`);
      return [];
    }
  }
}
