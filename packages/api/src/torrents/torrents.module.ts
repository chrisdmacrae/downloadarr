import { Module, forwardRef, OnModuleInit } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bull';
import { ModuleRef } from '@nestjs/core';

// Services
import { RequestedTorrentsService } from './services/requested-torrents.service';
import { TorrentSearchLogService } from './services/torrent-search-log.service';
import { TorrentSearchResultsService } from './services/torrent-search-results.service';
import { TorrentCheckerService } from './services/torrent-checker.service';
import { DownloadProgressTrackerService } from './services/download-progress-tracker.service';
import { TvShowMetadataService } from './services/tv-show-metadata.service';
import { TvShowMetadataCronService } from './services/tv-show-metadata-cron.service';
import { SeasonScanningService } from './services/season-scanning.service';
import { RequestLifecycleOrchestrator } from './services/request-lifecycle-orchestrator.service';
import { DownloadAggregationService } from './services/download-aggregation.service';

// State Machine
import { RequestStateMachine } from './state-machine/request-state-machine';
import { TvShowStateMachine } from './state-machine/tv-show-state-machine';

// Controllers
import { TorrentRequestsController } from './controllers/torrent-requests.controller';

// Import other modules
import { DiscoveryModule } from '../discovery/discovery.module';
import { DownloadModule } from '../download/download.module';
import { OrganizationModule } from '../organization/organization.module';
import { GameConfigModule } from '../config/config.module';
import { DownloadMetadataService } from '../download/download-metadata.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    DiscoveryModule,
    forwardRef(() => DownloadModule),
    OrganizationModule,
    GameConfigModule,
  ],
  providers: [
    // State Machine
    RequestStateMachine,
    TvShowStateMachine,

    // Orchestrator
    RequestLifecycleOrchestrator,

    // Aggregation
    DownloadAggregationService,

    // Services
    RequestedTorrentsService,
    TorrentSearchLogService,
    TorrentSearchResultsService,
    TorrentCheckerService,
    DownloadProgressTrackerService,
    TvShowMetadataService,
    TvShowMetadataCronService,
    SeasonScanningService,
  ],
  controllers: [
    TorrentRequestsController,
  ],
  exports: [
    // State Machine
    RequestStateMachine,
    TvShowStateMachine,

    // Orchestrator
    RequestLifecycleOrchestrator,

    // Aggregation
    DownloadAggregationService,

    // Services
    RequestedTorrentsService,
    TorrentSearchLogService,
    TorrentSearchResultsService,
    TorrentCheckerService,
    DownloadProgressTrackerService,
    TvShowMetadataService,
    SeasonScanningService,
  ],
})
export class TorrentsModule implements OnModuleInit {
  constructor(private moduleRef: ModuleRef) {}

  async onModuleInit() {
    // Set up orchestrator in DownloadMetadataService to avoid circular dependency
    try {
      const orchestrator = this.moduleRef.get(RequestLifecycleOrchestrator, { strict: false });
      const downloadMetadataService = this.moduleRef.get(DownloadMetadataService, { strict: false });

      if (orchestrator && downloadMetadataService) {
        downloadMetadataService.setOrchestrator(orchestrator);
      }
    } catch (error) {
      // Ignore if services are not available (during testing, etc.)
    }
  }
}
