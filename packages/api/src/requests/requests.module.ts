import { Module, forwardRef } from '@nestjs/common';
import { AggregatedRequestController } from './controllers/aggregated-request.controller';
import { AggregatedRequestService } from './services/aggregated-request.service';
import { TorrentsModule } from '../torrents/torrents.module';
import { HttpDownloadsModule } from '../http-downloads/http-downloads.module';

@Module({
  imports: [
    forwardRef(() => TorrentsModule),
    forwardRef(() => HttpDownloadsModule),
  ],
  controllers: [
    AggregatedRequestController,
  ],
  providers: [
    AggregatedRequestService,
  ],
  exports: [
    AggregatedRequestService,
  ],
})
export class RequestsModule {}
