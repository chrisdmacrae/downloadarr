import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ProviderError, ThrottledJsonClient } from '../../music/clients/json-client';

const API = 'https://api.trakt.tv';
// OAuth calls must not go to the API host.
const AUTH = 'https://auth.trakt.tv';
/** The redirect URI apps using device login register; refreshes must send it. */
export const TRAKT_OOB_REDIRECT = 'urn:ietf:wg:oauth:2.0:oob';

export interface TraktCredentials {
  clientId: string;
  clientSecret: string;
}

export interface TraktDeviceCode {
  deviceCode: string;
  userCode: string;
  verificationUrl: string;
  expiresIn: number;
  interval: number;
}

export interface TraktTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

/** Device-token polling outcomes, from Trakt's status codes. */
export type TraktDevicePoll =
  | { status: 'connected'; tokens: TraktTokens }
  | { status: 'pending' } // 400
  | { status: 'slow_down' } // 429
  | { status: 'invalid' } // 404
  | { status: 'used' } // 409
  | { status: 'expired' } // 410
  | { status: 'denied' }; // 418

export type TraktKind = 'movies' | 'shows';

export interface TraktIds {
  trakt?: number;
  slug?: string;
  imdb?: string | null;
  tmdb?: number | null;
  tvdb?: number | null;
}

export interface TraktTitle {
  title: string;
  year?: number | null;
  ids: TraktIds;
}

const POLL_STATUS: Record<number, TraktDevicePoll['status']> = {
  400: 'pending',
  404: 'invalid',
  409: 'used',
  410: 'expired',
  418: 'denied',
  429: 'slow_down',
};

function toTokens(data: any): TraktTokens {
  const createdAt = Number(data.created_at) || Math.floor(Date.now() / 1000);
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date((createdAt + Number(data.expires_in || 0)) * 1000),
  };
}

/** A movie or show from a list response, however Trakt wraps it. */
function unwrap(item: any, kind: TraktKind): TraktTitle | null {
  const title = item?.[kind === 'movies' ? 'movie' : 'show'] ?? item;
  return title?.ids && title?.title ? { title: title.title, year: title.year ?? null, ids: title.ids } : null;
}

/**
 * Trakt's API: device login and token refresh on auth.trakt.tv, and the
 * personal recommendations and watchlist on api.trakt.tv. Each install uses
 * its own Trakt app.
 */
@Injectable()
export class TraktClient {
  private readonly logger = new Logger(TraktClient.name);
  private readonly reads: ThrottledJsonClient;

  constructor(private readonly http: HttpService) {
    // 500 GETs per 5 minutes per user.
    this.reads = new ThrottledJsonClient(http, this.logger, 650);
  }

  async deviceCode(clientId: string): Promise<TraktDeviceCode> {
    const data = await this.post(`${AUTH}/oauth/device/code`, { client_id: clientId });
    return {
      deviceCode: data.device_code,
      userCode: data.user_code,
      verificationUrl: data.verification_url,
      expiresIn: Number(data.expires_in),
      interval: Number(data.interval) || 5,
    };
  }

  async deviceToken(creds: TraktCredentials, deviceCode: string): Promise<TraktDevicePoll> {
    const response = await firstValueFrom(
      this.http.post(
        `${AUTH}/oauth/device/token`,
        { code: deviceCode, client_id: creds.clientId, client_secret: creds.clientSecret },
        { headers: this.headers(creds.clientId), validateStatus: () => true, timeout: 15000 },
      ),
    );
    if (response.status === 200) return { status: 'connected', tokens: toTokens(response.data) };
    const status = POLL_STATUS[response.status];
    if (status) return { status } as TraktDevicePoll;
    throw new ProviderError(`Trakt device login failed (${response.status})`, response.status);
  }

  /** Refresh tokens are single-use: store the returned pair before anything else. */
  async refresh(creds: TraktCredentials, refreshToken: string): Promise<TraktTokens> {
    const data = await this.post(`${AUTH}/oauth/token`, {
      refresh_token: refreshToken,
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      redirect_uri: TRAKT_OOB_REDIRECT,
      grant_type: 'refresh_token',
    });
    return toTokens(data);
  }

  async revoke(creds: TraktCredentials, accessToken: string): Promise<void> {
    await this.post(`${AUTH}/oauth/revoke`, {
      token: accessToken,
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
    });
  }

  async me(clientId: string, accessToken: string): Promise<{ username: string; name: string | null }> {
    const data = await this.get<any>(clientId, accessToken, '/users/me');
    if (!data) throw new ProviderError('Trakt returned no profile');
    return { username: data.ids?.slug ?? data.username, name: data.name || null };
  }

  /** Trakt's personal recommendations, skipping what you've seen, collected or watchlisted. */
  async recommendations(clientId: string, accessToken: string, kind: TraktKind, limit: number): Promise<TraktTitle[]> {
    const data = await this.get<any[]>(clientId, accessToken, `/recommendations/${kind}`, {
      limit: Math.min(limit, 100),
      ignore_collected: true,
      ignore_watchlisted: true,
      ignore_watched: true,
    });
    return (Array.isArray(data) ? data : []).map((item) => unwrap(item, kind)).filter(Boolean) as TraktTitle[];
  }

  /** The watchlist in the user's own order, up to `max` items. */
  async watchlist(clientId: string, accessToken: string, kind: TraktKind, max: number): Promise<TraktTitle[]> {
    const items: TraktTitle[] = [];
    for (let page = 1; items.length < max; page++) {
      const data = await this.get<any[]>(clientId, accessToken, `/users/me/watchlist/${kind}/rank`, { page, limit: 100 });
      const rows = Array.isArray(data) ? data : [];
      items.push(...(rows.map((item) => unwrap(item, kind)).filter(Boolean) as TraktTitle[]));
      if (rows.length < 100) break;
    }
    return items.slice(0, max);
  }

  private headers(clientId: string, accessToken?: string): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'trakt-api-version': '2',
      'trakt-api-key': clientId,
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    };
  }

  private get<T>(clientId: string, accessToken: string, path: string, params?: Record<string, string | number | boolean>) {
    return this.reads.get<T>(`${API}${path}`, params, this.headers(clientId, accessToken));
  }

  private async post(url: string, body: Record<string, string>): Promise<any> {
    try {
      const response = await firstValueFrom(this.http.post(url, body, { headers: this.headers(body.client_id), timeout: 15000 }));
      return response.data;
    } catch (error: any) {
      const status = error?.response?.status;
      const detail = error?.response?.data?.error_description ?? error?.response?.data?.error ?? error?.message;
      throw new ProviderError(`Trakt: ${detail}`, status);
    }
  }
}
