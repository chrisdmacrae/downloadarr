import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RecommendationProfile } from '../../../generated/prisma';
import { MusicListsService } from '../../music/services/music-lists.service';
import { RecommendationProfilesService } from './profiles.service';
import { MUSIC_PROVIDERS, RecommendationSourcesService } from './sources.service';

export interface RecommendationSyncStatus {
  running: boolean;
  /** The profile being built right now. */
  currentProfile: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  /** One line per profile that failed, e.g. "Sam: None of the music accounts could be read". */
  error: string | null;
}

/**
 * Rebuilds every profile's recommendations. Runs nightly — ListenBrainz and
 * Trakt regenerate their data daily at most, so more often buys nothing — and
 * on demand from the Refresh buttons. Profiles build one after another so the
 * providers' rate limits are shared fairly.
 */
@Injectable()
export class RecommendationSyncService {
  private readonly logger = new Logger(RecommendationSyncService.name);
  private status: RecommendationSyncStatus = {
    running: false,
    currentProfile: null,
    startedAt: null,
    finishedAt: null,
    error: null,
  };

  constructor(
    private readonly profiles: RecommendationProfilesService,
    private readonly sources: RecommendationSourcesService,
    private readonly music: MusicListsService,
  ) {}

  getStatus(): RecommendationSyncStatus {
    return this.status;
  }

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async scheduledSync(): Promise<void> {
    await this.sync();
  }

  /** Starts a sync unless one is running. Resolves when it finishes. */
  async sync(profileId?: string): Promise<RecommendationSyncStatus> {
    if (this.status.running) return this.status;
    const sources = await this.sources.listEnabled(profileId);
    if (sources.length === 0) return this.status;

    this.status = { running: true, currentProfile: null, startedAt: new Date(), finishedAt: null, error: null };
    const errors: string[] = [];
    try {
      for (const profile of await this.profiles.scope(profileId)) {
        const own = sources.filter((s) => s.profileId === profile.id);
        if (own.length === 0) continue;
        this.status = { ...this.status, currentProfile: profile.name };
        errors.push(...(await this.syncProfile(profile, own)));
      }
    } catch (error) {
      errors.push((error as Error).message);
    }
    const error = errors.length ? errors.join('\n') : null;
    if (error) this.logger.error(`Recommendation sync finished with errors: ${error}`);
    this.status = { ...this.status, running: false, currentProfile: null, finishedAt: new Date(), error };
    return this.status;
  }

  /** Builds one profile; returns an error line per part that failed. */
  private async syncProfile(profile: RecommendationProfile, sources: Awaited<ReturnType<RecommendationSourcesService['listEnabled']>>): Promise<string[]> {
    const errors: string[] = [];
    const musicSources = sources.filter((s) => MUSIC_PROVIDERS.includes(s.provider));
    if (musicSources.length) {
      try {
        await this.music.buildForProfile(profile, musicSources);
      } catch (error) {
        errors.push(`${profile.name}: ${(error as Error).message}`);
      }
    }
    return errors;
  }
}
