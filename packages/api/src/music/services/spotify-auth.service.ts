import { BadRequestException, Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { RecommendationSource, RecommendationSourceProvider } from '../../../generated/prisma';
import { buildAuthorizeUrl, createPkcePair, isValidRedirectUri, isValidSpotifyClientId, SpotifyClient } from '../clients/spotify.client';
import { corsOrigins } from '../../common/utils/cors-origins';
import { RecommendationAppsService } from '../../recommendations/services/app-credentials.service';

export { isValidRedirectUri, isValidSpotifyClientId };

interface PendingAuth {
  profileId: string;
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
 * The callback sends the browser back to `returnTo`, so it must be one of the
 * UI's own origins — otherwise the callback would redirect anywhere. The UI is
 * served by the API, so the callback's own origin (`redirectUri`) is one.
 */
export function isAllowedReturnTo(value: string, allowed: string[] | true, redirectUri?: string): boolean {
  let url: URL;
  let own: string | undefined;
  try {
    url = new URL(value);
    own = redirectUri ? new URL(redirectUri).origin : undefined;
  } catch {
    return false;
  }
  if (!['http:', 'https:'].includes(url.protocol)) return false;
  return allowed === true || url.origin === own || allowed.includes(url.origin);
}

const RECONNECT = 'Reconnect it in Settings › Recommendations.';

/**
 * Connects a profile's Spotify account with the Authorization Code flow and
 * PKCE, so each install needs only its own app's Client ID — no secret to
 * store. Spotify redirects to the API's callback, which finishes the login and
 * sends the browser back to Settings. Pending logins live in memory: an API
 * restart mid-login just means starting again.
 */
@Injectable()
export class SpotifyAuthService {
  private readonly pending = new Map<string, PendingAuth>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly spotify: SpotifyClient,
    private readonly apps: RecommendationAppsService,
  ) {}

  async start(input: { profileId: string; returnTo: string }): Promise<{ authorizeUrl: string }> {
    const { spotifyClientId: clientId, spotifyRedirectUri: redirectUri } = await this.apps.get();
    if (!clientId || !isValidSpotifyClientId(clientId)) {
      throw new BadRequestException('Add your Spotify app’s Client ID under App credentials first');
    }
    if (!redirectUri || !isValidRedirectUri(redirectUri)) {
      throw new BadRequestException('Add your Spotify app’s https:// redirect URI under App credentials first');
    }
    const profile = await this.prisma.recommendationProfile.findUnique({ where: { id: input.profileId } });
    if (!profile) throw new BadRequestException('No such profile');
    if (!isAllowedReturnTo(input.returnTo, corsOrigins(), redirectUri)) {
      throw new BadRequestException(
        `${input.returnTo} isn’t an allowed Downloadarr address. Add its origin to FRONTEND_URL or CORS_ORIGINS.`,
      );
    }

    this.prune();
    const state = randomBytes(16).toString('hex');
    const { verifier, challenge } = createPkcePair();
    this.pending.set(state, {
      profileId: input.profileId,
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
  async handleCallback(
    query: { code?: string; state?: string; error?: string },
  ): Promise<{ url: string; connected: boolean; profileId?: string }> {
    this.prune();
    const pending = query.state ? this.pending.get(query.state) : undefined;
    if (!pending) {
      // Without the pending login there's no known page to return to.
      throw new BadRequestException('This Spotify login expired or was already used. Start again from Settings › Recommendations.');
    }
    this.pending.delete(query.state!);

    const back = (params: Record<string, string>) => {
      const url = new URL(pending.returnTo);
      for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
      return url.toString();
    };
    const failed = (message: string) => ({ url: back({ spotify: 'error', message }), connected: false, profileId: pending.profileId });

    if (query.error || !query.code) {
      return failed(query.error === 'access_denied' ? 'Spotify access was declined' : `Spotify: ${query.error ?? 'no code returned'}`);
    }
    try {
      await this.connect(pending, query.code);
      return { url: back({ spotify: 'connected' }), connected: true, profileId: pending.profileId };
    } catch (error) {
      return failed((error as Error).message);
    }
  }

  private async connect(pending: PendingAuth, code: string): Promise<RecommendationSource> {
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
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken ?? null,
      tokenExpiresAt: tokens.expiresAt,
      enabled: true,
      lastSyncError: null,
    };
    const provider = RecommendationSourceProvider.SPOTIFY;
    return this.prisma.recommendationSource.upsert({
      where: { profileId_provider: { profileId: pending.profileId, provider } },
      create: { profileId: pending.profileId, provider, ...data },
      update: data,
    });
  }

  /** A valid access token for the connected account, refreshed if needed. */
  async accessToken(source: RecommendationSource): Promise<string> {
    const fresh =
      source.accessToken && source.tokenExpiresAt && source.tokenExpiresAt.getTime() - REFRESH_MARGIN_MS > Date.now();
    if (fresh) return source.accessToken!;
    const { spotifyClientId } = await this.apps.get();
    if (!spotifyClientId || !source.refreshToken) {
      throw new Error(`Spotify sign-in expired. ${RECONNECT}`);
    }

    let tokens;
    try {
      tokens = await this.spotify.refresh(spotifyClientId, source.refreshToken);
    } catch (err) {
      throw new Error(`Spotify sign-in expired (${(err as Error).message}). ${RECONNECT}`);
    }
    await this.prisma.recommendationSource.update({
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
