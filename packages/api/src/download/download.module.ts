import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { DownloadController } from './download.controller';
import { DownloadService } from './download.service';
import { DownloadProcessor } from './download.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'download',
    }),
  ],
  controllers: [DownloadController],
  providers: [DownloadService, DownloadProcessor],
  exports: [DownloadService],
})
export class DownloadModule {}
