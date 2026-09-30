import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { MusicSourceProvider } from '../../../generated/prisma';
import { DeezerClient, DeezerTrack } from '../clients/deezer.client';
import { ListenBrainzClient, LbRadioTrack } from '../clients/listenbrainz.client';
import { MusicSourcesService } from './music-sources.service';
import { albumDismissalKey, albumKey, artistDismissalKey, coverArtUrl, nameKey } from '../music-keys';

export interface RadioTrack {
  id: string;
  title: string;
  artistName: string;
  albumTitle?: string;
  coverUrl?: string;
  durationSeconds: number;
  /** 30-second MP3. Signed and short-lived: never cache it. */
  previewUrl: string;
  source: 'deezer' | 'listenbrainz';
}

export interface RadioAlbum {
  id: string;
  artistName: string;
  albumTitle: string;
  coverUrl?: string;
  sources: string[];
}

export interface ArtistRadio {
  artistName: string;
  sources: string[];
  /** Playable tracks, in play order. */
  tracks: RadioTrack[];
  /** The albums the station's tracks come from, first heard first. */
  albums: RadioAlbum[];
}

const DEEZER_TRACKS = 50;
// Each ListenBrainz track costs a Deezer search to find its preview.
const LISTENBRAINZ_TRACKS = 20;

export interface Candidate {
  title: string;
  artistName: string;
  albumTitle?: string;
  coverUrl?: string;
  durationSeconds: number;
  previewUrl?: string;
  source: RadioTrack['source'];
}

/**
 * On-demand artist radio: Deezer's artist mix, plus an LB Radio playlist when a
 * ListenBrainz token is connected. Built when you press play and never stored,
 * because Deezer's preview URLs expire within hours.
 */
@Injectable()
export class MusicRadioService {
  private readonly logger = new Logger(MusicRadioService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly deezer: DeezerClient,
    private readonly listenBrainz: ListenBrainzClient,
    private readonly sources: MusicSourcesService,
  ) {}

  async artistRadio(artistName: string): Promise<ArtistRadio | null> {
    const lb = (await this.sources.listEnabled()).find((s) => s.provider === MusicSourceProvider.LISTENBRAINZ);
    const [deezer, listenBrainz] = await Promise.all([
      this.fromDeezer(artistName),
      lb?.apiKey ? this.fromListenBrainz(artistName, lb.apiKey) : Promise.resolve([]),
    ]);

    const dismissed = new Set((await this.prisma.musicDismissal.findMany()).map((d) => d.key));
    const tracks = mergeStations(deezer, listenBrainz).filter(
      (t) =>
        !dismissed.has(artistDismissalKey(t.artistName)) &&
        !(t.albumTitle && dismissed.has(albumDismissalKey(t.artistName, t.albumTitle))),
    );
    if (tracks.length === 0) return null;

    return {
      artistName,
      sources: [...new Set(tracks.map((t) => t.source))],
      tracks: tracks
        .filter((t): t is Candidate & { previewUrl: string } => Boolean(t.previewUrl))
        .map((t) => ({ ...t, id: `${t.source}:${nameKey(t.artistName)}::${albumKey(t.title)}` })),
      albums: albumsOf(tracks),
    };
  }

  private async fromDeezer(artistName: string): Promise<Candidate[]> {
    const artist = await this.attempt(`Deezer artist ${artistName}`, () => this.deezer.findArtist(artistName));
    if (!artist) return [];
    const tracks = (await this.attempt(`Deezer radio for ${artistName}`, () => this.deezer.artistRadio(artist.id, DEEZER_TRACKS))) ?? [];
    return tracks.map((t) => fromDeezerTrack(t));
  }

  /** LB Radio tracks, matched on Deezer for their previews and artwork. */
  private async fromListenBrainz(artistName: string, token: string): Promise<Candidate[]> {
    const prompt = `artist:(${artistName.replace(/[()]/g, '')})`;
    const tracks = (await this.attempt(`LB radio for ${artistName}`, () => this.listenBrainz.radio(prompt, 'easy', token))) ?? [];
    const candidates: Candidate[] = [];
    for (const track of tracks.slice(0, LISTENBRAINZ_TRACKS)) {
      const match = await this.attempt(`Deezer track ${track.title}`, () => this.deezer.findTrack(track.artistName, track.title));
      candidates.push(fromListenBrainzTrack(track, match));
    }
    return candidates;
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

function fromDeezerTrack(t: DeezerTrack): Candidate {
  return {
    title: t.title,
    artistName: t.artistName,
    albumTitle: t.albumTitle,
    coverUrl: t.coverUrl,
    durationSeconds: t.durationSeconds,
    previewUrl: t.previewUrl,
    source: 'deezer',
  };
}

function fromListenBrainzTrack(track: LbRadioTrack, match: DeezerTrack | null): Candidate {
  return {
    title: track.title,
    artistName: track.artistName,
    // ListenBrainz may leave the album out; Deezer's match fills it in.
    albumTitle: track.albumTitle ?? match?.albumTitle,
    coverUrl: coverArtUrl(track.caaReleaseMbid) ?? match?.coverUrl,
    durationSeconds: match?.durationSeconds ?? 0,
    previewUrl: match?.previewUrl,
    source: 'listenbrainz',
  };
}

/** Alternates the two stations, dropping tracks the other already played. */
export function mergeStations(...stations: Candidate[][]): Candidate[] {
  const seen = new Set<string>();
  const merged: Candidate[] = [];
  const longest = Math.max(0, ...stations.map((s) => s.length));
  for (let i = 0; i < longest; i++) {
    for (const station of stations) {
      const track = station[i];
      if (!track) continue;
      const key = `${nameKey(track.artistName)}::${albumKey(track.title)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(track);
    }
  }
  return merged;
}

/**
 * The albums behind the tracks, first heard first. Singles (a release named
 * after its track) are left out: they aren't worth requesting as albums.
 */
export function albumsOf(tracks: Candidate[]): RadioAlbum[] {
  const albums = new Map<string, RadioAlbum>();
  for (const track of tracks) {
    if (!track.albumTitle || albumKey(track.albumTitle) === albumKey(track.title)) continue;
    const key = albumDismissalKey(track.artistName, track.albumTitle);
    const existing = albums.get(key);
    if (existing) {
      existing.sources = [...new Set([...existing.sources, track.source])];
      existing.coverUrl ??= track.coverUrl;
      continue;
    }
    albums.set(key, {
      id: `radio:${key}`,
      artistName: track.artistName,
      albumTitle: track.albumTitle,
      coverUrl: track.coverUrl,
      sources: [track.source],
    });
  }
  return [...albums.values()];
}
