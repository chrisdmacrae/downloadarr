import { BadRequestException, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { RecommendationSource, RecommendationSourceProvider } from '../../../generated/prisma';
import { TraktClient, TraktCredentials, TraktTokens } from '../clients/trakt.client';
import { RecommendationAppsService } from './app-credentials.service';

export type TraktLoginStatus = 'pending' | 'connected' | 'expired' | 'denied' | 'error';

export interface TraktLoginView {
  status: TraktLoginStatus;
  userCode: string;
  verificationUrl: string;
  expiresAt: Date;
  error?: string;
}

interface PendingLogin extends TraktLoginView {
  deviceCode: string;
  intervalMs: number;
  timer?: NodeJS.Timeout;
  onConnected?: () => void;
}

/** Refresh this long before the access token expires. */
const REFRESH_MARGIN_MS = 60 * 60 * 1000;
/** Trakt asks for 5 more seconds between polls after a 429. */
const SLOW_DOWN_MS = 5000;
/** How long a finished login's outcome stays readable for the UI. */
const OUTCOME_TTL_MS = 5 * 60 * 1000;
const RECONNECT = 'Reconnect Trakt in Settings › Recommendations.';

/**
 * Connects a profile's Trakt account with device login: Trakt shows a code,
 * the person enters it at trakt.tv/activate, and the API polls until they
 * approve. No redirect is involved, so it works on any address. Pending
 * logins live in memory: an API restart mid-login just means starting again.
 */
@Injectable()
export class TraktAuthService implements OnModuleDestroy {
  private readonly logger = new Logger(TraktAuthService.name);
  private readonly logins = new Map<string, PendingLogin>();
  /** In-flight refreshes by source ID: a refresh token only works once. */
  private readonly refreshing = new Map<string, Promise<string>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly trakt: TraktClient,
    private readonly apps: RecommendationAppsService,
  ) {}

  onModuleDestroy() {
    for (const login of this.logins.values()) clearTimeout(login.timer);
  }

  async credentials(): Promise<TraktCredentials> {
    const { traktClientId, traktClientSecret } = await this.apps.get();
    if (!traktClientId || !traktClientSecret) {
      throw new BadRequestException('Add your Trakt app’s client ID and secret under App credentials first');
    }
    return { clientId: traktClientId, clientSecret: traktClientSecret };
  }

  /** Starts a device login for a profile, replacing any unfinished one. */
  async start(profileId: string, onConnected?: () => void): Promise<TraktLoginView> {
    const creds = await this.credentials();
    const profile = await this.prisma.recommendationProfile.findUnique({ where: { id: profileId } });
    if (!profile) throw new BadRequestException('No such profile');

    this.cancel(profileId);
    const code = await this.trakt.deviceCode(creds.clientId);
    const login: PendingLogin = {
      status: 'pending',
      userCode: code.userCode,
      verificationUrl: code.verificationUrl,
      expiresAt: new Date(Date.now() + code.expiresIn * 1000),
      deviceCode: code.deviceCode,
      intervalMs: code.interval * 1000,
      onConnected,
    };
    this.logins.set(profileId, login);
    this.schedule(profileId, login);
    return this.view(login);
  }

  status(profileId: string): TraktLoginView | null {
    const login = this.logins.get(profileId);
    return login ? this.view(login) : null;
  }

  cancel(profileId: string) {
    const login = this.logins.get(profileId);
    if (login) clearTimeout(login.timer);
    this.logins.delete(profileId);
  }

  /**
   * One poll of Trakt's device-token endpoint. Returns true while the login
   * is still pending. Public so tests can drive it without timers.
   */
  async poll(profileId: string): Promise<boolean> {
    const login = this.logins.get(profileId);
    if (!login || login.status !== 'pending') return false;
    if (Date.now() > login.expiresAt.getTime()) return this.finish(profileId, login, 'expired');

    try {
      const result = await this.trakt.deviceToken(await this.credentials(), login.deviceCode);
      switch (result.status) {
        case 'pending':
          return true;
        case 'slow_down':
          login.intervalMs += SLOW_DOWN_MS;
          return true;
        case 'connected':
          await this.connect(profileId, result.tokens);
          this.finish(profileId, login, 'connected');
          login.onConnected?.();
          return false;
        case 'denied':
          return this.finish(profileId, login, 'denied');
        case 'expired':
          return this.finish(profileId, login, 'expired');
        default:
          return this.finish(profileId, login, 'error', `Trakt rejected the code (${result.status}). Start again.`);
      }
    } catch (error) {
      return this.finish(profileId, login, 'error', (error as Error).message);
    }
  }

  /** A valid access token for the source, refreshed if it's about to expire. */
  async accessToken(source: RecommendationSource): Promise<string> {
    const fresh =
      source.accessToken && source.tokenExpiresAt && source.tokenExpiresAt.getTime() - REFRESH_MARGIN_MS > Date.now();
    if (fresh) return source.accessToken!;
    if (!source.refreshToken) throw new Error(`Trakt sign-in expired. ${RECONNECT}`);

    const inFlight = this.refreshing.get(source.id);
    if (inFlight) return inFlight;
    const refresh = this.refresh(source).finally(() => this.refreshing.delete(source.id));
    this.refreshing.set(source.id, refresh);
    return refresh;
  }

  /** Revokes the token (best effort) and removes the account. */
  async disconnect(profileId: string): Promise<void> {
    const where = { profileId_provider: { profileId, provider: RecommendationSourceProvider.TRAKT } };
    const source = await this.prisma.recommendationSource.findUnique({ where });
    if (!source) return;
    if (source.accessToken) {
      try {
        await this.trakt.revoke(await this.credentials(), source.accessToken);
      } catch (error) {
        this.logger.debug(`Revoking Trakt token failed: ${(error as Error).message}`);
      }
    }
    await this.prisma.recommendationSource.delete({ where });
  }

  private async refresh(source: RecommendationSource): Promise<string> {
    let tokens: TraktTokens;
    try {
      tokens = await this.trakt.refresh(await this.credentials(), source.refreshToken!);
    } catch (error) {
      throw new Error(`Trakt sign-in expired (${(error as Error).message}). ${RECONNECT}`);
    }
    // The old refresh token is already dead: save the new pair in one write.
    await this.prisma.recommendationSource.update({
      where: { id: source.id },
      data: { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, tokenExpiresAt: tokens.expiresAt },
    });
    return tokens.accessToken;
  }

  private async connect(profileId: string, tokens: TraktTokens): Promise<void> {
    const { clientId } = await this.credentials();
    const me = await this.trakt.me(clientId, tokens.accessToken);
    const provider = RecommendationSourceProvider.TRAKT;
    const data = {
      username: me.username,
      displayName: me.name ?? me.username,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenExpiresAt: tokens.expiresAt,
      enabled: true,
      lastSyncError: null,
    };
    await this.prisma.recommendationSource.upsert({
      where: { profileId_provider: { profileId, provider } },
      create: { profileId, provider, ...data },
      update: data,
    });
  }

  private schedule(profileId: string, login: PendingLogin) {
    login.timer = setTimeout(async () => {
      if (await this.poll(profileId)) this.schedule(profileId, login);
    }, login.intervalMs);
    login.timer.unref?.();
  }

  private finish(profileId: string, login: PendingLogin, status: TraktLoginStatus, error?: string): false {
    clearTimeout(login.timer);
    login.status = status;
    login.error = error;
    if (error) this.logger.warn(`Trakt login failed: ${error}`);
    // Keep the outcome around long enough for the UI's next poll.
    const cleanup = setTimeout(() => {
      if (this.logins.get(profileId) === login) this.logins.delete(profileId);
    }, OUTCOME_TTL_MS);
    cleanup.unref?.();
    return false;
  }

  private view({ status, userCode, verificationUrl, expiresAt, error }: PendingLogin): TraktLoginView {
    return { status, userCode, verificationUrl, expiresAt, ...(error ? { error } : {}) };
  }
}
