import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { MusicSource, MusicSourceProvider } from '../../../generated/prisma';
import { ListenBrainzClient } from '../clients/listenbrainz.client';
import { LastFmClient } from '../clients/lastfm.client';
import { DeezerClient } from '../clients/deezer.client';

/** What the UI sees: keys and tokens are write-only. */
export interface MusicSourceView {
  provider: MusicSourceProvider;
  username: string;
  displayName: string | null;
  enabled: boolean;
  hasApiKey: boolean;
  lastSyncedAt: Date | null;
  lastSyncError: string | null;
}

@Injectable()
export class MusicSourcesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly listenBrainz: ListenBrainzClient,
    private readonly lastFm: LastFmClient,
    private readonly deezer: DeezerClient,
  ) {}

  toView(source: MusicSource): MusicSourceView {
    return {
      provider: source.provider,
      username: source.username,
      displayName: source.displayName,
      enabled: source.enabled,
      hasApiKey: Boolean(
        source.provider === MusicSourceProvider.LASTFM ? this.lastFmApiKey(source) : source.apiKey,
      ),
      lastSyncedAt: source.lastSyncedAt,
      lastSyncError: source.lastSyncError,
    };
  }

  async list(): Promise<MusicSource[]> {
    return this.prisma.musicSource.findMany({ orderBy: { provider: 'asc' } });
  }

  async listEnabled(): Promise<MusicSource[]> {
    return this.prisma.musicSource.findMany({ where: { enabled: true } });
  }

  /** The key saved on the source, else LASTFM_API_KEY. */
  lastFmApiKey(source: Pick<MusicSource, 'apiKey'>): string | null {
    return source.apiKey || process.env.LASTFM_API_KEY || null;
  }

  /** Connects or updates a source, checking the account exists first. */
  async upsert(
    provider: MusicSourceProvider,
    input: { username: string; apiKey?: string; enabled?: boolean },
  ): Promise<MusicSource> {
    let username = input.username.trim();
    let displayName: string | null = null;
    if (!username) throw new BadRequestException('Username is required');

    const existing = await this.prisma.musicSource.findUnique({ where: { provider } });
    // An omitted key keeps the saved one; an empty string clears it.
    const apiKey = input.apiKey === undefined ? existing?.apiKey ?? null : input.apiKey.trim() || null;

    if (provider === MusicSourceProvider.LISTENBRAINZ) {
      if (!(await this.listenBrainz.userExists(username))) {
        throw new BadRequestException(`No ListenBrainz user named "${username}"`);
      }
    } else if (provider === MusicSourceProvider.DEEZER) {
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
    return this.prisma.musicSource.upsert({
      where: { provider },
      create: { provider, ...data },
      update: data,
    });
  }

  async remove(provider: MusicSourceProvider): Promise<void> {
    const existing = await this.prisma.musicSource.findUnique({ where: { provider } });
    if (!existing) throw new NotFoundException(`${provider} is not connected`);
    await this.prisma.musicSource.delete({ where: { provider } });
  }

  async recordSync(provider: MusicSourceProvider, error: string | null): Promise<void> {
    await this.prisma.musicSource.updateMany({
      where: { provider },
      data: error ? { lastSyncError: error } : { lastSyncedAt: new Date(), lastSyncError: null },
    });
  }
}
