import { BadRequestException, Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { MusicSource, MusicSourceProvider } from '../../../generated/prisma';
import { buildAuthorizeUrl, createPkcePair, SpotifyClient } from '../clients/spotify.client';
import { corsOrigins } from '../../common/utils/cors-origins';

interface PendingAuth {
  clientId: string;
  redirectUri: string;
  verifier: string;
  returnTo: string;
  expiresAt: number;
}

/** How long you have to approve on Spotify. */
const PENDING_TTL_MS = 15 * 60 * 1000;
/** Refresh this long before the access token expires. */
const REFRESH_MARGIN_MS = 60 * 1000;

/**
 * Spotify only accepts HTTPS redirects, or HTTP on a loopback address for
 * local development.
 */
export function isValidRedirectUri(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || (url.protocol === 'http:' && ['127.0.0.1', '[::1]'].includes(url.hostname));
  } catch {
    return false;
  }
}

/**
 * The callback sends the browser back to `returnTo`, so it must be one of the
 * UI's own origins — otherwise the callback would redirect anywhere.
 */
export function isAllowedReturnTo(value: string, allowed: string[] | true): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (!['http:', 'https:'].includes(url.protocol)) return false;
  return allowed === true || allowed.includes(url.origin);
}

/**
 * Connects Spotify with the Authorization Code flow and PKCE, so each install
 * needs only its own app's Client ID — no secret to store. Spotify redirects
 * to the API's callback, which finishes the login and sends the browser back
 * to Settings. Pending logins live in memory: an API restart mid-login just
 * means starting again.
 */
@Injectable()
export class SpotifyAuthService {
  private readonly pending = new Map<string, PendingAuth>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly spotify: SpotifyClient,
  ) {}

  start(input: { clientId: string; redirectUri: string; returnTo: string }): { authorizeUrl: string } {
    const clientId = input.clientId.trim();
    const redirectUri = input.redirectUri.trim();
    if (!/^[0-9a-f]{32}$/i.test(clientId)) {
      throw new BadRequestException('That doesn’t look like a Spotify Client ID (32 letters and digits)');
    }
    if (!isValidRedirectUri(redirectUri)) {
      throw new BadRequestException('Spotify requires an https:// redirect URI');
    }
    if (!isAllowedReturnTo(input.returnTo, corsOrigins())) {
      throw new BadRequestException(
        `${input.returnTo} isn’t an allowed Downloadarr address. Add its origin to FRONTEND_URL or CORS_ORIGINS.`,
      );
    }

    this.prune();
    const state = randomBytes(16).toString('hex');
    const { verifier, challenge } = createPkcePair();
    this.pending.set(state, {
      clientId,
      redirectUri,
      verifier,
      returnTo: input.returnTo,
      expiresAt: Date.now() + PENDING_TTL_MS,
    });
    return { authorizeUrl: buildAuthorizeUrl({ clientId, redirectUri, state, challenge }) };
  }

  /**
   * Handles Spotify's redirect. Resolves to where the browser should go next:
   * back to Settings, with the outcome in the query string.
   */
  async handleCallback(query: { code?: string; state?: string; error?: string }): Promise<{ url: string; connected: boolean }> {
    this.prune();
    const pending = query.state ? this.pending.get(query.state) : undefined;
    if (!pending) {
      // Without the pending login there's no known page to return to.
      throw new BadRequestException('This Spotify login expired or was already used. Start again from Settings › Music.');
    }
    this.pending.delete(query.state!);

    const back = (params: Record<string, string>) => {
      const url = new URL(pending.returnTo);
      for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
      return url.toString();
    };
    const failed = (message: string) => ({ url: back({ spotify: 'error', message }), connected: false });

    if (query.error || !query.code) {
      return failed(query.error === 'access_denied' ? 'Spotify access was declined' : `Spotify: ${query.error ?? 'no code returned'}`);
    }
    try {
      await this.connect(pending, query.code);
      return { url: back({ spotify: 'connected' }), connected: true };
    } catch (error) {
      return failed((error as Error).message);
    }
  }

  private async connect(pending: PendingAuth, code: string): Promise<MusicSource> {
    const tokens = await this.spotify.exchangeCode({
      clientId: pending.clientId,
      code,
      redirectUri: pending.redirectUri,
      verifier: pending.verifier,
    });
    const me = await this.spotify.me(tokens.accessToken).catch((err) => {
      throw new Error(
        `Spotify login worked, but reading your profile failed (${(err as Error).message}). ` +
          'In development mode, add your account under User Management in your Spotify app.',
      );
    });

    const data = {
      username: me.id,
      displayName: me.displayName ?? me.id,
      clientId: pending.clientId,
      redirectUri: pending.redirectUri,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken ?? null,
      tokenExpiresAt: tokens.expiresAt,
      enabled: true,
      lastSyncError: null,
    };
    return this.prisma.musicSource.upsert({
      where: { provider: MusicSourceProvider.SPOTIFY },
      create: { provider: MusicSourceProvider.SPOTIFY, ...data },
      update: data,
    });
  }

  /** A valid access token for the connected account, refreshed if needed. */
  async accessToken(source: MusicSource): Promise<string> {
    const fresh =
      source.accessToken && source.tokenExpiresAt && source.tokenExpiresAt.getTime() - REFRESH_MARGIN_MS > Date.now();
    if (fresh) return source.accessToken!;
    if (!source.clientId || !source.refreshToken) {
      throw new Error('Spotify sign-in expired. Reconnect it in Settings › Music.');
    }

    let tokens;
    try {
      tokens = await this.spotify.refresh(source.clientId, source.refreshToken);
    } catch (err) {
      throw new Error(`Spotify sign-in expired (${(err as Error).message}). Reconnect it in Settings › Music.`);
    }
    await this.prisma.musicSource.update({
      where: { id: source.id },
      data: {
        accessToken: tokens.accessToken,
        // Spotify may rotate the refresh token.
        refreshToken: tokens.refreshToken ?? source.refreshToken,
        tokenExpiresAt: tokens.expiresAt,
      },
    });
    return tokens.accessToken;
  }

  private prune() {
    const now = Date.now();
    for (const [state, pending] of this.pending) if (pending.expiresAt < now) this.pending.delete(state);
  }
}
