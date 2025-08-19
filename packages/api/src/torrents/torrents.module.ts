import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bull';

// Services
import { RequestedTorrentsService } from './services/requested-torrents.service';
import { TorrentSearchLogService } from './services/torrent-search-log.service';
import { TorrentSearchResultsService } from './services/torrent-search-results.service';
import { TorrentCheckerService } from './services/torrent-checker.service';
import { DownloadProgressTrackerService } from './services/download-progress-tracker.service';

// Controllers
import { TorrentRequestsController } from './controllers/torrent-requests.controller';

// Import other modules
import { DiscoveryModule } from '../discovery/discovery.module';
import { DownloadModule } from '../download/download.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    DiscoveryModule,
    DownloadModule,
  ],
  providers: [
    RequestedTorrentsService,
    TorrentSearchLogService,
    TorrentSearchResultsService,
    TorrentCheckerService,
    DownloadProgressTrackerService,
  ],
  controllers: [
    TorrentRequestsController,
  ],
  exports: [
    RequestedTorrentsService,
    TorrentSearchLogService,
    TorrentSearchResultsService,
    TorrentCheckerService,
    DownloadProgressTrackerService,
  ],
})
export class TorrentsModule {}
