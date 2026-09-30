import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { RecommendationSource, RecommendationSourceProvider } from '../../../generated/prisma';
import { ListenBrainzClient } from '../../music/clients/listenbrainz.client';
import { LastFmClient } from '../../music/clients/lastfm.client';
import { DeezerClient } from '../../music/clients/deezer.client';

/** What the UI sees: keys and tokens are write-only. */
export interface RecommendationSourceView {
  id: string;
  profileId: string;
  provider: RecommendationSourceProvider;
  username: string;
  displayName: string | null;
  enabled: boolean;
  hasApiKey: boolean;
  lastSyncedAt: Date | null;
  lastSyncError: string | null;
}

/** Providers whose listening history builds music recommendations. */
export const MUSIC_PROVIDERS: RecommendationSourceProvider[] = [
  RecommendationSourceProvider.LISTENBRAINZ,
  RecommendationSourceProvider.LASTFM,
  RecommendationSourceProvider.DEEZER,
  RecommendationSourceProvider.SPOTIFY,
];

/** Providers connected by signing in rather than by typing a username. */
const SIGN_IN_PROVIDERS: RecommendationSourceProvider[] = [
  RecommendationSourceProvider.SPOTIFY,
  RecommendationSourceProvider.TRAKT,
];

/**
 * The accounts each profile has connected: one per provider per profile.
 * ListenBrainz, Last.fm and Deezer are connected here by username; Spotify
 * and Trakt through their own sign-in services.
 */
@Injectable()
export class RecommendationSourcesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly listenBrainz: ListenBrainzClient,
    private readonly lastFm: LastFmClient,
    private readonly deezer: DeezerClient,
  ) {}

  toView(source: RecommendationSource): RecommendationSourceView {
    return {
      id: source.id,
      profileId: source.profileId,
      provider: source.provider,
      username: source.username,
      displayName: source.displayName,
      enabled: source.enabled,
      hasApiKey: Boolean(
        source.provider === RecommendationSourceProvider.LASTFM ? this.lastFmApiKey(source) : source.apiKey,
      ),
      lastSyncedAt: source.lastSyncedAt,
      lastSyncError: source.lastSyncError,
    };
  }

  async list(): Promise<RecommendationSource[]> {
    return this.prisma.recommendationSource.findMany({ orderBy: [{ profileId: 'asc' }, { provider: 'asc' }] });
  }

  /** Enabled sources, for one profile or every profile. */
  async listEnabled(profileId?: string): Promise<RecommendationSource[]> {
    return this.prisma.recommendationSource.findMany({ where: { enabled: true, ...(profileId ? { profileId } : {}) } });
  }

  /** The key saved on the source, else LASTFM_API_KEY. */
  lastFmApiKey(source: Pick<RecommendationSource, 'apiKey'>): string | null {
    return source.apiKey || process.env.LASTFM_API_KEY || null;
  }

  /** Connects or updates a source, checking the account exists first. */
  async upsert(
    profileId: string,
    provider: RecommendationSourceProvider,
    input: { username: string; apiKey?: string; enabled?: boolean },
  ): Promise<RecommendationSource> {
    if (SIGN_IN_PROVIDERS.includes(provider)) {
      throw new BadRequestException(`Connect ${provider === RecommendationSourceProvider.SPOTIFY ? 'Spotify' : 'Trakt'} by signing in, not with a username`);
    }
    await this.requireProfile(profileId);
    let username = input.username.trim();
    let displayName: string | null = null;
    if (!username) throw new BadRequestException('Username is required');

    const where = { profileId_provider: { profileId, provider } };
    const existing = await this.prisma.recommendationSource.findUnique({ where });
    // An omitted key keeps the saved one; an empty string clears it.
    const apiKey = input.apiKey === undefined ? existing?.apiKey ?? null : input.apiKey.trim() || null;

    if (provider === RecommendationSourceProvider.LISTENBRAINZ) {
      if (!(await this.listenBrainz.userExists(username))) {
        throw new BadRequestException(`No ListenBrainz user named "${username}"`);
      }
    } else if (provider === RecommendationSourceProvider.DEEZER) {
      const userId = await this.deezer.resolveProfileId(username);
      if (userId == null) {
        throw new BadRequestException('Paste your Deezer profile link or numeric user ID');
      }
      const user = await this.deezer.user(userId);
      if (!user) throw new BadRequestException(`No Deezer user with ID ${userId}`);
      try {
        await this.deezer.userChartArtists(userId);
      } catch {
        throw new BadRequestException(`${user.name}'s Deezer profile is private. Make it public in Deezer's settings.`);
      }
      username = String(user.id);
      displayName = user.name;
    } else {
      const key = this.lastFmApiKey({ apiKey });
      if (!key) throw new BadRequestException('A Last.fm API key is required');
      let exists: boolean;
      try {
        exists = await this.lastFm.userExists(key, username);
      } catch (error) {
        throw new BadRequestException(`Last.fm rejected the request: ${(error as Error).message}`);
      }
      if (!exists) throw new BadRequestException(`No Last.fm user named "${username}"`);
    }

    const data = { username, displayName, apiKey, enabled: input.enabled ?? true, lastSyncError: null };
    return this.prisma.recommendationSource.upsert({
      where,
      create: { profileId, provider, ...data },
      update: data,
    });
  }

  async remove(profileId: string, provider: RecommendationSourceProvider): Promise<void> {
    const where = { profileId_provider: { profileId, provider } };
    const existing = await this.prisma.recommendationSource.findUnique({ where });
    if (!existing) throw new NotFoundException(`${provider} is not connected to this profile`);
    await this.prisma.recommendationSource.delete({ where });
  }

  async recordSync(sourceId: string, error: string | null): Promise<void> {
    await this.prisma.recommendationSource.updateMany({
      where: { id: sourceId },
      data: error ? { lastSyncError: error } : { lastSyncedAt: new Date(), lastSyncError: null },
    });
  }

  async requireProfile(profileId: string): Promise<void> {
    const profile = await this.prisma.recommendationProfile.findUnique({ where: { id: profileId }, select: { id: true } });
    if (!profile) throw new NotFoundException('No such profile');
  }
}
