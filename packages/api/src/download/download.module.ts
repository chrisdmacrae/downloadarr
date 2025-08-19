import { Module } from '@nestjs/common';
import { DownloadController } from './download.controller';
import { DownloadService } from './download.service';
import { Aria2Service } from './aria2.service';
import { DownloadGateway } from './download.gateway';
import { ProgressTrackerService } from './progress-tracker.service';
import { DownloadMetadataService } from './download-metadata.service';

@Module({
  imports: [],
  controllers: [DownloadController],
  providers: [DownloadService, Aria2Service, DownloadGateway, ProgressTrackerService, DownloadMetadataService],
  exports: [DownloadService, Aria2Service, DownloadGateway, DownloadMetadataService],
})
export class DownloadModule {}
