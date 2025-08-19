import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TvShowMetadataService } from './tv-show-metadata.service';

@Injectable()
export class TvShowMetadataCronService {
  private readonly logger = new Logger(TvShowMetadataCronService.name);

  constructor(private readonly tvShowMetadataService: TvShowMetadataService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async updateTvShowMetadata(): Promise<void> {
    this.logger.log('Starting hourly TV show metadata update');
    
    try {
      await this.tvShowMetadataService.updateAllOngoingShows();
      this.logger.log('Hourly TV show metadata update completed successfully');
    } catch (error) {
      this.logger.error('Error during hourly TV show metadata update:', error.stack);
    }
  }

  // Also run at startup to populate any missing data
  @Cron('0 */6 * * *') // Every 6 hours
  async fullMetadataSync(): Promise<void> {
    this.logger.log('Starting full TV show metadata sync');
    
    try {
      await this.tvShowMetadataService.updateAllOngoingShows();
      this.logger.log('Full TV show metadata sync completed successfully');
    } catch (error) {
      this.logger.error('Error during full TV show metadata sync:', error.stack);
    }
  }
}
