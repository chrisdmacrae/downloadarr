import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { DownloadService } from './download.service';
import { DownloadGateway } from './download.gateway';

@Injectable()
export class ProgressTrackerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ProgressTrackerService.name);
  private queueStatsInterval: NodeJS.Timeout;
  private aria2StatsInterval: NodeJS.Timeout;

  constructor(
    private downloadService: DownloadService,
    private downloadGateway: DownloadGateway,
  ) {}

  onModuleInit() {
    this.startPeriodicUpdates();
  }

  onModuleDestroy() {
    this.stopPeriodicUpdates();
  }

  private startPeriodicUpdates() {
    // Update queue stats every 5 seconds
    this.queueStatsInterval = setInterval(async () => {
      try {
        const stats = await this.downloadService.getQueueStats();
        this.downloadGateway.broadcastQueueStats(stats);
      } catch (error) {
        this.logger.error('Failed to update queue stats:', error);
      }
    }, 5000);

    // Update Aria2 stats every 10 seconds
    this.aria2StatsInterval = setInterval(async () => {
      try {
        const stats = await this.downloadService.getAria2Stats();
        this.downloadGateway.broadcastAria2Stats(stats);
      } catch (error) {
        this.logger.error('Failed to update Aria2 stats:', error);
      }
    }, 10000);

    this.logger.log('Started periodic progress updates');
  }

  private stopPeriodicUpdates() {
    if (this.queueStatsInterval) {
      clearInterval(this.queueStatsInterval);
    }
    if (this.aria2StatsInterval) {
      clearInterval(this.aria2StatsInterval);
    }
    this.logger.log('Stopped periodic progress updates');
  }
}
