import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service';
import { ContentType, RequestStatus } from '../../../generated/prisma';
import { TvShowGapAnalysisService } from './tv-show-gap-analysis.service';
import { RequestLifecycleOrchestrator } from './request-lifecycle-orchestrator.service';

export interface SearchLoopStats {
  totalTvShows: number;
  needingContent: number;
  completed: number;
  errors: number;
  lastRun: Date;
}

@Injectable()
export class TvShowSearchLoopService {
  private readonly logger = new Logger(TvShowSearchLoopService.name);
  private isRunning = false;
  private stats: SearchLoopStats = {
    totalTvShows: 0,
    needingContent: 0,
    completed: 0,
    errors: 0,
    lastRun: new Date(),
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly gapAnalysis: TvShowGapAnalysisService,
    private readonly orchestrator: RequestLifecycleOrchestrator,
  ) {}

  /**
   * Run every 5 minutes to check for TV shows that need more content
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async runSearchLoop(): Promise<void> {
    if (this.isRunning) {
      this.logger.debug('Search loop already running, skipping...');
      return;
    }

    this.isRunning = true;
    this.stats.lastRun = new Date();

    try {
      this.logger.log('Starting TV show search loop');
      await this.processAllTvShows();
      this.logger.log(`Search loop completed. Stats: ${JSON.stringify(this.stats)}`);
    } catch (error) {
      this.logger.error('Error in TV show search loop:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Process all TV show requests to check if they need more content
   */
  private async processAllTvShows(): Promise<void> {
    // Reset stats
    this.stats = {
      ...this.stats,
      totalTvShows: 0,
      needingContent: 0,
      completed: 0,
      errors: 0,
    };

    // Get all TV show requests
    const tvShowRequests = await this.prisma.requestedTorrent.findMany({
      where: {
        contentType: ContentType.TV_SHOW,
        // Only process requests that are not currently downloading or failed
        status: {
          notIn: [RequestStatus.DOWNLOADING, RequestStatus.FAILED, RequestStatus.CANCELLED],
        },
      },
      include: {
        tvShowSeasons: {
          include: {
            episodes: true,
          },
        },
      },
    });

    this.stats.totalTvShows = tvShowRequests.length;
    this.logger.log(`Found ${tvShowRequests.length} TV show requests to process`);

    for (const request of tvShowRequests) {
      try {
        await this.processTvShowRequest(request);
      } catch (error) {
        this.logger.error(`Error processing TV show ${request.title}:`, error);
        this.stats.errors++;
      }
    }
  }

  /**
   * Process a single TV show request
   */
  private async processTvShowRequest(request: any): Promise<void> {
    try {
      // Check if this show needs more content
      const needsMoreContent = await this.gapAnalysis.needsMoreContent(request.id);

      if (!needsMoreContent) {
        // Show is complete, mark as completed if not already
        if (request.status !== RequestStatus.COMPLETED) {
          await this.orchestrator.markAsCompleted(request.id);
          this.logger.log(`Marked ${request.title} as completed - no more content needed`);
        }
        this.stats.completed++;
        return;
      }

      this.stats.needingContent++;

      // Check if we should search for this show
      if (await this.shouldSearchForShow(request)) {
        // Reset to PENDING to trigger search in the main torrent checker
        if (request.status !== RequestStatus.PENDING) {
          await this.orchestrator.transitionRequest({
            requestId: request.id,
            targetStatus: RequestStatus.PENDING,
            reason: 'Needs more content - triggering search',
          });
          this.logger.log(`Reset ${request.title} to PENDING for content search`);
        }
      }
    } catch (error) {
      this.logger.error(`Error processing TV show request ${request.title}:`, error);
      throw error;
    }
  }

  /**
   * Determine if we should search for a show based on various criteria
   */
  private async shouldSearchForShow(request: any): Promise<boolean> {
    // Always search if status is PENDING (not currently being processed)
    if (request.status === RequestStatus.PENDING) {
      return false; // Already pending, will be picked up by torrent checker
    }

    // Search if status is FOUND but no recent downloads
    if (request.status === RequestStatus.FOUND) {
      const recentDownloads = await this.prisma.torrentDownload.findMany({
        where: {
          requestedTorrentId: request.id,
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
          },
        },
      });

      // If no recent downloads, reset to search again
      return recentDownloads.length === 0;
    }

    // For ongoing shows, search more frequently
    if (request.isOngoing) {
      const lastSearchTime = request.lastSearchedAt || request.updatedAt;
      const timeSinceLastSearch = Date.now() - new Date(lastSearchTime).getTime();
      const searchInterval = 6 * 60 * 60 * 1000; // 6 hours for ongoing shows

      return timeSinceLastSearch > searchInterval;
    }

    // For completed shows, search less frequently
    const lastSearchTime = request.lastSearchedAt || request.updatedAt;
    const timeSinceLastSearch = Date.now() - new Date(lastSearchTime).getTime();
    const searchInterval = 24 * 60 * 60 * 1000; // 24 hours for completed shows

    return timeSinceLastSearch > searchInterval;
  }

  /**
   * Manually trigger search loop (for testing or manual intervention)
   */
  async triggerSearchLoop(): Promise<SearchLoopStats> {
    if (this.isRunning) {
      throw new Error('Search loop is already running');
    }

    await this.runSearchLoop();
    return this.getStats();
  }

  /**
   * Get current search loop statistics
   */
  getStats(): SearchLoopStats {
    return { ...this.stats };
  }

  /**
   * Check if search loop is currently running
   */
  isSearchLoopRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Force a specific TV show to be searched on next loop
   */
  async forceSearchForShow(requestId: string): Promise<void> {
    const request = await this.prisma.requestedTorrent.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new Error(`Request ${requestId} not found`);
    }

    if (request.contentType !== ContentType.TV_SHOW) {
      throw new Error(`Request ${requestId} is not a TV show`);
    }

    // Reset to PENDING to trigger immediate search
    await this.orchestrator.transitionRequest({
      requestId,
      targetStatus: RequestStatus.PENDING,
      reason: 'Manually forced search',
    });

    this.logger.log(`Forced search for TV show: ${request.title}`);
  }

  /**
   * Get TV shows that need more content
   */
  async getTvShowsNeedingContent(): Promise<any[]> {
    const tvShowRequests = await this.prisma.requestedTorrent.findMany({
      where: {
        contentType: ContentType.TV_SHOW,
      },
      include: {
        tvShowSeasons: {
          include: {
            episodes: true,
          },
        },
      },
    });

    const showsNeedingContent = [];

    for (const request of tvShowRequests) {
      try {
        const needsMoreContent = await this.gapAnalysis.needsMoreContent(request.id);
        if (needsMoreContent) {
          const analysis = await this.gapAnalysis.analyzeContentGaps(request.id);
          showsNeedingContent.push({
            ...request,
            gapAnalysis: analysis,
          });
        }
      } catch (error) {
        this.logger.error(`Error analyzing ${request.title}:`, error);
      }
    }

    return showsNeedingContent;
  }

  /**
   * Get summary of all TV show statuses
   */
  async getTvShowSummary(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    needingContent: number;
    complete: number;
  }> {
    const tvShows = await this.prisma.requestedTorrent.findMany({
      where: { contentType: ContentType.TV_SHOW },
      select: { id: true, status: true },
    });

    const byStatus: Record<string, number> = {};
    let needingContent = 0;
    let complete = 0;

    for (const show of tvShows) {
      byStatus[show.status] = (byStatus[show.status] || 0) + 1;

      try {
        const needs = await this.gapAnalysis.needsMoreContent(show.id);
        if (needs) {
          needingContent++;
        } else {
          complete++;
        }
      } catch (error) {
        // Ignore errors for summary
      }
    }

    return {
      total: tvShows.length,
      byStatus,
      needingContent,
      complete,
    };
  }
}
