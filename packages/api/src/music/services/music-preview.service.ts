import { Injectable } from '@nestjs/common';
import { DeezerClient, DeezerTrack } from '../clients/deezer.client';

export interface AlbumPreview {
  deezerAlbumId: number;
  title: string;
  artistName: string;
  coverUrl?: string;
  tracks: DeezerTrack[];
}

/**
 * 30-second previews from Deezer. Preview URLs are signed and expire within
 * hours, so they're fetched when you press play and never stored.
 */
@Injectable()
export class MusicPreviewService {
  /** Album ids resolve slowly (a search) but never change, so they're cached. */
  private readonly albumIds = new Map<string, number | null>();

  constructor(private readonly deezer: DeezerClient) {}

  async albumPreview(artistName: string, albumTitle: string): Promise<AlbumPreview | null> {
    const key = `${artistName}\u0000${albumTitle}`;
    let albumId = this.albumIds.get(key);
    let coverUrl: string | undefined;
    let title = albumTitle;
    let artist = artistName;

    if (albumId === undefined) {
      const album = await this.deezer.findAlbum(artistName, albumTitle);
      albumId = album?.id ?? null;
      this.albumIds.set(key, albumId);
      coverUrl = album?.coverUrl;
      title = album?.title ?? title;
      artist = album?.artistName ?? artist;
    }
    if (albumId == null) return null;

    const tracks = (await this.deezer.albumTracks(albumId)).filter((t) => t.previewUrl);
    return { deezerAlbumId: albumId, title, artistName: artist, coverUrl, tracks };
  }
}
