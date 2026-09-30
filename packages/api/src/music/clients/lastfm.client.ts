import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ProviderError, ThrottledJsonClient } from './json-client';

const API = 'https://ws.audioscrobbler.com/2.0/';

export type LastFmPeriod = 'overall' | '7day' | '1month' | '3month' | '6month' | '12month';

export interface LfArtist {
  name: string;
  mbid?: string;
  playcount: number;
}

export interface LfSimilarArtist {
  name: string;
  mbid?: string;
  match: number;
}

export interface LfAlbum {
  artistName: string;
  artistMbid?: string;
  title: string;
  mbid?: string;
  imageUrl?: string;
  playcount: number;
}

/** Last.fm's grey star placeholder, returned when it has no artwork. */
const PLACEHOLDER_IMAGE = '2a96cbd8b46e442fc41c2b86b821562f';

function largestImage(images: any): string | undefined {
  const url = Array.isArray(images)
    ? [...images].reverse().find((image) => image?.['#text'])?.['#text']
    : undefined;
  return url && !url.includes(PLACEHOLDER_IMAGE) ? url : undefined;
}

/** Last.fm returns "" for a missing MBID. */
const mbidOf = (value: unknown) => (typeof value === 'string' && value ? value : undefined);

/** Reads public Last.fm data with a username and an API key; no user login. */
@Injectable()
export class LastFmClient {
  private readonly logger = new Logger(LastFmClient.name);
  private readonly client: ThrottledJsonClient;

  constructor(http: HttpService) {
    // Last.fm asks for no more than 5 requests a second, averaged.
    this.client = new ThrottledJsonClient(http, this.logger, 250);
  }

  private async call(apiKey: string, method: string, params: Record<string, string | number>) {
    const data = await this.client.get<any>(API, { method, api_key: apiKey, format: 'json', ...params });
    if (data?.error) throw new ProviderError(`Last.fm: ${data.message ?? `error ${data.error}`}`);
    return data;
  }

  async userExists(apiKey: string, username: string): Promise<boolean> {
    try {
      const data = await this.call(apiKey, 'user.getinfo', { user: username });
      return Boolean(data?.user?.name);
    } catch (error) {
      // Error 6 is "User not found", sent with a 404; anything else is real.
      if (error instanceof ProviderError && (error.status === 404 || /not found/i.test(error.message))) {
        return false;
      }
      throw error;
    }
  }

  async topArtists(apiKey: string, username: string, period: LastFmPeriod, limit: number): Promise<LfArtist[]> {
    const data = await this.call(apiKey, 'user.gettopartists', { user: username, period, limit });
    return (data?.topartists?.artist ?? []).map((a: any) => ({
      name: a.name,
      mbid: mbidOf(a.mbid),
      playcount: Number(a.playcount) || 0,
    }));
  }

  async topAlbums(apiKey: string, username: string, period: LastFmPeriod, limit: number): Promise<LfAlbum[]> {
    const data = await this.call(apiKey, 'user.gettopalbums', { user: username, period, limit });
    return (data?.topalbums?.album ?? []).map((a: any) => ({
      artistName: a.artist?.name,
      artistMbid: mbidOf(a.artist?.mbid),
      title: a.name,
      mbid: mbidOf(a.mbid),
      imageUrl: largestImage(a.image),
      playcount: Number(a.playcount) || 0,
    }));
  }

  async similarArtists(apiKey: string, artist: { name: string; mbid?: string }, limit: number): Promise<LfSimilarArtist[]> {
    const data = await this.call(apiKey, 'artist.getsimilar', {
      ...(artist.mbid ? { mbid: artist.mbid } : { artist: artist.name }),
      autocorrect: 1,
      limit,
    }).catch((error) => {
      // An MBID Last.fm doesn't know fails the call; the name usually works.
      if (artist.mbid) return this.call(apiKey, 'artist.getsimilar', { artist: artist.name, autocorrect: 1, limit });
      throw error;
    });
    return (data?.similarartists?.artist ?? []).map((a: any) => ({
      name: a.name,
      mbid: mbidOf(a.mbid),
      match: Number(a.match) || 0,
    }));
  }

  async topAlbumForArtist(apiKey: string, artistName: string): Promise<LfAlbum | null> {
    const data = await this.call(apiKey, 'artist.gettopalbums', { artist: artistName, autocorrect: 1, limit: 5 });
    const album = (data?.topalbums?.album ?? []).find((a: any) => a.name && a.name !== '(null)');
    if (!album) return null;
    return {
      artistName: album.artist?.name ?? artistName,
      artistMbid: mbidOf(album.artist?.mbid),
      title: album.name,
      mbid: mbidOf(album.mbid),
      imageUrl: largestImage(album.image),
      playcount: Number(album.playcount) || 0,
    };
  }
}
