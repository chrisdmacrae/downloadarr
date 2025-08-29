import { Module, forwardRef } from '@nestjs/common';
import { HttpDownloadRequestController } from './controllers/http-download-request.controller';
import { HttpDownloadRequestService } from './services/http-download-request.service';
import { HttpDownloadProgressTrackerService } from './services/http-download-progress-tracker.service';
import { DownloadModule } from '../download/download.module';
import { TorrentsModule } from '../torrents/torrents.module';
import { OrganizationModule } from '../organization/organization.module';

@Module({
  imports: [
    forwardRef(() => DownloadModule),
    forwardRef(() => TorrentsModule),
    forwardRef(() => OrganizationModule),
  ],
  controllers: [
    HttpDownloadRequestController,
  ],
  providers: [
    HttpDownloadRequestService,
    HttpDownloadProgressTrackerService,
  ],
  exports: [
    HttpDownloadRequestService,
    HttpDownloadProgressTrackerService,
  ],
})
export class HttpDownloadsModule {}
