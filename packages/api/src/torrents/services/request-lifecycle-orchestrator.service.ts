import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { RequestStatus, RequestedTorrent, ContentType } from '../../../generated/prisma';
import { RequestStateMachine, StateTransitionContext, StateAction } from '../state-machine/request-state-machine';
import { TvShowStateMachine, TvShowStateContext } from '../state-machine/tv-show-state-machine';
import { DownloadAggregationService } from './download-aggregation.service';
import { Aria2Service } from '../../download/aria2.service';

export interface TransitionRequestDto {
  requestId: string;
  targetStatus: RequestStatus;
  reason?: string;
  metadata?: Record<string, any>;
}

export interface TorrentInfo {
  title: string;
  link: string;
  magnetUri?: string;
  size: string;
  seeders: number;
  indexer: string;
}

export interface DownloadInfo {
  downloadJobId: string;
  aria2Gid: string;
  torrentInfo: TorrentInfo;
}

@Injectable()
export class RequestLifecycleOrchestrator {
  private readonly logger = new Logger(RequestLifecycleOrchestrator.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly requestStateMachine: RequestStateMachine,
    private readonly tvShowStateMachine: TvShowStateMachine,
    private readonly downloadAggregationService: DownloadAggregationService,
    @Inject(forwardRef(() => Aria2Service))
    private readonly aria2Service: Aria2Service,
  ) {}

  /**
   * Transition a request to a new status with proper validation and side effects
   */
  async transitionRequest(dto: TransitionRequestDto): Promise<RequestedTorrent> {
    const { requestId, targetStatus, reason, metadata } = dto;

    // Get current request state
    const currentRequest = await this.prisma.requestedTorrent.findUnique({
      where: { id: requestId },
      include: {
        tvShowSeasons: {
          include: {
            episodes: true,
          },
        },
        torrentDownloads: true,
      },
    });

    if (!currentRequest) {
      throw new Error(`Request ${requestId} not found`);
    }

    // Prepare transition context
    const context: StateTransitionContext = {
      requestId,
      currentStatus: currentRequest.status,
      targetStatus,
      metadata: {
        ...metadata,
        searchAttempts: currentRequest.searchAttempts,
        maxSearchAttempts: currentRequest.maxSearchAttempts,
        contentType: currentRequest.contentType,
        isOngoing: currentRequest.isOngoing,
      },
      reason,
    };

    // Attempt state transition
    const transitionResult = await this.requestStateMachine.transition(context);

    if (!transitionResult.success) {
      throw new Error(`State transition failed: ${transitionResult.error}`);
    }

    // Execute state actions
    await this.executeStateActions(requestId, transitionResult.actions, metadata);

    // Handle TV show specific logic
    if (currentRequest.contentType === ContentType.TV_SHOW) {
      await this.handleTvShowStateUpdate(currentRequest, transitionResult.newStatus);
    }

    // Update request in database
    const updatedRequest = await this.updateRequestInDatabase(requestId, transitionResult.newStatus, metadata);

    this.logger.log(`Request ${requestId} transitioned from ${context.currentStatus} to ${transitionResult.newStatus}`);

    return updatedRequest;
  }

  /**
   * Start search for a request
   */
  async startSearch(requestId: string): Promise<RequestedTorrent> {
    return this.transitionRequest({
      requestId,
      targetStatus: RequestStatus.SEARCHING,
      reason: 'Starting search process',
    });
  }

  /**
   * Mark request as found with torrent information
   */
  async markAsFound(requestId: string, torrentInfo: TorrentInfo): Promise<RequestedTorrent> {
    return this.transitionRequest({
      requestId,
      targetStatus: RequestStatus.FOUND,
      reason: 'Suitable torrent found',
      metadata: {
        torrentInfo,
        selectedTorrent: true,
      },
    });
  }

  /**
   * Start download for a request
   */
  async startDownload(requestId: string, downloadInfo: DownloadInfo): Promise<RequestedTorrent> {
    return this.transitionRequest({
      requestId,
      targetStatus: RequestStatus.DOWNLOADING,
      reason: 'Download initiated',
      metadata: {
        downloadJobId: downloadInfo.downloadJobId,
        aria2Gid: downloadInfo.aria2Gid,
        torrentInfo: downloadInfo.torrentInfo,
        selectedTorrent: true, // Required by state machine guard
      },
    });
  }

  /**
   * Mark request as completed
   */
  async markAsCompleted(requestId: string): Promise<RequestedTorrent> {
    // Verify download is actually complete using aggregation service
    const request = await this.prisma.requestedTorrent.findUnique({
      where: { id: requestId },
      include: { torrentDownloads: true },
    });

    if (request?.torrentDownloads.length > 0) {
      // Check if all downloads are actually complete
      for (const torrentDownload of request.torrentDownloads) {
        if (torrentDownload.aria2Gid) {
          const isComplete = await this.downloadAggregationService.isDownloadComplete(torrentDownload.aria2Gid);
          if (!isComplete) {
            throw new Error('Cannot mark as completed: not all downloads are actually complete');
          }
        }
      }
    }

    return this.transitionRequest({
      requestId,
      targetStatus: RequestStatus.COMPLETED,
      reason: 'Download completed successfully',
      metadata: {
        downloadComplete: true,
      },
    });
  }

  /**
   * Mark request as failed
   */
  async markAsFailed(requestId: string, reason: string): Promise<RequestedTorrent> {
    return this.transitionRequest({
      requestId,
      targetStatus: RequestStatus.FAILED,
      reason,
    });
  }

  /**
   * Cancel a request
   */
  async cancelRequest(requestId: string): Promise<RequestedTorrent> {
    return this.transitionRequest({
      requestId,
      targetStatus: RequestStatus.CANCELLED,
      reason: 'Request cancelled by user',
    });
  }

  /**
   * Mark request as expired
   */
  async markAsExpired(requestId: string): Promise<RequestedTorrent> {
    return this.transitionRequest({
      requestId,
      targetStatus: RequestStatus.EXPIRED,
      reason: 'Request expired due to timeout or max attempts',
    });
  }

  /**
   * Mark request as cancelled
   */
  async markAsCancelled(requestId: string, reason?: string): Promise<RequestedTorrent> {
    return this.transitionRequest({
      requestId,
      targetStatus: RequestStatus.CANCELLED,
      reason: reason || 'Request cancelled by user',
    });
  }

  /**
   * Get live download status for a request (aggregated from all its downloads)
   */
  async getRequestDownloadStatus(requestId: string) {
    return this.downloadAggregationService.getRequestDownloadStatus(requestId);
  }

  /**
   * Get download summary for all requests
   */
  async getDownloadSummary() {
    return this.downloadAggregationService.getRequestDownloadSummary();
  }

  /**
   * Handle TV show season pack completion
   */
  async markSeasonPackCompleted(requestId: string, seasonId: string): Promise<void> {
    // Get season and its episodes
    const season = await this.prisma.tvShowSeason.findUnique({
      where: { id: seasonId },
      include: { episodes: true },
    });

    if (!season) {
      throw new Error(`Season ${seasonId} not found`);
    }

    // Mark all episodes as completed
    const episodeUpdates = this.tvShowStateMachine.markSeasonPackCompleted(seasonId, season.episodes);

    for (const update of episodeUpdates) {
      await this.prisma.tvShowEpisode.update({
        where: { id: update.episodeId },
        data: { status: update.newStatus },
      });
    }

    // Update season status
    await this.prisma.tvShowSeason.update({
      where: { id: seasonId },
      data: { status: 'COMPLETED' },
    });

    // Recalculate main request status
    await this.recalculateTvShowStatus(requestId);
  }

  /**
   * Handle individual episode completion
   */
  async markEpisodeCompleted(requestId: string, episodeId: string): Promise<void> {
    // Mark episode as completed
    const episodeUpdates = this.tvShowStateMachine.markEpisodeCompleted(episodeId);

    for (const update of episodeUpdates) {
      await this.prisma.tvShowEpisode.update({
        where: { id: update.episodeId },
        data: { status: update.newStatus },
      });
    }

    // Recalculate main request status
    await this.recalculateTvShowStatus(requestId);
  }

  /**
   * Handle season pack failure
   */
  async markSeasonPackFailed(requestId: string, seasonId: string): Promise<void> {
    // Get season and its episodes
    const season = await this.prisma.tvShowSeason.findUnique({
      where: { id: seasonId },
      include: { episodes: true },
    });

    if (!season) {
      throw new Error(`Season ${seasonId} not found`);
    }

    // Mark all episodes as failed
    const episodeUpdates = this.tvShowStateMachine.markSeasonPackFailed(seasonId, season.episodes);

    for (const update of episodeUpdates) {
      await this.prisma.tvShowEpisode.update({
        where: { id: update.episodeId },
        data: { status: update.newStatus },
      });
    }

    // Update season status
    await this.prisma.tvShowSeason.update({
      where: { id: seasonId },
      data: { status: 'FAILED' },
    });

    // Recalculate main request status
    await this.recalculateTvShowStatus(requestId);
  }

  /**
   * Handle individual episode failure
   */
  async markEpisodeFailed(requestId: string, episodeId: string): Promise<void> {
    // Mark episode as failed
    const episodeUpdates = this.tvShowStateMachine.markEpisodeFailed(episodeId);

    for (const update of episodeUpdates) {
      await this.prisma.tvShowEpisode.update({
        where: { id: update.episodeId },
        data: { status: update.newStatus },
      });
    }

    // Recalculate main request status
    await this.recalculateTvShowStatus(requestId);
  }

  /**
   * Recalculate and update TV show main request status based on seasons/episodes
   */
  private async recalculateTvShowStatus(requestId: string): Promise<void> {
    const request = await this.prisma.requestedTorrent.findUnique({
      where: { id: requestId },
      include: {
        tvShowSeasons: {
          include: { episodes: true },
        },
      },
    });

    if (!request || request.contentType !== ContentType.TV_SHOW) {
      return;
    }

    const context: TvShowStateContext = {
      requestId,
      isOngoing: request.isOngoing,
      seasons: request.tvShowSeasons.map(season => ({
        id: season.id,
        seasonNumber: season.seasonNumber,
        status: season.status,
        episodes: season.episodes.map(episode => ({
          id: episode.id,
          episodeNumber: episode.episodeNumber,
          status: episode.status,
        })),
      })),
    };

    const result = this.tvShowStateMachine.calculateAggregateStatus(context);

    // Update main request status if it changed
    if (result.mainRequestStatus !== request.status) {
      await this.prisma.requestedTorrent.update({
        where: { id: requestId },
        data: { status: result.mainRequestStatus },
      });

      this.logger.log(`Updated TV show request ${requestId} status to ${result.mainRequestStatus}`);
    }
  }

  /**
   * Execute state actions
   */
  private async executeStateActions(requestId: string, actions: StateAction[], metadata?: Record<string, any>): Promise<void> {
    for (const action of actions) {
      try {
        await this.executeStateAction(requestId, action, metadata);
      } catch (error) {
        this.logger.error(`Error executing state action ${action.type} for request ${requestId}:`, error);
      }
    }
  }

  /**
   * Execute a single state action
   */
  private async executeStateAction(requestId: string, action: StateAction, metadata?: Record<string, any>): Promise<void> {
    switch (action.type) {
      case 'INCREMENT_SEARCH_ATTEMPTS':
        await this.incrementSearchAttempts(requestId);
        break;
      case 'UPDATE_SEARCH_TIMESTAMP':
        await this.updateSearchTimestamp(requestId);
        break;
      case 'SCHEDULE_NEXT_SEARCH':
        await this.scheduleNextSearch(requestId);
        break;
      case 'STORE_TORRENT_INFO':
        await this.storeTorrentInfo(requestId, action.payload);
        break;
      case 'CREATE_DOWNLOAD_JOB':
        await this.createDownloadJob(requestId, action.payload);
        break;
      case 'SET_COMPLETION_TIMESTAMP':
        await this.setCompletionTimestamp(requestId);
        break;
      case 'CLEANUP_TEMP_FILES':
        await this.cleanupTempFiles(requestId);
        break;
      case 'CANCEL_DOWNLOAD_JOBS':
        await this.cancelDownloadJobs(requestId);
        break;
      default:
        this.logger.debug(`Unknown state action: ${action.type}`);
    }
  }

  // Action implementations
  private async incrementSearchAttempts(requestId: string): Promise<void> {
    await this.prisma.requestedTorrent.update({
      where: { id: requestId },
      data: {
        searchAttempts: { increment: 1 },
      },
    });
  }

  private async updateSearchTimestamp(requestId: string): Promise<void> {
    await this.prisma.requestedTorrent.update({
      where: { id: requestId },
      data: {
        lastSearchAt: new Date(),
      },
    });
  }

  private async scheduleNextSearch(requestId: string): Promise<void> {
    const request = await this.prisma.requestedTorrent.findUnique({
      where: { id: requestId },
    });

    if (request) {
      const nextSearchAt = new Date();
      nextSearchAt.setMinutes(nextSearchAt.getMinutes() + request.searchIntervalMins);

      await this.prisma.requestedTorrent.update({
        where: { id: requestId },
        data: { nextSearchAt },
      });
    }
  }

  private async storeTorrentInfo(requestId: string, torrentInfo: any): Promise<void> {
    if (torrentInfo) {
      await this.prisma.requestedTorrent.update({
        where: { id: requestId },
        data: {
          foundTorrentTitle: torrentInfo.title,
          foundTorrentLink: torrentInfo.link,
          foundMagnetUri: torrentInfo.magnetUri,
          foundTorrentSize: torrentInfo.size,
          foundSeeders: torrentInfo.seeders,
          foundIndexer: torrentInfo.indexer,
        },
      });
    }
  }

  private async createDownloadJob(requestId: string, payload: any): Promise<void> {
    // This will be implemented when integrating with download service
    this.logger.debug(`Creating download job for request ${requestId}`, payload);
  }

  private async setCompletionTimestamp(requestId: string): Promise<void> {
    await this.prisma.requestedTorrent.update({
      where: { id: requestId },
      data: {
        completedAt: new Date(),
      },
    });
  }

  private async cleanupTempFiles(requestId: string): Promise<void> {
    // Implement cleanup logic
    this.logger.debug(`Cleaning up temp files for request ${requestId}`);
  }

  private async cancelDownloadJobs(requestId: string): Promise<void> {
    // Implement download job cancellation
    this.logger.debug(`Cancelling download jobs for request ${requestId}`);
  }

  private async handleTvShowStateUpdate(request: RequestedTorrent, newStatus: RequestStatus): Promise<void> {
    this.logger.debug(`Handling TV show state update for request ${request.id}: ${newStatus}`);

    // Get current TV show data with seasons and episodes
    const tvShowData = await this.prisma.requestedTorrent.findUnique({
      where: { id: request.id },
      include: {
        tvShowSeasons: {
          include: {
            episodes: true,
          },
        },
      },
    });

    if (!tvShowData || tvShowData.contentType !== ContentType.TV_SHOW) {
      return;
    }

    // Prepare context for TV show state machine
    const context: TvShowStateContext = {
      requestId: request.id,
      isOngoing: tvShowData.isOngoing,
      seasons: tvShowData.tvShowSeasons.map(season => ({
        id: season.id,
        seasonNumber: season.seasonNumber,
        status: season.status,
        episodes: season.episodes.map(episode => ({
          id: episode.id,
          episodeNumber: episode.episodeNumber,
          status: episode.status,
        })),
      })),
    };

    // Calculate aggregate status
    const result = this.tvShowStateMachine.calculateAggregateStatus(context);

    // Apply season updates
    for (const seasonUpdate of result.seasonUpdates) {
      await this.prisma.tvShowSeason.update({
        where: { id: seasonUpdate.seasonId },
        data: { status: seasonUpdate.newStatus },
      });
    }

    // Apply episode updates
    for (const episodeUpdate of result.episodeUpdates) {
      await this.prisma.tvShowEpisode.update({
        where: { id: episodeUpdate.episodeId },
        data: { status: episodeUpdate.newStatus },
      });
    }

    // If the calculated main status differs from current, update it
    if (result.mainRequestStatus !== newStatus) {
      this.logger.log(`TV show aggregate status differs: calculated=${result.mainRequestStatus}, current=${newStatus}`);
      // Note: We don't update here to avoid recursion, this is just for logging
    }
  }

  private async updateRequestInDatabase(requestId: string, newStatus: RequestStatus, metadata?: Record<string, any>): Promise<RequestedTorrent> {
    const updateData: any = {
      status: newStatus,
      updatedAt: new Date(),
    };

    // Add metadata fields if provided
    if (metadata?.downloadJobId) {
      updateData.downloadJobId = metadata.downloadJobId;
    }
    if (metadata?.aria2Gid) {
      updateData.aria2Gid = metadata.aria2Gid;
    }

    return this.prisma.requestedTorrent.update({
      where: { id: requestId },
      data: updateData,
      include: {
        tvShowSeasons: {
          include: {
            episodes: true,
          },
        },
        torrentDownloads: true,
      },
    });
  }
}
