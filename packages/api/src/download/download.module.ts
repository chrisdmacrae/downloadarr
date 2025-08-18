import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { DownloadController } from './download.controller';
import { DownloadService } from './download.service';
import { DownloadProcessor } from './download.processor';
import { Aria2Service } from './aria2.service';
import { DownloadGateway } from './download.gateway';
import { ProgressTrackerService } from './progress-tracker.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'download',
    }),
  ],
  controllers: [DownloadController],
  providers: [DownloadService, DownloadProcessor, Aria2Service, DownloadGateway, ProgressTrackerService],
  exports: [DownloadService, Aria2Service, DownloadGateway],
})
export class DownloadModule {}
