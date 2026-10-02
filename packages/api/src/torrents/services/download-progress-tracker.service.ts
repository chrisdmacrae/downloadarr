import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RequestedTorrentsService } from './requested-torrents.service';
import { RequestLifecycleOrchestrator } from './request-lifecycle-orchestrator.service';
import { DownloadAggregationService } from './download-aggregation.service';
import { Aria2Service } from '../../download/aria2.service';
import { PrismaService } from '../../database/prisma.service';
import { OrganizationRulesService } from '../../organization/services/organization-rules.service';
import { DownloadOrganizationService, OrganizeTarget } from '../../organization/services/download-organization.service';
import { SeasonScanningService } from './season-scanning.service';
import { DownloadService } from '../../download/download.service';
import { DownloadType } from '../../download/dto/create-download.dto';
import { RequestStatus, ContentType, RequestedTorrent, TorrentDownload } from '../../../generated/prisma';
import { fromAria2Path } from '../../common/utils/aria2-paths';
import { downloadDestinationFor, sanitizeDownloadName } from '../utils/download-target';

/** What came of moving a download's files: the ones still stuck, or why none could be tried. */
interface OrganizeAttempt {
  failed: Array<{ path: string; error: string }>;
  error?: string;
}

@Injectable()
export class DownloadProgressTrackerService {
  private readonly logger = new Logger(DownloadProgressTrackerService.name);
  private isTracking = false;

  constructor(
    private readonly requestedTorrentsService: RequestedTorrentsService,
    private readonly orchestrator: RequestLifecycleOrchestrator,
    private readonly downloadAggregationService: DownloadAggregationService,
    private readonly aria2Service: Aria2Service,
    private readonly prisma: PrismaService,
    private readonly organizationRulesService: OrganizationRulesService,
    private readonly downloadOrganizationService: DownloadOrganizationService,
    private readonly seasonScanningService: SeasonScanningService,
    @Inject(forwardRef(() => DownloadService))
    private readonly downloadService: DownloadService,
  ) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  async trackDownloadStatus(): Promise<void> {
    // Moving a finished season into the library can take longer than the 30
    // seconds between runs. A second run would find the same download still
    // finished, move the same files again on top of the first, and release
    // the show for its next download before the first move is done.
    if (this.isTracking) {
      this.logger.debug('Download tracking already in progress, skipping...');
      return;
    }

    this.isTracking = true;
    try {
      await this.trackDownloads();
      await this.recoverStrandedFoundRequests();
    } catch (error) {
      this.logger.error('Error tracking download status:', error);
    } finally {
      this.isTracking = false;
    }
  }

  /**
   * Follows every download that is still running, whatever state its request
   * is in. Tracking by request missed a download that finished after its
   * request had failed or gone back to pending: nothing looked at it again,
   * and its files stayed in the downloads folder.
   */
  private async trackDownloads(): Promise<void> {
    const downloads = await this.prisma.torrentDownload.findMany({
      where: { status: 'DOWNLOADING', aria2Gid: { not: null } },
      include: { requestedTorrent: true },
      orderBy: { createdAt: 'asc' },
    });

    // A download can have more than one record; it is handled once
    const tracked = new Set<string>();
    for (const download of downloads) {
      const key = `${download.requestedTorrentId}:${download.aria2Gid}`;
      if (tracked.has(key)) continue;
      tracked.add(key);

      try {
        await this.checkDownload(download.requestedTorrent, download.aria2Gid!, download);
      } catch (error) {
        this.logger.error(`Error checking download ${download.aria2Gid} for request ${download.requestedTorrentId}:`, error);
      }
    }

    // Requests that are downloading with no record of the download (linked by hand, or older data)
    const downloadingRequests = await this.requestedTorrentsService.getRequestsByStatus(RequestStatus.DOWNLOADING);
    for (const request of downloadingRequests) {
      if (!request.aria2Gid || tracked.has(`${request.id}:${request.aria2Gid}`)) continue;

      try {
        await this.checkDownload(request, request.aria2Gid);
      } catch (error) {
        this.logger.error(`Error checking status for request ${request.id}:`, error);
      }
    }
  }

  private async checkDownload(request: RequestedTorrent, aria2Gid: string, download?: TorrentDownload): Promise<void> {
    if (await this.downloadAggregationService.isDownloadComplete(aria2Gid)) {
      await this.handleDownloadCompletion(request, aria2Gid);
      return;
    }

    const failure = await this.downloadAggregationService.isDownloadFailed(aria2Gid);
    if (failure.failed) {
      // aria2 forgets its downloads when it loses its session. The link is
      // still here, and the partial files are still on disk, so hand it back.
      if (failure.lost && download && (await this.readdLostDownload(request, download))) {
        return;
      }
      await this.handleDownloadFailure(request, aria2Gid, failure.reason);
      return;
    }

    // Still running. A request that was marked failed while its download
    // carried on goes back to downloading rather than sit failed until it lands.
    if (download && request.status === RequestStatus.FAILED) {
      await this.reviveRequest(request, download);
    }
  }

  /**
   * Give a download aria2 no longer knows about back to aria2. It resumes
   * from what is already in the downloads folder.
   */
  private async readdLostDownload(request: RequestedTorrent, download: TorrentDownload): Promise<boolean> {
    const url = download.magnetUri || download.torrentLink;
    // Nothing to restart it from, or nobody is waiting for it any more
    if (!url || request.status === RequestStatus.CANCELLED || request.status === RequestStatus.COMPLETED) {
      return false;
    }

    const lostGid = download.aria2Gid!;
    try {
      const job = await this.downloadService.createDownload({
        url,
        type: download.magnetUri ? DownloadType.MAGNET : DownloadType.TORRENT,
        name: sanitizeDownloadName(download.torrentTitle),
        destination: downloadDestinationFor(request.contentType),
      }, { matchRequests: false });
      const downloadJobId = job.id.toString();

      await this.prisma.torrentDownload.updateMany({
        where: { aria2Gid: lostGid, status: 'DOWNLOADING' },
        data: { aria2Gid: job.aria2Gid, downloadJobId },
      });
      if (request.aria2Gid === lostGid) {
        await this.prisma.requestedTorrent.update({
          where: { id: request.id },
          data: { aria2Gid: job.aria2Gid, downloadJobId },
        });
      }
      // The entry for the lost download would otherwise linger on the Downloads page
      await this.prisma.downloadMetadata.deleteMany({ where: { aria2Gid: lostGid } });

      this.logger.warn(`aria2 lost download ${lostGid} for ${request.title}; started it again as ${job.aria2Gid}`);
      return true;
    } catch (error) {
      this.logger.warn(`Could not restart lost download ${lostGid} for ${request.title}: ${error.message}`);
      return false;
    }
  }

  private async reviveRequest(request: RequestedTorrent, download: TorrentDownload): Promise<void> {
    try {
      const torrentInfo = this.torrentInfoFor(download);
      await this.orchestrator.startSearch(request.id);
      await this.orchestrator.markAsFound(request.id, torrentInfo);
      await this.orchestrator.startDownload(request.id, {
        downloadJobId: download.downloadJobId || '',
        aria2Gid: download.aria2Gid!,
        torrentInfo,
      });
      this.logger.warn(`Request ${request.id} (${request.title}) was failed while ${download.aria2Gid} is still downloading; put back to downloading`);
    } catch (error) {
      // The download is tracked either way and will be organized when it lands
      this.logger.debug(`Could not put request ${request.id} back to downloading: ${error.message}`);
    }
  }

  private torrentInfoFor(download: TorrentDownload) {
    return {
      title: download.torrentTitle,
      link: download.torrentLink || '',
      magnetUri: download.magnetUri || undefined,
      size: download.torrentSize || 'Unknown',
      seeders: download.seeders || 0,
      indexer: download.indexer || 'Unknown',
    };
  }

  /**
   * Downloads are started in aria2 before the request transitions FOUND → DOWNLOADING.
   * If anything fails in between, the request is left in FOUND while aria2 keeps
   * downloading, and nothing would ever organize or complete it. Move such requests
   * on to DOWNLOADING so the normal tracking below picks them up.
   */
  private async recoverStrandedFoundRequests(): Promise<void> {
    // Give in-flight initiations time to finish their own transition
    const settledBefore = new Date(Date.now() - 2 * 60 * 1000);

    const stranded = await this.prisma.requestedTorrent.findMany({
      where: {
        status: RequestStatus.FOUND,
        torrentDownloads: {
          some: {
            status: 'DOWNLOADING',
            aria2Gid: { not: null },
            createdAt: { lt: settledBefore },
          },
        },
      },
      include: {
        torrentDownloads: {
          where: { status: 'DOWNLOADING', aria2Gid: { not: null } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    for (const request of stranded) {
      for (const torrentDownload of request.torrentDownloads) {
        try {
          // Only adopt downloads aria2 still knows about
          await this.aria2Service.getStatus(torrentDownload.aria2Gid!);
        } catch {
          // A download aria2 has lost is restarted or failed by trackDownloads
          continue;
        }

        try {
          await this.orchestrator.startDownload(request.id, {
            downloadJobId: torrentDownload.downloadJobId || '',
            aria2Gid: torrentDownload.aria2Gid!,
            torrentInfo: this.torrentInfoFor(torrentDownload),
          });
          this.logger.warn(`Recovered request ${request.id} (${request.title}) stuck in FOUND with active download ${torrentDownload.aria2Gid}`);
        } catch (error) {
          this.logger.error(`Error recovering stranded request ${request.id}:`, error);
        }
        break;
      }
    }
  }

  private formatSpeed(bytesPerSecond: number): string {
    if (bytesPerSecond === 0) return '0 B/s';
    
    const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    let speed = bytesPerSecond;
    let unitIndex = 0;

    while (speed >= 1024 && unitIndex < units.length - 1) {
      speed /= 1024;
      unitIndex++;
    }

    return `${speed.toFixed(1)} ${units[unitIndex]}`;
  }

  private calculateEta(totalLength: number, completedLength: number, downloadSpeed: number): string {
    if (downloadSpeed === 0 || totalLength === 0) return 'Unknown';
    
    const remainingBytes = totalLength - completedLength;
    const remainingSeconds = remainingBytes / downloadSpeed;

    if (remainingSeconds < 60) {
      return `${Math.round(remainingSeconds)}s`;
    } else if (remainingSeconds < 3600) {
      return `${Math.round(remainingSeconds / 60)}m`;
    } else {
      const hours = Math.floor(remainingSeconds / 3600);
      const minutes = Math.round((remainingSeconds % 3600) / 60);
      return `${hours}h ${minutes}m`;
    }
  }

  // Manual method to sync a specific download
  async syncDownloadStatus(requestId: string): Promise<void> {
    try {
      const request = await this.requestedTorrentsService.getRequestById(requestId);

      if (request.status !== RequestStatus.DOWNLOADING || !request.aria2Gid) {
        this.logger.warn(`Request ${requestId} is not in downloading state or missing aria2Gid`);
        return;
      }

      await this.checkDownload(request, request.aria2Gid);
    } catch (error) {
      this.logger.error(`Error syncing download status for ${requestId}:`, error);
      throw error;
    }
  }

  private async handleDownloadCompletion(request: RequestedTorrent, aria2Gid: string): Promise<void> {
    const requestId = request.id;
    try {
      // Mid-search, the checker is about to change this request's state.
      // The download is still here on the next run.
      if (request.status === RequestStatus.SEARCHING) {
        return;
      }

      const settled = request.status === RequestStatus.CANCELLED ? 'CANCELLED' : 'COMPLETED';
      await this.prisma.torrentDownload.updateMany({
        where: { aria2Gid, status: 'DOWNLOADING' },
        data: { status: settled, completedAt: new Date(), updatedAt: new Date() },
      });

      // A cancelled request does not want its files. They stay in the
      // downloads folder, where they can be organized by hand or deleted.
      if (request.status === RequestStatus.CANCELLED) {
        this.logger.log(`Download ${aria2Gid} finished for cancelled request ${requestId}, leaving its files`);
        return;
      }

      const attempt = await this.organizeDownloadedFiles(requestId, aria2Gid);
      if (attempt.error || attempt.failed.length > 0) {
        await this.holdForManualOrganize(request, attempt);
        return;
      }

      await this.countDownloadedEpisodes(requestId);
      await this.settleRequest(request);
      this.logger.log(`Download completed for request ${requestId}`);
    } catch (error) {
      this.logger.error(`Error handling download completion for request ${requestId}:`, error);
    }
  }

  /**
   * Move the request on now that its download is in the library. A request
   * that was not waiting on this download (it had failed, or gone back to
   * pending) is caught up rather than left behind.
   */
  private async settleRequest(request: RequestedTorrent): Promise<void> {
    switch (request.status) {
      case RequestStatus.DOWNLOADING:
      case RequestStatus.ORGANIZE_FAILED:
        await this.orchestrator.markAsCompleted(request.id);
        return;

      case RequestStatus.COMPLETED:
        return;

      default:
        if (request.contentType !== ContentType.TV_SHOW) {
          await this.orchestrator.markAsManuallyOrganized(request.id);
        } else if (request.status === RequestStatus.FAILED) {
          // The show has what this download brought; let it look for the rest
          await this.orchestrator.startSearch(request.id);
          await this.orchestrator.transitionRequest({
            requestId: request.id,
            targetStatus: RequestStatus.PENDING,
            reason: 'A download for this show finished after it was marked failed',
            metadata: { nextSearchAt: new Date() },
          });
        }
    }
  }

  /**
   * A download whose files could not all be moved stops here. The request
   * does not complete and, for a show, does not go on to its next season:
   * it waits in ORGANIZE_FAILED, with the stuck files listed, until someone
   * retries the move.
   */
  private async holdForManualOrganize(request: RequestedTorrent, attempt: OrganizeAttempt): Promise<void> {
    const requestId = request.id;
    const reason = this.describeFailure(attempt);

    // A completed request cannot be held. Its stuck files show up in the
    // downloads folder list instead.
    if (request.status === RequestStatus.COMPLETED) {
      this.logger.warn(`Could not move files of an extra download for completed request ${requestId}: ${reason}`);
      return;
    }

    await this.prisma.requestedTorrent.update({
      where: { id: requestId },
      data: {
        organizeError: reason,
        unorganizedFiles: attempt.failed.map(file => file.path),
      },
    });
    await this.orchestrator.markAsOrganizeFailed(requestId, reason);

    this.logger.warn(`Request ${requestId} is held for a manual retry: ${reason}`);
  }

  private describeFailure(attempt: OrganizeAttempt): string {
    if (attempt.error) {
      return attempt.error;
    }
    const [first] = attempt.failed;
    return attempt.failed.length === 1
      ? `Could not move ${first.path.split('/').pop()}: ${first.error}`
      : `${attempt.failed.length} files could not be moved. First: ${first.path.split('/').pop()}: ${first.error}`;
  }

  /**
   * Try again to move the files of a request held in ORGANIZE_FAILED. Files
   * that are no longer in the downloads folder count as dealt with, so moving
   * them by hand and retrying releases the request too.
   */
  async retryOrganize(requestId: string): Promise<{ success: boolean; message: string; failed: Array<{ path: string; error: string }> }> {
    const request = await this.prisma.requestedTorrent.findUnique({ where: { id: requestId } });

    if (!request) {
      throw new Error(`Request ${requestId} not found`);
    }
    if (request.status !== RequestStatus.ORGANIZE_FAILED) {
      throw new Error(`Request is ${request.status}: there is no failed move to retry`);
    }

    let attempt: OrganizeAttempt = { failed: [] };
    if (request.unorganizedFiles.length > 0) {
      const outcome = await this.downloadOrganizationService.organizeFiles(request.unorganizedFiles, this.targetFor(request));
      attempt = { failed: outcome.failed };
    } else if (request.aria2Gid) {
      // The first attempt never got as far as a list of files
      attempt = await this.organizeDownloadedFiles(requestId, request.aria2Gid);
    }

    if (attempt.error || attempt.failed.length > 0) {
      const reason = this.describeFailure(attempt);
      await this.prisma.requestedTorrent.update({
        where: { id: requestId },
        data: { organizeError: reason, unorganizedFiles: attempt.failed.map(file => file.path) },
      });
      return { success: false, message: reason, failed: attempt.failed };
    }

    await this.prisma.requestedTorrent.update({
      where: { id: requestId },
      data: { organizeError: null, unorganizedFiles: [] },
    });
    await this.countDownloadedEpisodes(requestId);
    await this.orchestrator.markAsCompleted(requestId);

    this.logger.log(`Retried organizing request ${requestId}: files moved`);
    return { success: true, message: 'Files moved to the library', failed: [] };
  }

  private targetFor(request: { id: string; contentType: ContentType; title: string; year: number | null; season: number | null; episode: number | null; platform: string | null; artist: string | null }): OrganizeTarget {
    return {
      contentType: request.contentType,
      title: request.title,
      year: request.year || undefined,
      season: request.season || undefined,
      episode: request.episode || undefined,
      platform: request.platform || undefined,
      artist: request.artist || undefined,
      requestId: request.id,
    };
  }

  private async handleDownloadFailure(request: RequestedTorrent, aria2Gid: string, errorMessage?: string): Promise<void> {
    try {
      await this.prisma.torrentDownload.updateMany({
        where: { aria2Gid, status: 'DOWNLOADING' },
        data: { status: 'FAILED', updatedAt: new Date() },
      });
      this.logger.warn(`Download ${aria2Gid} failed for request ${request.id}: ${errorMessage || 'Unknown error'}`);

      // Only a request that is waiting on this download fails with it
      if (request.status === RequestStatus.DOWNLOADING && request.aria2Gid === aria2Gid) {
        await this.orchestrator.markAsFailed(request.id, errorMessage || 'Download failed');
      }
    } catch (error) {
      this.logger.error(`Error handling download failure for request ${request.id}:`, error);
    }
  }

  /**
   * Mark the episodes a TV download just delivered. Completing the request
   * decides what the show still needs from its episodes; left to the periodic
   * scan, the season just downloaded would still look missing and be fetched
   * again instead of the next one.
   */
  private async countDownloadedEpisodes(requestId: string): Promise<void> {
    try {
      const request = await this.prisma.requestedTorrent.findUnique({
        where: { id: requestId },
        select: { contentType: true },
      });
      if (request?.contentType !== ContentType.TV_SHOW) {
        return;
      }
      await this.seasonScanningService.scanTvShowRequest(requestId);
    } catch (error) {
      this.logger.warn(`Could not scan episodes for request ${requestId} after its download: ${error.message}`);
    }
  }

  // Get download statistics
  async getDownloadStats(): Promise<{
    activeDownloads: number;
    totalSpeed: string;
    averageProgress: number;
  }> {
    try {
      const downloadingRequests = await this.requestedTorrentsService.getRequestsByStatus(RequestStatus.DOWNLOADING);
      
      if (downloadingRequests.length === 0) {
        return {
          activeDownloads: 0,
          totalSpeed: '0 B/s',
          averageProgress: 0,
        };
      }

      let totalSpeedBytes = 0;
      let totalProgress = 0;
      let validProgressCount = 0;

      for (const request of downloadingRequests) {
        if (request.aria2Gid) {
          try {
            const status = await this.aria2Service.getStatus(request.aria2Gid);
            if (status) {
              totalSpeedBytes += parseInt(status.downloadSpeed) || 0;

              // Calculate progress from aria2 status
              const totalLength = parseInt(status.totalLength) || 0;
              const completedLength = parseInt(status.completedLength) || 0;
              const progress = totalLength > 0 ? Math.round((completedLength / totalLength) * 100) : 0;

              totalProgress += progress;
              validProgressCount++;
            }
          } catch (error) {
            this.logger.debug(`Error getting status for ${request.aria2Gid}:`, error);
          }
        }
      }

      return {
        activeDownloads: downloadingRequests.length,
        totalSpeed: this.formatSpeed(totalSpeedBytes),
        averageProgress: validProgressCount > 0 ? Math.round(totalProgress / validProgressCount) : 0,
      };
    } catch (error) {
      this.logger.error('Error getting download stats:', error);
      return {
        activeDownloads: 0,
        totalSpeed: '0 B/s',
        averageProgress: 0,
      };
    }
  }

  // NOTE: Season status updates are now handled by the season scanning service
  // which checks organized files in the library rather than download completion

  // NOTE: Episode status updates are now handled by the season scanning service
  // which checks organized files in the library rather than download completion

  private async updateMainRequestStatus(requestId: string): Promise<void> {
    try {
      // Check if all torrent downloads for this request are complete
      const requestDownloads = await this.prisma.torrentDownload.findMany({
        where: {
          requestedTorrentId: requestId,
        },
      });

      const allComplete = requestDownloads.every(download => download.status === 'COMPLETED');
      const anyFailed = requestDownloads.some(download => download.status === 'FAILED');

      let newStatus: string;
      if (anyFailed) {
        newStatus = 'FAILED';
      } else if (allComplete) {
        newStatus = 'COMPLETED';
      } else {
        // Still downloading
        return;
      }

      await this.prisma.requestedTorrent.update({
        where: { id: requestId },
        data: {
          status: newStatus as any,
          completedAt: newStatus === 'COMPLETED' ? new Date() : null,
          updatedAt: new Date(),
        },
      });

      this.logger.log(`Updated main request ${requestId} status to ${newStatus}`);

    } catch (error) {
      this.logger.error(`Error updating main request status for ${requestId}:`, error);
    }
  }

  /**
   * Organize downloaded files based on organization rules
   */
  private async organizeDownloadedFiles(requestId: string, aria2Gid: string): Promise<OrganizeAttempt> {
    this.logger.log(`Starting organization for request ${requestId} with aria2Gid ${aria2Gid}`);

    // Check if organization is enabled
    const settings = await this.organizationRulesService.getSettings();
    if (!settings.organizeOnComplete) {
      this.logger.warn(`Organization on completion is disabled for request ${requestId}`);
      return { failed: [] };
    }

    // Get the request details
    const request = await this.prisma.requestedTorrent.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      this.logger.warn(`Request ${requestId} not found for organization`);
      return { failed: [] };
    }

    // Collect all files to organize (from main download and child downloads)
    const allFiles: string[] = [];
    try {
      const downloadStatus = await this.aria2Service.getStatus(aria2Gid);
      const statuses = [downloadStatus];

      // For torrents, the actual content files belong to child downloads
      for (const childGid of downloadStatus.followedBy ?? []) {
        try {
          statuses.push(await this.aria2Service.getStatus(childGid));
        } catch (childError) {
          this.logger.debug(`Error getting child download files for ${childGid}:`, childError);
        }
      }

      for (const status of statuses) {
        for (const file of status.files ?? []) {
          // aria2 may see the download folder at another path than this server does.
          if (file.path) allFiles.push(fromAria2Path(file.path));
        }
      }
    } catch (error) {
      return { failed: [], error: `Could not read the download's files from aria2: ${error.message}` };
    }

    if (allFiles.length === 0) {
      this.logger.warn(`No files found for download ${aria2Gid} (including child downloads)`);
      return { failed: [] };
    }

    this.logger.log(`Found ${allFiles.length} total files for request: ${request.title}`);

    const outcome = await this.downloadOrganizationService.organizeFiles(allFiles, this.targetFor(request));
    this.logger.log(`Organization complete for request ${requestId}: ${outcome.organized.length} organized, ${outcome.skipped.length} skipped, ${outcome.failed.length} failed`);

    return { failed: outcome.failed };
  }
}
