import { Module, forwardRef } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { DownloadController } from './download.controller';
import { DownloadService } from './download.service';
import { Aria2Service } from './aria2.service';
import { DownloadGateway } from './download.gateway';
import { ProgressTrackerService } from './progress-tracker.service';
import { DownloadMetadataService } from './download-metadata.service';
import { TorrentLinkResolverService } from './torrent-link-resolver.service';
import { TorrentsModule } from '../torrents/torrents.module';

@Module({
  imports: [HttpModule, forwardRef(() => TorrentsModule)],
  controllers: [DownloadController],
  providers: [
    DownloadService,
    Aria2Service,
    DownloadGateway,
    ProgressTrackerService,
    DownloadMetadataService,
    TorrentLinkResolverService,
  ],
  exports: [DownloadService, Aria2Service, DownloadGateway, DownloadMetadataService],
})
export class DownloadModule {}
