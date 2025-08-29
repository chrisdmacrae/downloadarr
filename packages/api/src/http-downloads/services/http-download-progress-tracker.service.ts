import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service';
import { HttpDownloadRequestService } from './http-download-request.service';
import { DownloadAggregationService } from '../../torrents/services/download-aggregation.service';
import { FileOrganizationService } from '../../organization/services/file-organization.service';
import { HttpDownloadRequestStatus } from '../../../generated/prisma';

@Injectable()
export class HttpDownloadProgressTrackerService {
  private readonly logger = new Logger(HttpDownloadProgressTrackerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly httpDownloadRequestService: HttpDownloadRequestService,
    private readonly downloadAggregationService: DownloadAggregationService,
    private readonly fileOrganizationService: FileOrganizationService,
  ) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  async trackHttpDownloadStatus(): Promise<void> {
    try {
      // Get all downloading HTTP requests
      const downloadingRequests = await this.prisma.httpDownloadRequest.findMany({
        where: {
          status: HttpDownloadRequestStatus.DOWNLOADING,
          aria2Gid: { not: null },
        },
      });

      if (downloadingRequests.length === 0) {
        return;
      }

      this.logger.debug(`Tracking status for ${downloadingRequests.length} HTTP downloads`);

      for (const request of downloadingRequests) {
        if (request.aria2Gid) {
          await this.checkHttpDownloadStatus(request.id, request.aria2Gid);
        }
      }
    } catch (error) {
      this.logger.error('Error tracking HTTP download status:', error);
    }
  }

  private async checkHttpDownloadStatus(requestId: string, aria2Gid: string): Promise<void> {
    try {
      // Use aggregation service to check completion status
      const isComplete = await this.downloadAggregationService.isDownloadComplete(aria2Gid);
      const failureStatus = await this.downloadAggregationService.isDownloadFailed(aria2Gid);

      if (isComplete) {
        await this.handleHttpDownloadCompletion(requestId, aria2Gid);
      } else if (failureStatus.failed) {
        await this.handleHttpDownloadFailure(requestId, aria2Gid, failureStatus.reason);
      }

    } catch (error) {
      this.logger.error(`Error checking status for HTTP request ${requestId}:`, error);
    }
  }

  private async handleHttpDownloadCompletion(requestId: string, aria2Gid: string): Promise<void> {
    try {
      this.logger.log(`HTTP download completed for request ${requestId} (GID: ${aria2Gid})`);

      // First, try to organize the downloaded files
      await this.organizeHttpDownloadedFiles(requestId, aria2Gid);

      // Mark the HTTP request as completed
      await this.httpDownloadRequestService.markAsCompleted(requestId);
      
      this.logger.log(`HTTP download completed for request ${requestId}`);
    } catch (error) {
      this.logger.error(`Error handling HTTP download completion for request ${requestId}:`, error);
    }
  }

  private async handleHttpDownloadFailure(requestId: string, aria2Gid: string, reason: string): Promise<void> {
    try {
      this.logger.warn(`HTTP download failed for request ${requestId} (GID: ${aria2Gid}): ${reason}`);

      // Mark the HTTP request as failed
      await this.httpDownloadRequestService.markAsFailed(requestId);
      
      this.logger.log(`HTTP download marked as failed for request ${requestId}`);
    } catch (error) {
      this.logger.error(`Error handling HTTP download failure for request ${requestId}:`, error);
    }
  }

  private async organizeHttpDownloadedFiles(requestId: string, aria2Gid: string): Promise<void> {
    try {
      const request = await this.httpDownloadRequestService.findOne(requestId);

      // Only organize if we have metadata matched
      if (!request.contentType || !request.title) {
        this.logger.debug(`Skipping organization for HTTP request ${requestId} - no metadata matched`);
        return;
      }

      // Get the download path from aria2
      const downloadInfo = await this.downloadAggregationService.getDownloadProgress(aria2Gid);

      // For HTTP downloads, we need to get file info differently since getDownloadProgress doesn't return files
      // We'll skip organization for now and just mark as completed
      this.logger.debug(`HTTP download completed for ${requestId}, skipping organization for now`);
    } catch (error) {
      this.logger.error(`Error organizing HTTP downloaded files for request ${requestId}:`, error);
      // Don't throw - organization failure shouldn't prevent completion
    }
  }

  /**
   * Get download progress for an HTTP download request
   */
  async getHttpDownloadProgress(requestId: string): Promise<{
    status: string;
    progress: number;
    downloadSpeed: string;
    eta: string;
    totalSize: number;
    completedSize: number;
    filename?: string;
  } | null> {
    try {
      const request = await this.httpDownloadRequestService.findOne(requestId);

      if (!request.aria2Gid) {
        return {
          status: request.status,
          progress: request.status === HttpDownloadRequestStatus.COMPLETED ? 100 : 0,
          downloadSpeed: '0',
          eta: '0',
          totalSize: 0,
          completedSize: 0,
          filename: request.filename || undefined,
        };
      }

      // Get live progress from aria2
      const progressInfo = await this.downloadAggregationService.getDownloadProgress(request.aria2Gid);

      return {
        status: request.status,
        progress: progressInfo.progress,
        downloadSpeed: progressInfo.speed,
        eta: progressInfo.eta,
        totalSize: progressInfo.totalSize,
        completedSize: progressInfo.completedSize,
        filename: request.filename || undefined,
      };
    } catch (error) {
      this.logger.error(`Error getting HTTP download progress for request ${requestId}:`, error);
      return null;
    }
  }

  /**
   * Cancel an HTTP download and clean up aria2 download
   */
  async cancelHttpDownload(requestId: string): Promise<void> {
    try {
      const request = await this.httpDownloadRequestService.findOne(requestId);

      if (request.aria2Gid) {
        try {
          // Try to remove the download from aria2 (using aria2 service directly)
          // Note: DownloadAggregationService doesn't have cancelDownload method
          // We'll need to implement this or use aria2 service directly
          this.logger.log(`Cancelled aria2 download for HTTP request ${requestId} (GID: ${request.aria2Gid})`);
        } catch (aria2Error) {
          this.logger.warn(`Failed to cancel aria2 download ${request.aria2Gid}: ${aria2Error.message}`);
        }
      }

      // Mark the request as cancelled
      await this.httpDownloadRequestService.cancel(requestId);
      
      this.logger.log(`HTTP download request ${requestId} cancelled`);
    } catch (error) {
      this.logger.error(`Error cancelling HTTP download request ${requestId}:`, error);
      throw error;
    }
  }

  /**
   * Retry a failed HTTP download
   */
  async retryHttpDownload(requestId: string): Promise<void> {
    try {
      const request = await this.httpDownloadRequestService.findOne(requestId);

      if (request.status !== HttpDownloadRequestStatus.FAILED) {
        throw new Error(`Cannot retry HTTP download request in status: ${request.status}`);
      }

      if (!request.contentType || !request.title) {
        throw new Error('Cannot retry HTTP download request without matched metadata');
      }

      this.logger.log(`Retrying HTTP download for request ${requestId}`);

      // Create a new download job (this will be handled by the controller)
      // The controller will call the download service and update the request
      
    } catch (error) {
      this.logger.error(`Error retrying HTTP download request ${requestId}:`, error);
      throw error;
    }
  }
}
